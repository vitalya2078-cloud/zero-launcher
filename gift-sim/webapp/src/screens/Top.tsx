import { useEffect, useState } from "preact/hooks";
import { api, errorText } from "../api";
import { GameHeader, Segmented, stageBg } from "../components/game-ui";
import { GiftArt } from "../components/GiftArt";
import { Ico, Star } from "../components/icons";
import { ago, fmt, plural, RARITY, short, SOURCE } from "../format";
import { go, showToast } from "../state";
import { haptic } from "../tg";
import type { Leaderboard, LbKind, PlayerProfile } from "../types";

// Аватар игрока: фото из Telegram или первая буква имени.
function Avatar({ url, name, size = 44 }: { url: string | null; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const st = { width: size, height: size, fontSize: size * 0.42 };
  if (url && !broken) return <img class="avatar" src={url} alt="" style={st} onError={() => setBroken(true)} />;
  return <div class="avatar" style={st}>{[...name][0]?.toUpperCase() ?? "?"}</div>;
}

const KINDS: { id: LbKind; label: string }[] = [
  { id: "won", label: "Выигрыш" },
  { id: "level", label: "Уровень" },
  { id: "inventory", label: "Коллекция" },
];

const SUB: Record<LbKind, string> = {
  won: "Сумма всех выигрышей за всё время",
  level: "Опыт за ставки и открытые кейсы",
  inventory: "Стоимость подарков в коллекции",
};

function Score({ kind, score, level }: { kind: LbKind; score: number; level: number }) {
  if (kind === "level") {
    return (
      <div class="lb-score num">
        <b>{level} ур.</b>
        <small>{short(score)} XP</small>
      </div>
    );
  }
  return (
    <div class="lb-score num">
      <b><Star /> {short(score)}</b>
    </div>
  );
}

// ---------------------------------------------------------------- топ

export function Top() {
  const [kind, setKind] = useState<LbKind>(() => (localStorage.getItem("lb_kind") as LbKind) || "won");
  const [data, setData] = useState<Leaderboard | null>(null);

  useEffect(() => {
    setData(null);
    api<Leaderboard>("leaderboard", { kind }).then(setData).catch((e) => showToast(errorText(e), "err"));
  }, [kind]);

  const meOutside = data?.me && !data.items.some((i) => i.me);

  return (
    <>
      <GameHeader title="Топ игроков" sub={SUB[kind]} />
      <Segmented value={kind} options={KINDS} onChange={(k) => { setKind(k); localStorage.setItem("lb_kind", k); }} />

      {!data ? (
        Array.from({ length: 6 }, () => <div class="skeleton" style={{ height: 64, marginBottom: 8 }} />)
      ) : data.items.length === 0 ? (
        <div class="empty glass">
          <Ico name="games/jackpot" size={96} class="big" />
          <div>Здесь пока никого. Сыграй — и займи первое место</div>
        </div>
      ) : (
        <div class="lb-list">
          {data.items.map((i) => (
            <button
              class={`lb-row glass ${i.me ? "me" : ""} ${i.rank <= 3 ? `top${i.rank}` : ""}`}
              onClick={() => { haptic.tap(); go({ name: "player", id: i.id }); }}
            >
              <span class="lb-rank num">{i.rank}</span>
              <Avatar url={i.photo_url} name={i.user} />
              <div class="lb-name">
                <b>{i.user}</b>
                <span>{i.me ? "Это ты" : `Уровень ${i.level}`}</span>
              </div>
              <Score kind={kind} score={i.score} level={i.level} />
            </button>
          ))}
        </div>
      )}

      {meOutside && data?.me && (
        <div class="lb-mine glass num">
          <span>Твоё место</span>
          <b>#{fmt(data.me.rank)}</b>
          <span class="spacer" />
          {kind === "level" ? <b>{short(data.me.score)} XP</b> : <b><Star /> {short(data.me.score)}</b>}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- профиль игрока

export function Player({ id }: { id: string }) {
  const [p, setP] = useState<PlayerProfile | null | undefined>(undefined);

  useEffect(() => {
    api<PlayerProfile | null>("player", { id }).then(setP).catch((e) => {
      showToast(errorText(e), "err");
      setP(null);
    });
  }, [id]);

  if (p === undefined) {
    return (
      <>
        <div class="skeleton" style={{ height: 96, marginTop: 6 }} />
        <div class="skeleton" style={{ height: 70, marginTop: 10 }} />
        <div class="skeleton" style={{ height: 220, marginTop: 10 }} />
      </>
    );
  }
  if (p === null) return <div class="empty glass" style={{ marginTop: 6 }}>Игрок не найден</div>;

  const since = new Date(p.since).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <div class="me glass stage-bg" style={{ marginTop: 6, ...stageBg("profile") }}>
        <Avatar url={p.photo_url} name={p.user} size={58} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div class="player-name">{p.user}{p.me && <span class="me-tag">это ты</span>}</div>
          <div class="dim" style={{ fontSize: 13 }}>Уровень {p.level} · в игре с {since}</div>
        </div>
      </div>

      <div class="stats3" style={{ marginTop: 10 }}>
        <div class="stat glass">
          <b class="num"><Star size={18} />{short(p.total_won)}</b>
          <span>выиграно</span>
        </div>
        <div class="stat glass">
          <b class="num"><Ico name="cat-classic" size={20} />{fmt(p.cases_opened)}</b>
          <span>{plural(p.cases_opened, "кейс", "кейса", "кейсов")}</span>
        </div>
        <div class="stat glass">
          <b class="num"><Ico name="tab-inventory" size={20} />{short(p.collection_value)}</b>
          <span>коллекция</span>
        </div>
      </div>

      {p.best && (
        <div class="best-drop glass" style={{ "--rc": RARITY[p.best.rarity].color }}>
          <GiftArt gift={p.best} size={64} />
          <div class="t-body">
            <span>Лучший дроп</span>
            <b>{p.best.name}</b>
          </div>
          <b class="num"><Star /> {short(p.best.value)}</b>
        </div>
      )}

      <div class="section-title">
        <h2><Ico name="tab-inventory" size={30} />Коллекция</h2>
        <span class="num">{p.collection_count} {plural(p.collection_count, "подарок", "подарка", "подарков")}</span>
      </div>
      {p.collection.length === 0 ? (
        <div class="empty glass" style={{ padding: "28px 20px" }}>Коллекция пока пустая</div>
      ) : (
        <div class="gift-grid">
          {p.collection.map((g) => (
            <div class="gift-card glass" style={{ "--rc": RARITY[g.rarity].color }} key={g.inv_id}>
              <GiftArt gift={g} size={56} />
              <div class="g-name">{g.name}</div>
              <div class="g-val num"><Star /> {short(g.value)}</div>
            </div>
          ))}
        </div>
      )}
      {p.collection_count > p.collection.length && (
        <div class="dim" style={{ textAlign: "center", fontSize: 12, marginTop: 8 }}>
          Показаны {p.collection.length} самых дорогих
        </div>
      )}

      <div class="section-title">
        <h2><Ico name="cat-special" size={30} />Последние выигрыши</h2>
      </div>
      {p.recent.length === 0 ? (
        <div class="empty glass" style={{ padding: "28px 20px" }}>Выигрышей пока нет</div>
      ) : (
        p.recent.map((w) => (
          <div class="win-row glass" style={{ "--rc": RARITY[w.rarity].color }}>
            <GiftArt gift={w} size={40} />
            <div class="t-body">
              <b>{w.name}</b>
              <span>{SOURCE[w.source] ?? "Игра"} · {ago(w.at)}</span>
            </div>
            <b class="num"><Star /> {short(w.value)}</b>
          </div>
        ))
      )}
    </>
  );
}

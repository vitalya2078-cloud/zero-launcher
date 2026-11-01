import { useEffect, useRef, useState } from "preact/hooks";
import { api, errorText } from "../../api";
import { GiftArt } from "../../components/GiftArt";
import { GameHeader, ItemPicker, SmallGift } from "../../components/game-ui";
import { Star } from "../../components/icons";
import { Sheet } from "../../components/ui";
import { fmt, short } from "../../format";
import { profile, refreshInventory, refreshProfile, setBalance, showToast } from "../../state";
import { haptic } from "../../tg";
import type { CaseCard, Gift } from "../../types";

const COLORS = ["#3d9bff", "#ff5a6e", "#3ddc97", "#ffb547", "#a86bff", "#ff6bd6", "#5ee7ff", "#c6ff5e"];

// ---------------------------------------------------------------- джекпот

type JBet = { user: string; photo_url: string | null; me: boolean; value: number; chance: number; gifts: Gift[] };
type JState = {
  round_id: number;
  ends_at: string | null;
  server_time: string;
  total_value: number;
  bets: JBet[];
  last_winners: { round_id: number; user: string; total_value: number; chance: number }[];
};

export function Jackpot() {
  const [s, setS] = useState<JState | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const offset = useRef(0);
  const lastRound = useRef<number>(0);
  const [, tick] = useState(0);

  async function load() {
    try {
      const st = await api<JState>("jackpot_state");
      offset.current = new Date(st.server_time).getTime() - Date.now();
      if (lastRound.current && st.round_id !== lastRound.current) {
        // прошлый раунд разыгран
        const w = st.last_winners[0];
        if (w) {
          haptic.heavy();
          showToast(`🏆 ${w.user} забирает банк ${short(w.total_value)} ★ (шанс ${w.chance}%)`);
          refreshInventory().catch(() => {});
        }
      }
      lastRound.current = st.round_id;
      setS(st);
    } catch (e) {
      showToast(errorText(e), "err");
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 2500);
    const c = setInterval(() => tick((x) => x + 1), 250);
    return () => { clearInterval(t); clearInterval(c); };
  }, []);

  async function bet(ids: number[]) {
    setBusy(true);
    try {
      setS(await api<JState>("jackpot_bet", { ids }));
      haptic.medium();
      refreshInventory().catch(() => {});
      refreshProfile().catch(() => {});
    } catch (e) {
      haptic.error();
      showToast(errorText(e), "err");
    } finally {
      setBusy(false);
    }
  }

  const left = s?.ends_at ? Math.max(0, (new Date(s.ends_at).getTime() - Date.now() - offset.current) / 1000) : null;
  // кольцо долей участников
  const R = 88, C = 2 * Math.PI * R;
  let acc = 0;

  return (
    <>
      <GameHeader title="Джекпот" sub="Больше вклад — выше шанс" />
      <div class="jackpot-stage glass">
        <svg viewBox="0 0 220 220" class="jackpot-ring">
          <circle cx="110" cy="110" r={R} fill="none" stroke="rgba(255,255,255,.08)" stroke-width="18" />
          {s?.bets.map((b, i) => {
            const part = s.total_value ? b.value / s.total_value : 0;
            const el = (
              <circle cx="110" cy="110" r={R} fill="none" stroke={COLORS[i % COLORS.length]} stroke-width="18"
                stroke-dasharray={`${C * part} ${C}`} stroke-dashoffset={-C * acc} transform="rotate(-90 110 110)" />
            );
            acc += part;
            return el;
          })}
        </svg>
        <div class="upgrade-center">
          <div class="dim" style={{ fontSize: 12 }}>Банк</div>
          <div class="num" style={{ fontSize: 26, fontWeight: 800 }}>{short(s?.total_value ?? 0)} ★</div>
          <div class="dim num" style={{ fontSize: 12 }}>
            {left != null ? `розыгрыш через ${left.toFixed(0)}с` : (s?.bets.length ?? 0) > 0 ? "ждём соперника" : "банк пуст"}
          </div>
        </div>
      </div>
      <button class="btn" disabled={busy || (left != null && left < 2)} onClick={() => setPicking(true)}>
        Поставить подарки
      </button>

      {s && s.bets.length > 0 && (
        <>
          <div class="section-title"><h2>Участники</h2><span>{s.bets.length}</span></div>
          {s.bets.map((b, i) => (
            <div class={`bet-line glass ${b.me ? "me" : ""}`}>
              <span class="dot" style={{ background: COLORS[i % COLORS.length] }} />
              <span class="who">{b.user}</span>
              <span class="gifts-row">{b.gifts.slice(0, 4).map((g) => <SmallGift g={g} />)}</span>
              <span class="num" style={{ fontWeight: 700 }}>{b.chance}%</span>
            </div>
          ))}
        </>
      )}
      {s && s.last_winners.length > 0 && (
        <>
          <div class="section-title"><h2>Последние победители</h2></div>
          {s.last_winners.slice(0, 5).map((w) => (
            <div class="bet-line glass">
              <span class="who">🏆 {w.user}</span>
              <span class="dim num">шанс {w.chance}%</span>
              <span class="num up">{short(w.total_value)} ★</span>
            </div>
          ))}
        </>
      )}
      {picking && <ItemPicker title="Ставка в джекпот (до 10)" max={10} onClose={() => setPicking(false)} onDone={(x) => { setPicking(false); bet(x.map((i) => i.id)); }} />}
    </>
  );
}

// ---------------------------------------------------------------- битвы кейсов

type BPlayer = { slot: number; bot: boolean; me: boolean; user: string; photo_url: string | null; total: number; drops: Gift[] | null };
type Battle = {
  id: number;
  status: "waiting" | "finished";
  max_players: number;
  cost: number;
  winner_slot: number | null;
  total_value: number;
  is_creator: boolean;
  cases: { id: string; name: string; price: number; cover: Gift | null }[];
  players: BPlayer[];
};

export function Battles() {
  const [list, setList] = useState<{ waiting: Battle[]; recent: Battle[] } | null>(null);
  const [view, setView] = useState<Battle | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setList(await api("battles"));
    } catch (e) {
      showToast(errorText(e), "err");
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  // пока ждём соперников — обновляем открытую битву
  useEffect(() => {
    if (!view || view.status !== "waiting") return;
    const t = setInterval(async () => {
      const b = await api<Battle>("battle", { id: view.id }).catch(() => null);
      if (b) setView(b);
      if (b?.status === "finished") haptic.heavy();
    }, 2500);
    return () => clearInterval(t);
  }, [view?.id, view?.status]);

  async function act(method: string, params: Record<string, unknown>) {
    setBusy(true);
    try {
      const b = await api<Battle & { cancelled?: boolean; balance?: number }>(method, params);
      if (b.cancelled) { setView(null); showToast("Битва отменена, звёзды вернулись"); }
      else setView(b);
      if (b.status === "finished") haptic.heavy(); else haptic.medium();
      refreshProfile().catch(() => {});
      refreshInventory().catch(() => {});
      load();
    } catch (e) {
      haptic.error();
      showToast(errorText(e), "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <GameHeader title="Битвы кейсов" sub="Дороже дроп — весь банк твой" />
      <button class="btn" onClick={() => setCreating(true)}>Создать битву</button>

      <div class="section-title"><h2>Ждут соперников</h2><span>{list?.waiting.length ?? 0}</span></div>
      {list?.waiting.length === 0 && <div class="empty glass" style={{ padding: 24 }}>Пусто. Создай свою битву</div>}
      {list?.waiting.map((b) => <BattleRow b={b} onOpen={() => setView(b)} />)}

      {list && list.recent.length > 0 && (
        <>
          <div class="section-title"><h2>Недавние</h2></div>
          {list.recent.map((b) => <BattleRow b={b} onOpen={() => setView(b)} />)}
        </>
      )}

      {creating && <CreateBattle busy={busy} onClose={() => setCreating(false)} onCreate={(cases, players) => { setCreating(false); act("battle_create", { cases, players }); }} />}
      {view && (
        <Sheet onClose={() => setView(null)}>
          <BattleView b={view} busy={busy}
            onJoin={() => act("battle_join", { id: view.id })}
            onBots={() => act("battle_bots", { id: view.id })}
            onCancel={() => act("battle_cancel", { id: view.id })} />
        </Sheet>
      )}
    </>
  );
}

function BattleRow({ b, onOpen }: { b: Battle; onOpen: () => void }) {
  const winner = b.winner_slot != null ? b.players.find((p) => p.slot === b.winner_slot) : null;
  return (
    <button class="battle-row glass" onClick={onOpen}>
      <div class="gifts-row">{b.cases.slice(0, 4).map((c) => c.cover && <SmallGift g={c.cover} />)}</div>
      <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
        <b class="num">{b.players.length}/{b.max_players} игроков</b>
        <div class="dim" style={{ fontSize: 12 }}>{b.cases.length} кейс(ов) · {b.status === "finished" ? `победил ${winner?.user ?? "—"}` : "ожидание"}</div>
      </div>
      <span class="num" style={{ fontWeight: 800 }}><Star /> {short(b.status === "finished" ? b.total_value : b.cost)}</span>
    </button>
  );
}

function BattleView({ b, busy, onJoin, onBots, onCancel }: { b: Battle; busy: boolean; onJoin: () => void; onBots: () => void; onCancel: () => void }) {
  const joined = b.players.some((p) => p.me);
  const canAfford = (profile.value?.balance ?? 0) >= b.cost;
  return (
    <>
      <div class="section-title" style={{ marginTop: 0 }}>
        <h2>Битва #{b.id}</h2>
        <span class="num">вход {fmt(b.cost)} ★</span>
      </div>
      <div class="gifts-row" style={{ marginBottom: 12 }}>{b.cases.map((c) => c.cover && <SmallGift g={c.cover} />)}</div>
      <div class="battle-cols" style={{ gridTemplateColumns: `repeat(${b.max_players}, 1fr)` }}>
        {Array.from({ length: b.max_players }, (_, slot) => {
          const p = b.players.find((x) => x.slot === slot);
          const win = b.status === "finished" && b.winner_slot === slot;
          return (
            <div class={`battle-col glass ${win ? "winner" : ""} ${p?.me ? "me" : ""}`}>
              <div class="who">{p ? (p.bot ? "🤖 Бот" : p.user) : "ожидание…"}</div>
              {p?.drops?.map((g) => (
                <div class="battle-drop"><GiftArt gift={g} size={38} /><span class="num">{short(g.value)}</span></div>
              ))}
              {b.status === "finished" && p && <div class="num total">{short(p.total)} ★</div>}
              {win && <div class="crown">🏆</div>}
            </div>
          );
        })}
      </div>
      {b.status === "waiting" && (
        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          {!joined && <button class="btn" disabled={busy || !canAfford} onClick={onJoin}>Войти за {fmt(b.cost)} ★</button>}
          {b.is_creator && <button class="btn secondary" disabled={busy} onClick={onBots}>Добавить ботов</button>}
          {b.is_creator && b.players.length === 1 && <button class="btn secondary" disabled={busy} onClick={onCancel}>Отменить</button>}
        </div>
      )}
      {b.status === "finished" && (
        <div class={`result-line ${b.players.find((p) => p.slot === b.winner_slot)?.me ? "win" : joined ? "lose" : ""}`} style={{ marginTop: 14 }}>
          <b>{b.players.find((p) => p.slot === b.winner_slot)?.me ? "Победа!" : "Победитель: " + (b.players.find((p) => p.slot === b.winner_slot)?.user ?? "")}</b>
          <span class="num">банк {short(b.total_value)} ★</span>
        </div>
      )}
    </>
  );
}

function CreateBattle({ busy, onClose, onCreate }: { busy: boolean; onClose: () => void; onCreate: (cases: string[], players: number) => void }) {
  const [cases, setCases] = useState<CaseCard[]>([]);
  const [chosen, setChosen] = useState<CaseCard[]>([]);
  const [players, setPlayers] = useState(2);
  useEffect(() => {
    api<CaseCard[]>("cases").then((l) => setCases(l.filter((c) => c.pay_mode === "stars"))).catch(() => {});
  }, []);
  const cost = chosen.reduce((s, c) => s + c.base_price, 0);
  return (
    <Sheet onClose={onClose}>
      <div class="section-title" style={{ marginTop: 0 }}><h2>Новая битва</h2><span class="num">{chosen.length}/5 кейсов</span></div>
      <div class="seg glass" style={{ marginBottom: 12 }}>
        {[2, 3, 4].map((n) => <button class={players === n ? "on" : ""} onClick={() => setPlayers(n)}>{n} игрока</button>)}
      </div>
      <div class="gift-grid" style={{ maxHeight: "44vh", overflowY: "auto", padding: 2 }}>
        {cases.map((c) => {
          const n = chosen.filter((x) => x.id === c.id).length;
          return (
            <button class={`gift-card glass ${n ? "selected" : ""}`} style={{ "--rc": "#3d9bff" }}
              onClick={() => { haptic.tick(); if (chosen.length < 5) setChosen([...chosen, c]); }}>
              {n > 0 && <span class="check">{n}</span>}
              {c.cover && <GiftArt gift={c.cover} size={48} />}
              <div class="g-name">{c.name}</div>
              <div class="g-val num"><Star /> {short(c.base_price)}</div>
            </button>
          );
        })}
      </div>
      <div class="row" style={{ marginTop: 12 }}>
        <button class="btn secondary" style={{ flex: "none", width: 110 }} disabled={!chosen.length} onClick={() => setChosen([])}>Сбросить</button>
        <button class="btn" disabled={busy || !chosen.length} onClick={() => onCreate(chosen.map((c) => c.id), players)}>
          Создать · {fmt(cost)} ★
        </button>
      </div>
    </Sheet>
  );
}

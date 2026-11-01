import { useEffect, useState } from "preact/hooks";
import { api, errorText } from "../api";
import { KeyIcon, Star } from "../components/icons";
import { fmt } from "../format";
import { profile, showToast } from "../state";
import { haptic, referralLink, shareLink, tg } from "../tg";
import type { Profile as P, Task } from "../types";

export function Profile() {
  const p = profile.value;
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api<Task[]>("tasks").then(setTasks).catch((e) => showToast(errorText(e), "err"));
  }, []);

  if (!p) return <div class="skeleton" style={{ height: 160, marginTop: 6 }} />;

  const span = Math.max(1, p.next_level_xp - p.level_xp);
  const progress = Math.min(1, Math.max(0, (p.xp - p.level_xp) / span));
  const link = referralLink(p.tg_id);

  async function claim(t: Task) {
    if (t.kind === "subscribe" && t.url) tg ? tg.openTelegramLink(t.url) : window.open(t.url, "_blank");
    setBusy(t.id);
    try {
      const r = await api<P & { reward_stars: number; reward_keys: number }>("claim_task", { id: t.id });
      profile.value = r;
      haptic.success();
      showToast(`Награда: +${fmt(r.reward_stars)} ★${r.reward_keys ? ` и ${r.reward_keys} 🔑` : ""}`);
      setTasks(await api<Task[]>("tasks"));
    } catch (e) {
      haptic.error();
      showToast(errorText(e), "err");
    } finally {
      setBusy(null);
    }
  }

  const daily = tasks?.filter((t) => t.period === "daily") ?? [];
  const once = tasks?.filter((t) => t.period === "once") ?? [];

  return (
    <>
      <div class="me glass" style={{ marginTop: 6 }}>
        {p.photo_url ? <img class="avatar" src={p.photo_url} alt="" /> : <div class="avatar">{(p.first_name ?? "?")[0]}</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{p.first_name ?? "Игрок"}</div>
          <div class="dim num" style={{ fontSize: 13 }}>
            Уровень {p.level} · {fmt(p.xp - p.level_xp)} / {fmt(span)} XP
          </div>
          <div class="level-bar">
            <i style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </div>

      <div class="stats3">
        <div class="stat glass">
          <b class="num">{fmt(p.balance)}</b>
          <span>звёзд</span>
        </div>
        <div class="stat glass">
          <b class="num">{p.referral_keys}</b>
          <span>ключей</span>
        </div>
        <div class="stat glass">
          <b class="num">{p.invited_active}</b>
          <span>друзей</span>
        </div>
      </div>

      <div class="section-title">
        <h2>Друзья</h2>
      </div>
      <div class="ref-box glass">
        <div class="muted" style={{ fontSize: 14 }}>
          Другу — <b>1 000 ★</b> на старт. Тебе — <b>1 500 ★</b> и <KeyIcon size={14} /> ключ, когда он возьмёт 2 уровень, плюс 3% с его ставок.
        </div>
        <div class="ref-link">{link}</div>
        <div class="row">
          <button
            class="btn secondary small"
            style={{ height: 44 }}
            onClick={() => {
              navigator.clipboard?.writeText(link).then(() => showToast("Ссылка скопирована"));
            }}
          >
            Копировать
          </button>
          <button class="btn small" style={{ height: 44 }} onClick={() => shareLink(link, "Залетай в FORTUM DROPS: кейсы с NFT-подарками, краш и битвы. По моей ссылке +1 000 ★")}>
            Поделиться
          </button>
        </div>
      </div>

      {tasks && (
        <>
          <div class="section-title">
            <h2>Задания дня</h2>
            <span>сброс в 03:00 МСК</span>
          </div>
          {daily.map((t) => (
            <TaskRow t={t} busy={busy === t.id} onClaim={() => claim(t)} />
          ))}
          <div class="section-title">
            <h2>Достижения</h2>
          </div>
          {once.map((t) => (
            <TaskRow t={t} busy={busy === t.id} onClaim={() => claim(t)} />
          ))}
        </>
      )}
    </>
  );
}

function TaskRow({ t, busy, onClaim }: { t: Task; busy: boolean; onClaim: () => void }) {
  const done = t.kind === "subscribe" || (t.progress ?? 0) >= t.target;
  const pct = t.kind === "stat" ? Math.min(1, (t.progress ?? 0) / t.target) : 0;
  const target = t.target >= 1000 && t.id === "o_crash10x" ? "×10" : null;
  return (
    <div class={`task glass ${t.claimed ? "done" : ""}`}>
      <div class="t-body">
        <div class="t-title">{t.title}</div>
        <div class="t-sub num">
          +{fmt(t.reward_stars)} ★{t.reward_keys ? ` · +${t.reward_keys} 🔑` : ""}
          {t.kind === "stat" && !target && ` · ${Math.min(t.progress ?? 0, t.target)}/${t.target}`}
        </div>
        {t.kind === "stat" && !t.claimed && !target && (
          <div class="t-progress">
            <i style={{ width: `${pct * 100}%` }} />
          </div>
        )}
      </div>
      {t.claimed ? (
        <span class="dim">✓</span>
      ) : (
        <button class={`btn small ${done ? "" : "secondary"}`} disabled={busy || (!done && t.kind === "stat")} onClick={onClaim}>
          {t.kind === "subscribe" ? "Перейти" : done ? "Забрать" : <Star />}
        </button>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "preact/hooks";
import { api, errorText } from "../../api";
import { BetInput, GameHeader, stageBg } from "../../components/game-ui";
import { fmt, short } from "../../format";
import { refreshProfile, setBalance, showToast } from "../../state";
import { haptic } from "../../tg";
import { sound } from "../../sound";

import { CrashScene } from "./crashScene";

type Bet = { user: string; photo_url: string | null; bet: number; status: "active" | "cashed" | "lost"; cashout_at: number | null; payout: number; me: boolean };
type State = {
  round_id: number;
  phase: "betting" | "running" | "crashed";
  server_time: string;
  starts_at: string;
  rate: number;
  crash_point: number | null;
  next_round_at: string | null;
  bets: Bet[];
  history: number[];
  balance: number;
};

// Общий краш: один раунд на всех. Сервер хранит точку взрыва в секрете; клиент рисует множитель
// по серверному времени (e^(rate·t)). О взрыве узнаём через crash_wait: сервер держит запрос и отвечает
// ровно в момент взрыва. Обычный опрос остаётся для чужих ставок и выводов.
export function Crash() {
  const [s, setS] = useState<State | null>(null);
  const [bet, setBet] = useState(() => Number(localStorage.getItem("bet")) || 100);
  const [auto, setAuto] = useState<string>(() => localStorage.getItem("crash_auto") ?? "");
  const [busy, setBusy] = useState(false);
  const [, frame] = useState(0);
  const offset = useRef(0); // server_time − Date.now()
  const bestRtt = useRef(Infinity);
  const lastSeen = useRef({ round: 0, time: 0 }); // самый свежий применённый ответ
  const waiting = useRef(0); // раунд, для которого уже висит crash_wait
  const alive = useRef(true);
  const lastPhase = useRef<string>("");
  const prevMine = useRef<string | undefined>(undefined);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<CrashScene>();

  const now = () => Date.now() + offset.current;

  // Применяем ответ сервера. Устаревшие (пришли позже более свежего) отбрасываем,
  // иначе старый «running» мог бы «оживить» уже взорвавшийся раунд.
  function apply(st: State, sentAt: number) {
    const recv = Date.now();
    const srv = new Date(st.server_time).getTime();
    if (st.round_id < lastSeen.current.round || (st.round_id === lastSeen.current.round && srv < lastSeen.current.time)) return;
    lastSeen.current = { round: st.round_id, time: srv };
    // часы сервера: берём замер с самым коротким временем ответа, сдвиг — на половину пути
    const rtt = recv - sentAt;
    if (rtt <= bestRtt.current * 1.3 || offset.current === 0) {
      bestRtt.current = Math.min(bestRtt.current, rtt);
      offset.current = srv - (sentAt + rtt / 2);
    }
    react(st);
    if (st.phase === "running") waitCrash(st.round_id);
  }

  // держим открытый запрос до взрыва
  async function waitCrash(round: number) {
    if (waiting.current === round) return;
    waiting.current = round;
    while (alive.current) {
      const sent = Date.now();
      try {
        const st = await api<State>("crash_wait");
        apply(st, sent);
        if (st.round_id !== round || st.phase !== "running") break;
      } catch {
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }

  async function load() {
    const sent = Date.now();
    try {
      apply(await api<State>("crash_state"), sent);
    } catch (e) {
      showToast(errorText(e), "err");
    }
  }

  function react(st: State) {
    if (lastPhase.current === "running" && st.phase === "crashed") {
      haptic.heavy();
      sound.boom();
      const mine = st.bets.find((b) => b.me);
      if (mine?.status === "lost") haptic.error();
    }
    const mineStatus = st.bets.find((b) => b.me)?.status;
    if (mineStatus === "cashed" && prevMine.current === "active") {
      haptic.success(); // сработал автовывод
      sound.coins();
      refreshProfile().catch(() => {});
    }
    prevMine.current = mineStatus;
    lastPhase.current = st.phase;
    setS(st);
    setBalance(st.balance);
  }

  // обычный опрос — для чужих ставок, выводов и нового раунда
  useEffect(() => {
    alive.current = true;
    load();
    let t: number;
    const loop = () => {
      t = window.setTimeout(async () => {
        await load();
        loop();
      }, 1000);
    };
    loop();
    return () => {
      alive.current = false;
      clearTimeout(t);
    };
  }, []);

  // анимация 60 fps
  useEffect(() => {
    let raf: number;
    const tick = () => {
      frame((x) => x + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const startsAt = s ? new Date(s.starts_at).getTime() : 0;
  const t = s ? Math.max(0, (now() - startsAt) / 1000) : 0;
  const live = s?.phase === "running" ? Math.floor(Math.exp(s.rate * t) * 100) / 100 : 1;
  const mult = s?.phase === "crashed" ? Number(s.crash_point) : live;
  const toStart = s?.phase === "betting" ? Math.max(0, (startsAt - now()) / 1000) : 0;
  const nextIn = s?.next_round_at ? Math.max(0, (new Date(s.next_round_at).getTime() - now()) / 1000) : 0;
  const me = s?.bets.find((b) => b.me);

  // сцена: кривая, ракета, частицы
  useEffect(() => {
    const c = canvas.current;
    if (!c || !s) return;
    scene.current ??= new CrashScene();
    scene.current.draw(c, { phase: s.phase, rate: Number(s.rate), t, mult, roundId: s.round_id });
  });

  async function placeBet() {
    setBusy(true);
    const sent = Date.now();
    try {
      const a = auto.trim() ? Number(auto.replace(",", ".")) : null;
      apply(await api<State>("crash_bet", { bet, auto_cashout: a }), sent);
      haptic.medium();
    } catch (e) {
      haptic.error();
      showToast(errorText(e), "err");
    } finally {
      setBusy(false);
    }
  }

  async function cashout() {
    setBusy(true);
    const sent = Date.now();
    try {
      const st = await api<State & { cashout_at: number; payout: number }>("crash_cashout");
      prevMine.current = "cashed"; // вывод ручной — не путать с автовыводом в react()
      apply(st, sent);
      haptic.success();
      sound.coins();
      showToast(`Забрали ×${st.cashout_at} — +${fmt(st.payout)} ★`);
      refreshProfile().catch(() => {});
    } catch (e) {
      haptic.error();
      showToast(errorText(e), "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <GameHeader title="Краш" sub="Один раунд на всех игроков" />
      <div class="crash-history">
        {s?.history.map((h) => <span class={`hchip ${h >= 2 ? (h >= 10 ? "gold" : "good") : ""}`}>×{Number(h).toFixed(2)}</span>)}
      </div>
      <div class={`crash-stage glass stage-bg ${s?.phase ?? ""}`} style={stageBg("crash")}>
        <canvas ref={canvas} class="crash-canvas" />
        <div class="crash-center">
          {!s ? "…" : s.phase === "betting" ? (
            <>
              <div class="dim" style={{ fontSize: 14 }}>Приём ставок</div>
              <div class="crash-mult num">{toStart.toFixed(1)}с</div>
            </>
          ) : s.phase === "running" ? (
            <div class="crash-mult num">×{mult.toFixed(2)}</div>
          ) : (
            <>
              <div class="crash-mult num" style={{ color: "var(--err)" }}>×{mult.toFixed(2)}</div>
              <div class="dim" style={{ fontSize: 13 }}>Взрыв! Следующий через {nextIn.toFixed(0)}с</div>
            </>
          )}
        </div>
      </div>

      {s?.phase === "running" && me?.status === "active" ? (
        <button class="btn gold" disabled={busy} onClick={cashout}>
          Забрать {fmt(Math.floor(me.bet * mult))} ★
        </button>
      ) : me ? (
        <div class={`result-line ${me.status === "cashed" ? "win" : me.status === "lost" ? "lose" : ""}`}>
          <b class="num">{me.status === "cashed" ? `×${me.cashout_at}` : me.status === "lost" ? "Взрыв" : "Ставка принята"}</b>
          <span class="num">{me.status === "cashed" ? `+${fmt(me.payout)} ★` : me.status === "lost" ? `−${fmt(me.bet)} ★` : `${fmt(me.bet)} ★`}</span>
        </div>
      ) : (
        <>
          <BetInput value={bet} onChange={(v) => { setBet(v); localStorage.setItem("bet", String(v)); }} disabled={busy} />
          <div class="auto glass">
            <span class="dim">Автовывод на</span>
            <input class="num" inputMode="decimal" placeholder="—" value={auto}
              onInput={(e) => { const v = (e.target as HTMLInputElement).value; setAuto(v); localStorage.setItem("crash_auto", v); }} />
            <span class="dim">×</span>
          </div>
          <button class="btn" disabled={busy || s?.phase !== "betting"} onClick={placeBet}>
            {s?.phase === "betting" ? `Поставить ${fmt(bet)} ★` : "Ждём следующий раунд"}
          </button>
        </>
      )}

      {s && s.bets.length > 0 && (
        <>
          <div class="section-title"><h2>Ставки раунда</h2><span>{s.bets.length}</span></div>
          {s.bets.map((b) => (
            <div class={`bet-line glass ${b.me ? "me" : ""}`}>
              <span class="who">{b.user}</span>
              <span class="num dim">{short(b.bet)} ★</span>
              <span class={`num ${b.status === "cashed" ? "up" : b.status === "lost" ? "down" : ""}`}>
                {b.status === "cashed" ? `×${b.cashout_at} · +${short(b.payout)}` : b.status === "lost" ? "—" : "в игре"}
              </span>
            </div>
          ))}
        </>
      )}
    </>
  );
}

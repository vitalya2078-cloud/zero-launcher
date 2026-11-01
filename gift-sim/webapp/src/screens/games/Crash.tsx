import { useEffect, useRef, useState } from "preact/hooks";
import { api, errorText } from "../../api";
import { BetInput, GameHeader } from "../../components/game-ui";
import { fmt, short } from "../../format";
import { refreshProfile, setBalance, showToast } from "../../state";
import { haptic } from "../../tg";

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
// по серверному времени (e^(rate·t)) и опрашивает состояние, чтобы узнать о взрыве и чужих выводах.
export function Crash() {
  const [s, setS] = useState<State | null>(null);
  const [bet, setBet] = useState(() => Number(localStorage.getItem("bet")) || 100);
  const [auto, setAuto] = useState<string>(() => localStorage.getItem("crash_auto") ?? "");
  const [busy, setBusy] = useState(false);
  const [, frame] = useState(0);
  const offset = useRef(0); // server_time − Date.now()
  const lastPhase = useRef<string>("");
  const prevMine = useRef<string | undefined>(undefined);
  const canvas = useRef<HTMLCanvasElement>(null);

  const now = () => Date.now() + offset.current;

  async function load() {
    try {
      const st = await api<State>("crash_state");
      offset.current = new Date(st.server_time).getTime() - Date.now();
      if (lastPhase.current === "running" && st.phase === "crashed") {
        haptic.heavy();
        const mine = st.bets.find((b) => b.me);
        if (mine?.status === "lost") haptic.error();
      }
      const mineStatus = st.bets.find((b) => b.me)?.status;
      if (mineStatus === "cashed" && prevMine.current === "active") {
        haptic.success(); // сработал автовывод
        refreshProfile().catch(() => {});
      }
      prevMine.current = mineStatus;
      lastPhase.current = st.phase;
      setS(st);
      setBalance(st.balance);
    } catch (e) {
      showToast(errorText(e), "err");
    }
  }

  // опрос: чаще во время полёта
  useEffect(() => {
    load();
    let t: number;
    const loop = () => {
      t = window.setTimeout(async () => {
        await load();
        loop();
      }, lastPhase.current === "running" ? 600 : 1200);
    };
    loop();
    return () => clearTimeout(t);
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

  // график
  useEffect(() => {
    const c = canvas.current;
    if (!c || !s) return;
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = c.clientHeight;
    if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if (s.phase === "betting") return;
    const tEnd = s.phase === "crashed" ? Math.log(Math.max(1, mult)) / s.rate : t;
    const tMax = Math.max(8, tEnd * 1.15), mMax = Math.max(2, mult * 1.15);
    const x = (tt: number) => 16 + (tt / tMax) * (W - 32);
    const y = (m: number) => H - 16 - ((m - 1) / (mMax - 1)) * (H - 40);
    const color = s.phase === "crashed" ? "#ff5a6e" : "#3d9bff";
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, s.phase === "crashed" ? "rgba(255,90,110,.35)" : "rgba(61,155,255,.35)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.beginPath();
    g.moveTo(x(0), y(1));
    for (let i = 1; i <= 60; i++) {
      const tt = (tEnd * i) / 60;
      g.lineTo(x(tt), y(Math.exp(s.rate * tt)));
    }
    g.lineWidth = 3;
    g.strokeStyle = color;
    g.stroke();
    g.lineTo(x(tEnd), H - 16);
    g.lineTo(x(0), H - 16);
    g.fillStyle = grad;
    g.fill();
  });

  async function placeBet() {
    setBusy(true);
    try {
      const a = auto.trim() ? Number(auto.replace(",", ".")) : null;
      const st = await api<State>("crash_bet", { bet, auto_cashout: a });
      setS(st);
      setBalance(st.balance);
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
    try {
      const st = await api<State & { cashout_at: number; payout: number }>("crash_cashout");
      setS(st);
      setBalance(st.balance);
      haptic.success();
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
      <GameHeader title="Краш" sub="Множитель растёт — заберите ставку до взрыва. Раунд общий для всех" />
      <div class="crash-history">
        {s?.history.map((h) => <span class={`hchip ${h >= 2 ? (h >= 10 ? "gold" : "good") : ""}`}>×{Number(h).toFixed(2)}</span>)}
      </div>
      <div class={`crash-stage glass ${s?.phase ?? ""}`}>
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
              <div class="dim" style={{ fontSize: 13 }}>Взрыв! Новый раунд через {nextIn.toFixed(0)}с</div>
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
            {s?.phase === "betting" ? `Поставить ${fmt(bet)} ★` : "Ждём следующий раунд…"}
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

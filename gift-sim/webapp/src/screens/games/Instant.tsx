import { useEffect, useRef, useState } from "preact/hooks";
import { api, errorText } from "../../api";
import { BetInput, GameHeader, ResultLine, Segmented, stageBg } from "../../components/game-ui";
import { fmt } from "../../format";
import { refreshProfile, setBalance, showToast } from "../../state";
import { haptic } from "../../tg";
import { sound } from "../../sound";
import { Star } from "../../components/icons";

type Risk = "low" | "mid" | "high";
const RISKS: { id: Risk; label: string }[] = [
  { id: "low", label: "Низкий" },
  { id: "mid", label: "Средний" },
  { id: "high", label: "Высокий" },
];

type Instant = { round_id: number; bet: number; multiplier: number; payout: number; balance: number };

function useBet() {
  const [bet, setBet] = useState(() => Number(localStorage.getItem("bet")) || 100);
  return [bet, (v: number) => { setBet(v); localStorage.setItem("bet", String(v)); }] as const;
}

async function play<T extends Instant>(method: string, params: Record<string, unknown>): Promise<T | null> {
  try {
    return await api<T>(method, params);
  } catch (e) {
    haptic.error();
    showToast(errorText(e), "err");
    return null;
  }
}

function finish(r: Instant) {
  setBalance(r.balance);
  if (r.payout > r.bet) { haptic.success(); sound.coins(); }
  else if (r.payout === 0) { haptic.error(); sound.lose(); }
  else haptic.medium();
  refreshProfile().catch(() => {});
}

// ---------------------------------------------------------------- монетка

export function Coinflip() {
  const [bet, setBet] = useBet();
  const [side, setSide] = useState<"heads" | "tails">("heads");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<(Instant & { result: string }) | null>(null);
  const [turns, setTurns] = useState(0);

  async function flip() {
    setBusy(true);
    setRes(null);
    haptic.medium();
    sound.flip();
    const r = await play<Instant & { result: "heads" | "tails" }>("coinflip", { bet, side });
    if (!r) return setBusy(false);
    // монета делает 5 оборотов и останавливается выпавшей стороной
    setTurns((t) => {
      const showingTails = t % 360 === 180;
      return t + 1800 + ((r.result === "tails") !== showingTails ? 180 : 0);
    });
    setTimeout(() => {
      sound.land();
      setRes(r);
      finish(r);
      setBusy(false);
    }, 1600);
  }

  return (
    <>
      <GameHeader title="Монетка" sub="Угадай сторону" />
      <div class="coin-stage glass stage-bg" style={stageBg("coinflip")}>
        <div class="coin" style={{ transform: `rotateY(${turns}deg)` }}>
          <img class="coin-face heads" src="./fx/coin-heads.webp" alt="" draggable={false} />
          <img class="coin-face tails" src="./fx/coin-tails.webp" alt="" draggable={false} />
        </div>
        {res && <ResultLine payout={res.payout} bet={res.bet} multiplier={res.multiplier} />}
      </div>
      <Segmented
        value={side}
        disabled={busy}
        onChange={setSide}
        options={[
          { id: "heads", label: <><img class="seg-ico" src="./fx/coin-heads.webp" alt="" />Звезда</> },
          { id: "tails", label: <><img class="seg-ico" src="./fx/coin-tails.webp" alt="" />Кристалл</> },
        ]}
      />
      <BetInput value={bet} onChange={setBet} disabled={busy} />
      <button class="btn" disabled={busy} onClick={flip}>{busy ? "Крутим" : `Подбросить за ${fmt(bet)} ★`}</button>
    </>
  );
}

// ---------------------------------------------------------------- колесо

const WHEEL_PREVIEW: Record<Risk, number[]> = {
  low: [1.3, 1.04, 1.04, 1.04, 0, 1.04, 1.3, 1.04, 1.04, 1.04, 0, 1.04, 1.3, 1.04, 1.04, 1.04, 0, 1.04, 1.73, 1.04],
  mid: [0, 1.33, 0, 1.78, 0, 1.33, 0, 2.67, 0, 1.33, 0, 1.78, 0, 1.33, 0, 4.46, 0, 1.33, 0, 1.78],
  high: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 19.2],
};

function segColor(m: number) {
  if (m === 0) return "#2a3150";
  if (m < 1.2) return "#3d6bff";
  if (m < 1.5) return "#3d9bff";
  if (m < 2) return "#8b6bff";
  if (m < 3) return "#c26bff";
  if (m < 5) return "#ff9d3d";
  return "#ff5a6e";
}

export function Wheel() {
  const [bet, setBet] = useBet();
  const [risk, setRisk] = useState<Risk>("mid");
  const [segs, setSegs] = useState<number[]>(WHEEL_PREVIEW.mid);
  const [angle, setAngle] = useState(0);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Instant | null>(null);
  const [lit, setLit] = useState(0); // «бегущие огни» на ободе
  const spinRef = useRef<SVGSVGElement>(null);

  // огни: медленно мерцают в покое, быстро бегут во время вращения
  useEffect(() => {
    const t = setInterval(() => setLit((x) => x + 1), busy ? 90 : 520);
    return () => clearInterval(t);
  }, [busy]);

  async function spin() {
    setBusy(true);
    setRes(null);
    haptic.medium();
    sound.start();
    const r = await play<Instant & { segment: number; segments: number[] }>("wheel", { bet, risk });
    if (!r) return setBusy(false);
    setSegs(r.segments);
    const n = r.segments.length, seg = 360 / n;
    // указатель сверху: поворачиваем колесо так, чтобы центр выпавшего сектора оказался под ним
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const target = 360 * 6 + (360 - (r.segment * seg + seg / 2)) + jitter;
    setAngle((a) => a - (a % 360) + target);

    // щелчок и вибрация на каждой границе секторов под стрелкой
    const started = performance.now();
    let last = -1;
    const loop = () => {
      const el = spinRef.current;
      if (el) {
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        const deg = ((Math.atan2(m.b, m.a) * 180) / Math.PI + 360) % 360;
        const idx = Math.floor(deg / seg);
        if (idx !== last) {
          last = idx;
          sound.tick();
          haptic.reel();
        }
      }
      if (performance.now() - started < 4000) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    setTimeout(() => {
      setRes(r);
      finish(r);
      setBusy(false);
    }, 4200);
  }

  const n = segs.length, seg = 360 / n;
  const C = 160, R = 120; // центр и радиус секторов в системе 320×320
  const pt = (deg: number, r: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  const arc = (i: number) => {
    const [x0, y0] = pt(i * seg, R), [x1, y1] = pt((i + 1) * seg, R);
    return `M${C},${C} L${x0},${y0} A${R},${R} 0 0,1 ${x1},${y1} Z`;
  };
  const BULBS = 20;

  return (
    <>
      <GameHeader title="Колесо" sub="Выше риск — жирнее множители" />
      <div class="wheel-stage glass stage-bg" style={stageBg("wheel")}>
        <div class="wheel-box">
          {/* неподвижный обод с лампочками */}
          <svg viewBox="0 0 320 320" class="wheel-rim-svg">
            <defs>
              <linearGradient id="rimGold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#ffe7a0" />
                <stop offset="0.45" stop-color="#f3a93a" />
                <stop offset="0.7" stop-color="#b8661c" />
                <stop offset="1" stop-color="#ffd27a" />
              </linearGradient>
              <radialGradient id="bulbOn">
                <stop offset="0" stop-color="#fffbe6" />
                <stop offset="0.5" stop-color="#ffe07a" />
                <stop offset="1" stop-color="#ff9d2e" />
              </radialGradient>
              <filter id="bulbGlow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <circle cx={C} cy={C} r="156" fill="rgba(255,170,60,0.12)" />
            <circle cx={C} cy={C} r="150" fill="url(#rimGold)" />
            <circle cx={C} cy={C} r="138" fill="none" stroke="rgba(90,40,0,0.55)" stroke-width="3" />
            <circle cx={C} cy={C} r="126" fill="#0b1024" />
            {Array.from({ length: BULBS }, (_, i) => {
              const [x, y] = pt((i * 360) / BULBS, 144);
              const on = busy ? (i + lit) % 4 < 2 : (i + lit) % 2 === 0;
              return <circle cx={x} cy={y} r={on ? 5 : 4.2} fill={on ? "url(#bulbOn)" : "#7a4a14"} filter={on ? "url(#bulbGlow)" : undefined} />;
            })}
          </svg>

          {/* вращающиеся сектора */}
          <svg
            ref={spinRef}
            viewBox="0 0 320 320"
            class="wheel-spin"
            style={{ transform: `rotate(${angle}deg)`, transition: busy ? "transform 4s cubic-bezier(0.15, 0.8, 0.2, 1)" : "none" }}
          >
            <defs>
              <radialGradient id="segShade" cx="50%" cy="50%" r="50%">
                <stop offset="0.25" stop-color="#000" stop-opacity="0.35" />
                <stop offset="0.75" stop-color="#fff" stop-opacity="0" />
                <stop offset="1" stop-color="#fff" stop-opacity="0.18" />
              </radialGradient>
            </defs>
            {segs.map((m, i) => (
              <g>
                <path d={arc(i)} fill={segColor(m)} stroke="#0b1024" stroke-width="1.6" />
                {m > 0 && (
                  <text
                    x={C} y={C - R + 22} fill="#fff" font-size="12" font-weight="800" text-anchor="middle"
                    transform={`rotate(${i * seg + seg / 2} ${C} ${C})`}
                    style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.35)", strokeWidth: 2 }}
                  >
                    ×{m}
                  </text>
                )}
              </g>
            ))}
            <circle cx={C} cy={C} r={R} fill="url(#segShade)" />
          </svg>

          {/* ступица и стрелка поверх */}
          <div class={`wheel-hub num ${res ? (res.payout > res.bet ? "win" : "lose") : ""}`}>
            {res ? `×${res.multiplier}` : <Star size={30} />}
          </div>
          <img class="wheel-pointer" src="./fx/pointer.webp" alt="" draggable={false} />
        </div>
      </div>
      {res && <ResultLine payout={res.payout} bet={res.bet} multiplier={res.multiplier} />}
      <Segmented value={risk} disabled={busy} onChange={(v) => { setRisk(v); setSegs(WHEEL_PREVIEW[v]); setRes(null); }} options={RISKS} />
      <BetInput value={bet} onChange={setBet} disabled={busy} />
      <button class="btn" disabled={busy} onClick={spin}>{busy ? "Крутим" : `Крутить за ${fmt(bet)} ★`}</button>
    </>
  );
}

// ---------------------------------------------------------------- плинко

const PLINKO_PREVIEW: Record<Risk, number[]> = {
  low: [9.69, 2.9, 1.55, 1.35, 1.06, 0.96, 0.48, 0.96, 1.06, 1.35, 1.55, 2.9, 9.69],
  mid: [32, 10.66, 3.87, 1.93, 1.06, 0.58, 0.29, 0.58, 1.06, 1.93, 3.87, 10.66, 32],
  high: [164.65, 23.24, 7.84, 1.93, 0.67, 0.19, 0.19, 0.19, 0.67, 1.93, 7.84, 23.24, 164.65],
};
const ROWS = 12;

export function Plinko() {
  const [bet, setBet] = useBet();
  const [risk, setRisk] = useState<Risk>("mid");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<(Instant & { bucket: number }) | null>(null);
  const [ball, setBall] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<number>();
  const mults = PLINKO_PREVIEW[risk];

  // координаты в системе viewBox 0..320 × 0..300
  const W = 320, top = 20, rowH = 20;
  const pegX = (row: number, i: number) => W / 2 + (i - row / 2) * 24;

  async function drop() {
    setBusy(true);
    setRes(null);
    haptic.medium();
    const r = await play<Instant & { path: number[]; bucket: number }>("plinko", { bet, risk });
    if (!r) return setBusy(false);
    let step = 0, pos = 0;
    setBall({ x: W / 2, y: top - 10 });
    const next = () => {
      if (step < ROWS) {
        pos += r.path[step];
        step++;
        haptic.reel();
        sound.peg();
        setBall({ x: pegX(step, pos), y: top + step * rowH - 6 });
        timer.current = window.setTimeout(next, 110);
      } else {
        setRes(r);
        finish(r);
        setBusy(false);
        setTimeout(() => setBall(null), 900);
      }
    };
    timer.current = window.setTimeout(next, 120);
  }

  return (
    <>
      <GameHeader title="Плинко" sub="12 рядов, множитель внизу" />
      <div class="plinko-stage glass stage-bg" style={stageBg("plinko")}>
        <svg viewBox="0 0 320 300" class="plinko">
          {Array.from({ length: ROWS }, (_, row) =>
            Array.from({ length: row + 3 }, (_, i) => (
              <circle cx={pegX(row + 1, i - 1)} cy={top + (row + 1) * rowH} r="2.6" fill="rgba(255,255,255,.55)" />
            )),
          )}
          {mults.map((m, i) => {
            const x = pegX(ROWS, i);
            const hit = res && res.bucket === i;
            return (
              <g>
                <rect x={x - 11} y={top + ROWS * rowH + 14} width="22" height="22" rx="5"
                  fill={m >= 2 ? "#ff9d3d" : m >= 1 ? "#3d9bff" : "#2a3150"} opacity={hit ? 1 : 0.75}
                  stroke={hit ? "#fff" : "none"} stroke-width="1.5" />
                <text x={x} y={top + ROWS * rowH + 29} fill="#fff" font-size="6.5" font-weight="700" text-anchor="middle">
                  {m >= 10 ? Math.round(m) : m}
                </text>
              </g>
            );
          })}
          {ball && <image href="./fx/ball.webp" x={ball.x - 8} y={ball.y - 8} width="16" height="16" style={{ transition: "x .1s linear, y .1s ease-in", filter: "drop-shadow(0 0 5px #ffb547)" }} />}
        </svg>
      </div>
      {res && <ResultLine payout={res.payout} bet={res.bet} multiplier={res.multiplier} />}
      <Segmented value={risk} disabled={busy} onChange={(v) => { setRisk(v); setRes(null); }} options={RISKS} />
      <BetInput value={bet} onChange={setBet} disabled={busy} />
      <button class="btn" disabled={busy} onClick={drop}>{busy ? "Падает" : `Бросить за ${fmt(bet)} ★`}</button>
    </>
  );
}

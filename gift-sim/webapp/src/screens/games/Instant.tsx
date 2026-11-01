import { useRef, useState } from "preact/hooks";
import { api, errorText } from "../../api";
import { BetInput, GameHeader, ResultLine, Segmented } from "../../components/game-ui";
import { fmt } from "../../format";
import { refreshProfile, setBalance, showToast } from "../../state";
import { haptic } from "../../tg";

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
  if (r.payout > r.bet) haptic.success();
  else if (r.payout === 0) haptic.error();
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
    const r = await play<Instant & { result: "heads" | "tails" }>("coinflip", { bet, side });
    if (!r) return setBusy(false);
    // монета делает 5 оборотов и останавливается выпавшей стороной
    setTurns((t) => {
      const showingTails = t % 360 === 180;
      return t + 1800 + ((r.result === "tails") !== showingTails ? 180 : 0);
    });
    setTimeout(() => {
      setRes(r);
      finish(r);
      setBusy(false);
    }, 1600);
  }

  return (
    <>
      <GameHeader title="Монетка" sub="Угадай сторону" />
      <div class="coin-stage glass">
        <div class="coin" style={{ transform: `rotateY(${turns}deg)` }}>
          <div class="coin-face heads">★</div>
          <div class="coin-face tails">◆</div>
        </div>
        {res && <ResultLine payout={res.payout} bet={res.bet} multiplier={res.multiplier} />}
      </div>
      <Segmented
        value={side}
        disabled={busy}
        onChange={setSide}
        options={[{ id: "heads", label: "★ Звезда" }, { id: "tails", label: "◆ Кристалл" }]}
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

  async function spin() {
    setBusy(true);
    setRes(null);
    haptic.medium();
    const r = await play<Instant & { segment: number; segments: number[] }>("wheel", { bet, risk });
    if (!r) return setBusy(false);
    setSegs(r.segments);
    const n = r.segments.length, seg = 360 / n;
    // указатель сверху: поворачиваем колесо так, чтобы центр выпавшего сектора оказался под ним
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const target = 360 * 6 + (360 - (r.segment * seg + seg / 2)) + jitter;
    setAngle((a) => a - (a % 360) + target);
    setTimeout(() => {
      setRes(r);
      finish(r);
      setBusy(false);
    }, 4200);
  }

  const n = segs.length, seg = 360 / n, R = 140;
  const arc = (i: number) => {
    const a0 = ((i * seg - 90) * Math.PI) / 180, a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
    return `M150,150 L${150 + R * Math.cos(a0)},${150 + R * Math.sin(a0)} A${R},${R} 0 0,1 ${150 + R * Math.cos(a1)},${150 + R * Math.sin(a1)} Z`;
  };

  return (
    <>
      <GameHeader title="Колесо" sub="Выше риск — жирнее множители" />
      <div class="wheel-stage glass">
        <div class="wheel-pointer" />
        <svg viewBox="0 0 300 300" class="wheel" style={{ transform: `rotate(${angle}deg)`, transition: busy ? "transform 4s cubic-bezier(0.15, 0.8, 0.2, 1)" : "none" }}>
          {segs.map((m, i) => (
            <g>
              <path d={arc(i)} fill={segColor(m)} stroke="#070b18" stroke-width="1.5" />
              <text
                x="150" y="30" fill="#fff" font-size="11" font-weight="700" text-anchor="middle"
                transform={`rotate(${i * seg + seg / 2} 150 150)`}
              >
                {m === 0 ? "" : `×${m}`}
              </text>
            </g>
          ))}
          <circle cx="150" cy="150" r="34" fill="#0c1226" stroke="rgba(255,255,255,.2)" />
        </svg>
        <div class="wheel-center num">{res ? `×${res.multiplier}` : "★"}</div>
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
        haptic.tick();
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
      <div class="plinko-stage glass">
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
          {ball && <circle cx={ball.x} cy={ball.y} r="6" fill="#ffd27a" style={{ transition: "cx .1s linear, cy .1s ease-in", filter: "drop-shadow(0 0 6px #ffb547)" }} />}
        </svg>
      </div>
      {res && <ResultLine payout={res.payout} bet={res.bet} multiplier={res.multiplier} />}
      <Segmented value={risk} disabled={busy} onChange={(v) => { setRisk(v); setRes(null); }} options={RISKS} />
      <BetInput value={bet} onChange={setBet} disabled={busy} />
      <button class="btn" disabled={busy} onClick={drop}>{busy ? "Падает" : `Бросить за ${fmt(bet)} ★`}</button>
    </>
  );
}

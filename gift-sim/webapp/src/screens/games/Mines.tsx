import { useEffect, useState } from "preact/hooks";
import { api, errorText } from "../../api";
import { BetInput, GameHeader, stageBg } from "../../components/game-ui";
import { fmt } from "../../format";
import { refreshProfile, setBalance, showToast } from "../../state";
import { haptic } from "../../tg";
import { sound } from "../../sound";
import { tf, ts } from "../../money";

type Round = {
  round_id: number;
  bet: number;
  mines: number;
  revealed: number[];
  status: "active" | "cashed" | "busted";
  payout: number;
  multiplier: number;
  next_multiplier: number | null;
  positions: number[] | null;
  balance: number;
};

export function Mines() {
  const [bet, setBet] = useState(() => Number(localStorage.getItem("bet")) || 100);
  const [mines, setMines] = useState(3);
  const [round, setRound] = useState<Round | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Round | null>("mines_current").then((r) => r && setRound(r)).catch(() => {});
  }, []);

  const active = round?.status === "active";

  async function call(method: string, params: Record<string, unknown>) {
    setBusy(true);
    try {
      const r = await api<Round>(method, params);
      setRound(r);
      setBalance(r.balance);
      if (r.status === "busted") {
        haptic.error();
        haptic.heavy();
        sound.boom();
      } else if (r.status === "cashed") {
        haptic.success();
        sound.coins();
        showToast(`+${tf(r.payout)} TON`);
        refreshProfile().catch(() => {});
      } else {
        haptic.tap();
        if (method === "mines_reveal") sound.gem();
      }
    } catch (e) {
      haptic.error();
      showToast(errorText(e), "err");
    } finally {
      setBusy(false);
    }
  }

  const opened = round?.revealed.length ?? 0;
  const cashoutValue = round ? Math.floor(round.bet * round.multiplier) : 0;

  return (
    <>
      <GameHeader title="Мины" sub="Больше мин — выше множитель" />
      <div class="mines-grid glass stage-bg" style={stageBg("mines")}>
        {Array.from({ length: 25 }, (_, i) => {
          const revealed = round?.revealed.includes(i);
          const isMine = round?.positions?.includes(i);
          const finished = round && round.status !== "active";
          const cls = revealed ? (isMine ? "cell boom" : "cell gem") : finished && isMine ? "cell mine" : "cell";
          return (
            <button
              class={cls}
              disabled={!active || revealed || busy}
              onClick={() => call("mines_reveal", { round_id: round!.round_id, cell: i })}
            >
              <img class="tile" src={`./fx/tile-${revealed ? (isMine ? "boom" : "gem") : finished && isMine ? "bomb" : "closed"}.webp`} alt="" draggable={false} />
            </button>
          );
        })}
      </div>

      {active ? (
        <>
          <div class="mines-info glass num">
            <div><span class="dim">Сейчас</span><b>×{round!.multiplier}</b></div>
            <div><span class="dim">Следующая</span><b>{round!.next_multiplier ? `×${round!.next_multiplier}` : "—"}</b></div>
            <div><span class="dim">Открыто</span><b>{opened}/{25 - round!.mines}</b></div>
          </div>
          <button class="btn gold" disabled={busy || opened === 0} onClick={() => call("mines_cashout", { round_id: round!.round_id })}>
            {opened === 0 ? "Открой клетку" : `Забрать ${tf(cashoutValue)} TON`}
          </button>
        </>
      ) : (
        <>
          {round && (
            <div class={`result-line ${round.status === "cashed" ? "win" : "lose"}`}>
              <b class="num">{round.status === "cashed" ? `×${round.multiplier}` : "Мина!"}</b>
              <span class="num">{round.status === "cashed" ? `+${tf(round.payout)} TON` : `−${tf(round.bet)} TON`}</span>
            </div>
          )}
          <div class="glass" style={{ padding: "12px 14px", marginBottom: 12 }}>
            <div class="dim" style={{ fontSize: 13, marginBottom: 8 }}>Количество мин: <b style={{ color: "var(--text)" }}>{mines}</b></div>
            <input type="range" min={1} max={24} value={mines} class="range"
              onInput={(e) => { setMines(Number((e.target as HTMLInputElement).value)); haptic.tick(); }} />
          </div>
          <BetInput value={bet} onChange={(v) => { setBet(v); localStorage.setItem("bet", String(v)); }} disabled={busy} />
          <button class="btn" disabled={busy} onClick={() => call("mines_start", { bet, mines })}>
            Начать за {tf(bet)} TON
          </button>
        </>
      )}
    </>
  );
}

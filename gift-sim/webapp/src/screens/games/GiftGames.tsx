import { useEffect, useState } from "preact/hooks";
import { api, errorText } from "../../api";
import { GiftArt } from "../../components/GiftArt";
import { GameHeader, ItemPicker, PrizeSheet } from "../../components/game-ui";
import { Star } from "../../components/icons";
import { Sheet } from "../../components/ui";
import { fmt, RARITY, short } from "../../format";
import { refreshInventory, refreshProfile, showToast } from "../../state";
import { haptic } from "../../tg";
import type { Gift, InventoryItem } from "../../types";

// ---------------------------------------------------------------- апгрейд

const UPGRADE_RTP = 0.9, UPGRADE_MAX = 0.8;

export function Upgrade() {
  const [stake, setStake] = useState<InventoryItem[]>([]);
  const [target, setTarget] = useState<Gift | null>(null);
  const [picking, setPicking] = useState<"stake" | "target" | null>(null);
  const [angle, setAngle] = useState(0);
  const [busy, setBusy] = useState(false);
  const [won, setWon] = useState<Gift | null>(null);
  const [lost, setLost] = useState(false);

  const stakeValue = stake.reduce((s, i) => s + i.value, 0);
  const chance = target && stakeValue ? Math.min((stakeValue / target.value) * UPGRADE_RTP, UPGRADE_MAX) : 0;

  async function go() {
    if (!target) return;
    setBusy(true);
    setLost(false);
    haptic.medium();
    try {
      const r = await api<{ win: boolean; chance: number; roll: number; gift: Gift }>("upgrade", { ids: stake.map((s) => s.id), target: target.id });
      // стрелка останавливается на выпавшем числе: зелёный сектор — от 0 до шанса
      setAngle((a) => a - (a % 360) + 360 * 5 + r.roll * 360);
      setTimeout(() => {
        if (r.win) {
          haptic.success();
          setWon(r.gift);
        } else {
          haptic.error();
          setLost(true);
        }
        setStake([]);
        setBusy(false);
        refreshInventory().catch(() => {});
        refreshProfile().catch(() => {});
      }, 3300);
    } catch (e) {
      haptic.error();
      showToast(errorText(e), "err");
      setBusy(false);
    }
  }

  const C = 2 * Math.PI * 92;
  return (
    <>
      <GameHeader title="Апгрейд" sub="Чем ближе цены — тем выше шанс" />
      <div class="upgrade-stage glass">
        <svg viewBox="0 0 220 220" class="upgrade-ring">
          <circle cx="110" cy="110" r="92" fill="none" stroke="rgba(255,90,110,.35)" stroke-width="14" />
          <circle cx="110" cy="110" r="92" fill="none" stroke="#3ddc97" stroke-width="14"
            stroke-dasharray={`${C * chance} ${C}`} transform="rotate(-90 110 110)" stroke-linecap="butt" />
        </svg>
        <div class="upgrade-arrow" style={{ transform: `rotate(${angle}deg)`, transition: busy ? "transform 3.2s cubic-bezier(0.12, 0.8, 0.15, 1)" : "none" }} />
        <div class="upgrade-center">
          <div class="num" style={{ fontSize: 30, fontWeight: 800 }}>{(chance * 100).toFixed(1)}%</div>
          <div class="dim" style={{ fontSize: 12 }}>{lost ? "Не повезло" : "шанс"}</div>
        </div>
      </div>

      <div class="row" style={{ marginBottom: 12 }}>
        <button class="pick-box glass" disabled={busy} onClick={() => setPicking("stake")}>
          {stake.length ? (
            <>
              <div class="pick-gifts">{stake.slice(0, 3).map((g) => <GiftArt gift={g} size={40} />)}</div>
              <b class="num"><Star /> {short(stakeValue)}</b>
              <span class="dim">{stake.length} шт.</span>
            </>
          ) : (
            <><div class="plus">+</div><span class="dim">Ваши подарки</span></>
          )}
        </button>
        <div class="pick-arrow">→</div>
        <button class="pick-box glass" disabled={busy || !stake.length} onClick={() => setPicking("target")}>
          {target ? (
            <>
              <GiftArt gift={target} size={48} />
              <b class="num"><Star /> {short(target.value)}</b>
              <span class="dim">×{(target.value / Math.max(1, stakeValue)).toFixed(1)}</span>
            </>
          ) : (
            <><div class="plus">🎯</div><span class="dim">Цель</span></>
          )}
        </button>
      </div>
      <button class="btn" disabled={busy || !stake.length || !target || target.value <= stakeValue} onClick={go}>
        {busy ? "Крутим" : "Апгрейд"}
      </button>

      {picking === "stake" && (
        <ItemPicker title="Ставка (до 6)" max={6} onClose={() => setPicking(null)}
          onDone={(items) => { setStake(items); setPicking(null); if (target && target.value <= items.reduce((s, i) => s + i.value, 0)) setTarget(null); }} />
      )}
      {picking === "target" && (
        <TargetPicker min={stakeValue} onClose={() => setPicking(null)} onPick={(g) => { setTarget(g); setPicking(null); }} />
      )}
      {won && <PrizeSheet gift={won} note="Апгрейд зашёл!" onClose={() => setWon(null)} />}
    </>
  );
}

function TargetPicker({ min, onPick, onClose }: { min: number; onPick: (g: Gift) => void; onClose: () => void }) {
  const [list, setList] = useState<Gift[] | null>(null);
  useEffect(() => {
    api<Gift[]>("gifts", { min: Math.floor(min * 1.2) + 1, max: Math.floor(min * 50) }).then(setList).catch(() => setList([]));
  }, [min]);
  return (
    <Sheet onClose={onClose}>
      <div class="section-title" style={{ marginTop: 0 }}><h2>Цель</h2><span>шанс под каждым</span></div>
      {!list ? <div class="skeleton" style={{ height: 200 }} /> : list.length === 0 ? <div class="empty">Нет подходящих подарков</div> : (
        <div class="gift-grid" style={{ maxHeight: "60vh", overflowY: "auto", padding: 2 }}>
          {list.map((g) => (
            <button class="gift-card glass" style={{ "--rc": RARITY[g.rarity].color }} onClick={() => { haptic.tick(); onPick(g); }}>
              <GiftArt gift={g} size={56} />
              <div class="g-name">{g.name}</div>
              <div class="g-val num"><Star /> {short(g.value)}</div>
              <div class="g-chance num">{(Math.min((min / g.value) * UPGRADE_RTP, UPGRADE_MAX) * 100).toFixed(1)}%</div>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------- контракт

export function Contract() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [won, setWon] = useState<{ gift: Gift; stake: number } | null>(null);
  const value = items.reduce((s, i) => s + i.value, 0);

  async function sign() {
    setBusy(true);
    haptic.medium();
    try {
      const r = await api<{ gift: Gift; stake_value: number }>("contract", { ids: items.map((i) => i.id) });
      setTimeout(() => {
        haptic.success();
        setWon({ gift: r.gift, stake: r.stake_value });
        setItems([]);
        setBusy(false);
        refreshInventory().catch(() => {});
        refreshProfile().catch(() => {});
      }, 1200);
    } catch (e) {
      haptic.error();
      showToast(errorText(e), "err");
      setBusy(false);
    }
  }

  return (
    <>
      <GameHeader title="Контракт" sub="Приз от ×0,25 до ×5 от стоимости" />
      <div class={`contract-slots glass ${busy ? "signing" : ""}`}>
        {Array.from({ length: 10 }, (_, i) => {
          const g = items[i];
          return (
            <button class="slot" disabled={busy} onClick={() => setPicking(true)}>
              {g ? <GiftArt gift={g} size={44} /> : <span class="dim">+</span>}
            </button>
          );
        })}
      </div>
      <div class="mines-info glass num">
        <div><span class="dim">Подарков</span><b>{items.length}/10</b></div>
        <div><span class="dim">Стоимость</span><b>{short(value)} ★</b></div>
        <div><span class="dim">Возможный приз</span><b>{value ? `${short(value * 0.25)}–${short(value * 5)}` : "—"}</b></div>
      </div>
      <button class="btn" disabled={busy || items.length < 3} onClick={sign}>
        {busy ? "Подписываем" : items.length < 3 ? `Добавьте ещё ${3 - items.length}` : `Подписать контракт · ${fmt(value)} ★`}
      </button>
      {picking && <ItemPicker title="Подарки для контракта" min={0} max={10} onClose={() => setPicking(false)} onDone={(x) => { setItems(x); setPicking(false); }} />}
      {won && <PrizeSheet gift={won.gift} note={`Контракт на ${fmt(won.stake)} ★ исполнен`} onClose={() => setWon(null)} />}
    </>
  );
}

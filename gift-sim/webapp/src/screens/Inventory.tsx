import { stageBg } from "../components/game-ui";
import { useEffect, useState } from "preact/hooks";
import { api, errorText } from "../api";
import { GiftArt } from "../components/GiftArt";
import { GiftLottie } from "../components/Lottie";
import { Ico, Star } from "../components/icons";
import { Sheet } from "../components/ui";
import { fmt, plural, RARITY, short } from "../format";
import { inventory, refreshInventory, setBalance, showToast, tab } from "../state";
import { haptic } from "../tg";
import type { InventoryItem } from "../types";

type History = { points: { t: string; stars: number }[]; change_24h: number | null };

export function Inventory() {
  const inv = inventory.value;
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<InventoryItem | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refreshInventory().catch((e) => showToast(errorText(e), "err"));
  }, []);

  if (!inv) {
    return (
      <>
        <h1>Инвентарь</h1>
        <div class="skeleton" style={{ height: 76, marginBottom: 14 }} />
        <div class="gift-grid">
          {Array.from({ length: 9 }, () => (
            <div class="skeleton" style={{ height: 120 }} />
          ))}
        </div>
      </>
    );
  }

  const selValue = inv.items.filter((i) => selected.has(i.id)).reduce((s, i) => s + i.value, 0);

  async function sell(ids: number[]) {
    if (!ids.length) return;
    setBusy(true);
    try {
      const r = await api<{ balance: number; sold_for: number; sold: number }>("sell", { ids });
      setBalance(r.balance);
      haptic.success();
      showToast(`Продано ${r.sold} ${plural(r.sold, "подарок", "подарка", "подарков")} за ${fmt(r.sold_for)} ★`);
      setSelected(new Set());
      setSelecting(false);
      setOpen(null);
      await refreshInventory();
    } catch (e) {
      haptic.error();
      showToast(errorText(e), "err");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: number) {
    haptic.tick();
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  }

  return (
    <>
      <h1>Инвентарь</h1>
      <div class="inv-head glass stage-bg" style={stageBg("case")}>
        <div style={{ flex: 1 }}>
          <div class="dim" style={{ fontSize: 13 }}>
            Коллекция · {inv.items.length} {plural(inv.items.length, "подарок", "подарка", "подарков")}
          </div>
          <div class="total num">
            <Star size={22} /> {fmt(inv.total_value)}
          </div>
        </div>
        {inv.items.length > 0 && (
          <button
            class="btn secondary small"
            onClick={() => {
              setSelecting(!selecting);
              setSelected(new Set());
            }}
          >
            {selecting ? "Отмена" : "Выбрать"}
          </button>
        )}
      </div>

      {inv.items.length === 0 ? (
        <div class="empty glass">
          <Ico name="tab-inventory" size={96} class="big" />
          <div>Пока пусто — открой первый кейс</div>
          <button class="btn" style={{ marginTop: 16 }} onClick={() => tab({ name: "home" })}>
            Открыть кейс
          </button>
        </div>
      ) : (
        <div class="gift-grid">
          {inv.items.map((g) => {
            const diff = g.value_at_drop ? (g.value - g.value_at_drop) / g.value_at_drop : 0;
            return (
              <button
                class={`gift-card glass ${selected.has(g.id) ? "selected" : ""}`}
                style={{ "--rc": RARITY[g.rarity].color }}
                onClick={() => (selecting ? toggle(g.id) : setOpen(g))}
              >
                {selecting && selected.has(g.id) && <span class="check">✓</span>}
                <GiftArt gift={g} size={64} />
                <div class="g-name">{g.name}</div>
                <div class="g-val num">
                  <Star /> {short(g.value)}
                </div>
                {Math.abs(diff) >= 0.01 && (
                  <div class={`delta ${diff > 0 ? "up" : "down"} num`}>
                    {diff > 0 ? "▲" : "▼"} {Math.abs(diff * 100).toFixed(0)}%
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selecting && selected.size > 0 && (
        <div class="sellbar">
          <button class="btn secondary small" style={{ flex: "none" }} onClick={() => setSelected(new Set(inv.items.map((i) => i.id)))}>
            Все
          </button>
          <button class="btn" style={{ height: 44 }} disabled={busy} onClick={() => sell([...selected])}>
            Продать {selected.size} за {short(selValue)} ★
          </button>
        </div>
      )}

      {open && <GiftSheet item={open} busy={busy} onSell={() => sell([open.id])} onClose={() => setOpen(null)} />}
    </>
  );
}

function GiftSheet({ item, busy, onSell, onClose }: { item: InventoryItem; busy: boolean; onSell: () => void; onClose: () => void }) {
  const [hist, setHist] = useState<History | null>(null);
  useEffect(() => {
    api<History>("gift_history", { id: item.gift_id, days: 7 }).then(setHist).catch(() => {});
  }, [item.gift_id]);

  return (
    <Sheet onClose={onClose}>
      <div class="win" style={{ "--rc": RARITY[item.rarity].color }}>
        <div class="rays" />
        <div class="win-art"><GiftLottie gift={{ ...item, id: item.gift_id }} size={190} /></div>
        <div class="rarity">{RARITY[item.rarity].name}</div>
        <h2>{item.name}</h2>
        <div class="value num" style={{ marginBottom: 8 }}>
          <Star size={20} /> {fmt(item.value)}
          {hist?.change_24h != null && (
            <span class={`delta ${hist.change_24h >= 0 ? "up" : "down"}`} style={{ fontSize: 13 }}>
              {hist.change_24h >= 0 ? "▲" : "▼"} {Math.abs(hist.change_24h).toFixed(1)}% за сутки
            </span>
          )}
        </div>
        <div class="dim num" style={{ fontSize: 12, marginBottom: 10 }}>
          Был при получении: {fmt(item.value_at_drop)} ★
        </div>
      </div>
      <div class="glass" style={{ padding: 12, marginBottom: 14 }}>
        <div class="dim" style={{ fontSize: 12, marginBottom: 6 }}>
          Цена за неделю
        </div>
        <PriceChart points={hist?.points ?? []} />
      </div>
      <button class="btn secondary" disabled={busy} onClick={onSell}>
        Продать за {fmt(item.value)} ★
      </button>
    </Sheet>
  );
}

function PriceChart({ points }: { points: { t: string; stars: number }[] }) {
  if (points.length < 2) {
    return (
      <div class="dim" style={{ height: 120, display: "grid", placeItems: "center", fontSize: 13 }}>
        График появится чуть позже
      </div>
    );
  }
  const W = 320, H = 120, pad = 6;
  const xs = points.map((p) => new Date(p.t).getTime());
  const ys = points.map((p) => p.stars);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const sx = (x: number) => pad + ((x - x0) / (x1 - x0 || 1)) * (W - pad * 2);
  const sy = (y: number) => H - pad - ((y - y0) / (y1 - y0 || 1)) * (H - pad * 2);
  const line = points.map((p, i) => `${i ? "L" : "M"}${sx(xs[i]).toFixed(1)},${sy(p.stars).toFixed(1)}`).join(" ");
  const up = ys[ys.length - 1] >= ys[0];
  const color = up ? "#3ddc97" : "#ff5a6e";
  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="pc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={color} stop-opacity="0.35" />
          <stop offset="1" stop-color={color} stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${sx(x1)},${H} L${sx(x0)},${H} Z`} fill="url(#pc)" />
      <path d={line} fill="none" stroke={color} stroke-width="2" vector-effect="non-scaling-stroke" />
    </svg>
  );
}

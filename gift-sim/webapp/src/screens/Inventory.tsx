import { stageBg } from "../components/game-ui";
import { useEffect, useState } from "preact/hooks";
import { api, errorText } from "../api";
import { GiftArt } from "../components/GiftArt";
import { loadBackdrop, NftAction, NftCard, type Backdrop } from "../components/NftCard";
import { Segmented } from "../components/game-ui";
import { ListPanel } from "./Market";
import { CollectionChips, NftTile } from "../components/NftTile";
import { Ico, Star } from "../components/icons";
import { Sheet } from "../components/ui";
import { fmt, plural, RARITY, short } from "../format";
import { go, inventory, refreshInventory, setBalance, showToast, tab } from "../state";
import { haptic } from "../tg";
import type { InventoryItem } from "../types";

type History = { points: { t: string; stars: number }[]; change_24h: number | null };

type Sort = "price" | "new" | "color";

// «По цвету»: цветные фоны по кругу оттенков (красный → оранжевый → … → розовый), серые и чёрные — в конце по яркости
function sortItems(items: InventoryItem[], sort: Sort, colors: Map<number, Backdrop>) {
  if (sort === "new") return [...items].sort((a, b) => b.obtained_at.localeCompare(a.obtained_at) || b.id - a.id);
  if (sort === "color" && colors.size) {
    const key = (i: InventoryItem) => {
      const c = colors.get(i.id);
      if (!c) return 2000;
      return c.sat < 0.18 ? 1000 + (1 - c.light) * 100 : c.hue;
    };
    return [...items].sort((a, b) => key(a) - key(b) || b.value - a.value);
  }
  return items;
}

export function Inventory() {
  const inv = inventory.value;
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<InventoryItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<Sort>(() => (localStorage.getItem("inv_sort") as Sort) || "price");
  const [colors, setColors] = useState<Map<number, Backdrop>>(new Map());
  const [coll, setColl] = useState<string | null>(null);

  useEffect(() => {
    refreshInventory().catch((e) => showToast(errorText(e), "err"));
  }, []);

  // для сортировки по цвету берём оттенок фона каждого номера из его картинки
  useEffect(() => {
    if (sort !== "color" || !inv) return;
    let live = true;
    Promise.all(inv.items.map((i) => (i.image_url ? loadBackdrop(i.image_url).then((b) => [i.id, b] as const) : null)))
      .then((list) => {
        if (!live) return;
        const m = new Map<number, Backdrop>();
        for (const x of list) if (x?.[1]) m.set(x[0], x[1]);
        setColors(m);
      });
    return () => { live = false; };
  }, [sort, inv]);

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

  const items = sortItems(inv.items, sort, colors);
  const shown = coll ? items.filter((g) => g.gift_id === coll) : items;
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
        <>
        <Segmented
          value={sort}
          onChange={(v) => { setSort(v); localStorage.setItem("inv_sort", v); }}
          options={[{ id: "price", label: "Дороже" }, { id: "new", label: "Новые" }, { id: "color", label: "По цвету" }]}
        />
        <CollectionChips items={inv.items} value={coll} onChange={(v) => { haptic.tick(); setColl(v); }} />
        <div class="nft-grid">
          {shown.map((g) => {
            const diff = g.value_at_drop ? (g.value - g.value_at_drop) / g.value_at_drop : 0;
            return (
              <NftTile
                g={g}
                selected={selected.has(g.id)}
                onClick={() => (selecting ? toggle(g.id) : setOpen(g))}
                badge={Math.abs(diff) >= 0.01 ? <span class={diff > 0 ? "up" : "down"}>{diff > 0 ? "▲" : "▼"} {Math.abs(diff * 100).toFixed(0)}%</span> : undefined}
              >
                {selecting && selected.has(g.id) && <span class="check">✓</span>}
              </NftTile>
            );
          })}
        </div>
        </>
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

  const openGame = (id: "upgrade" | "contract") => { onClose(); go({ name: "game", id }); };
  const [listing, setListing] = useState(false);
  return (
    <Sheet onClose={onClose}>
      <NftCard
        gift={{ ...item, id: item.gift_id }}
        actions={
          <>
            <NftAction icon={<Ico name="fx/coins" size={28} />} label="Продать" disabled={busy} onClick={onSell} />
            <NftAction icon={<Ico name="cat-deals" size={28} />} label="Маркет" onClick={() => setListing(!listing)} />
            <NftAction icon={<Ico name="games/upgrade" size={28} />} label="Апгрейд" onClick={() => openGame("upgrade")} />
            <NftAction icon={<Ico name="games/contract" size={28} />} label="Контракт" onClick={() => openGame("contract")} />
          </>
        }
      >
        {listing && <ListPanel id={item.id} value={item.value} onDone={onClose} />}
        <div class="glass chart-box">
          <div class="chart-head">
            <span class="dim">Цена коллекции за неделю</span>
            {hist?.change_24h != null && (
              <span class={`delta ${hist.change_24h >= 0 ? "up" : "down"}`}>
                {hist.change_24h >= 0 ? "▲" : "▼"} {Math.abs(hist.change_24h).toFixed(1)}% за сутки
              </span>
            )}
          </div>
          <PriceChart points={hist?.points ?? []} />
          <div class="dim num" style={{ fontSize: 12, marginTop: 6 }}>При получении: {fmt(item.value_at_drop)} ★</div>
        </div>
        <button class="btn secondary" disabled={busy} onClick={onSell}>
          Продать за {fmt(item.value)} ★
        </button>
      </NftCard>
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

import { useEffect, useState } from "preact/hooks";
import { api, errorText } from "../api";
import { GameHeader, Segmented } from "../components/game-ui";
import { GiftArt } from "../components/GiftArt";
import { Star } from "../components/icons";
import { NftCard } from "../components/NftCard";
import { NftTile } from "../components/NftTile";
import { Sheet } from "../components/ui";
import { ago, fmt, RARITY, short } from "../format";
import { go, profile, refreshInventory, setBalance, showToast } from "../state";
import { sound } from "../sound";
import { haptic } from "../tg";
import type { Gift } from "../types";

// Маркет между игроками: витрина лотов и «Мои лоты».

export type Lot = Gift & {
  lot_id: number;
  price: number;
  mine: boolean;
  status: string;
  listed_at: string;
  closed_at: string | null;
  seller: { user: string; id: string };
};
type Lots = { lots: Lot[]; total: number; collections: (Gift & { n: number; floor: number })[] };
type My = { active: Lot[]; sold: Lot[]; earned: number; fee: number };
type Sort = "price" | "price_desc" | "new";

export function Market() {
  const [view, setView] = useState<"shop" | "mine">("shop");
  return (
    <>
      <GameHeader title="Маркет" sub="Подарки от игроков · продавец получает 95%" />
      <Segmented value={view} onChange={setView} options={[{ id: "shop", label: "Витрина" }, { id: "mine", label: "Мои лоты" }]} />
      {view === "shop" ? <Shop /> : <Mine />}
    </>
  );
}

function Shop() {
  const [gift, setGift] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("price");
  const [data, setData] = useState<Lots | null>(null);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<Lot | null>(null);

  const load = (offset = 0) =>
    api<Lots>("market", { gift, sort, offset })
      .then((d) => setData((prev) => (offset && prev ? { ...d, lots: [...prev.lots, ...d.lots] } : d)))
      .catch((e) => showToast(errorText(e), "err"));

  useEffect(() => {
    setData(null);
    load();
  }, [gift, sort]);

  return (
    <>
      {data && data.collections.length > 1 && (
        <div class="chips coll-chips">
          <button class={`chip ${gift === null ? "active" : ""}`} onClick={() => setGift(null)}>Все · {data.collections.reduce((s, c) => s + c.n, 0)}</button>
          {data.collections.map((c) => (
            <button class={`chip ${gift === c.id ? "active" : ""}`} onClick={() => { haptic.tick(); setGift(gift === c.id ? null : c.id); }}>
              <GiftArt gift={c} size={22} />
              {c.name}
              <span class="chip-n">от {short(c.floor)}</span>
            </button>
          ))}
        </div>
      )}
      <Segmented value={sort} onChange={setSort} options={[{ id: "price", label: "Дешевле" }, { id: "price_desc", label: "Дороже" }, { id: "new", label: "Новые" }]} />

      {!data ? (
        <div class="nft-grid">{Array.from({ length: 9 }, () => <div class="skeleton" style={{ aspectRatio: "1" }} />)}</div>
      ) : data.lots.length === 0 ? (
        <div class="empty glass">Лотов пока нет — выставь свой подарок из инвентаря</div>
      ) : (
        <>
          <div class="nft-grid">
            {data.lots.map((l) => (
              <NftTile g={{ ...l, value: l.price }} badge={l.mine ? "мой" : undefined} onClick={() => { haptic.tap(); setOpen(l); }} />
            ))}
          </div>
          {data.lots.length < data.total && (
            <button class="btn secondary" style={{ marginTop: 12 }} disabled={more}
              onClick={async () => { setMore(true); await load(data.lots.length); setMore(false); }}>
              Показать ещё · {data.total - data.lots.length}
            </button>
          )}
        </>
      )}

      {open && <LotSheet lot={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); load(); }} />}
    </>
  );
}

export function LotSheet({ lot, onClose, onDone }: { lot: Lot; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const balance = profile.value?.balance ?? 0;
  const diff = lot.value ? lot.price / lot.value - 1 : 0;

  async function buy() {
    setBusy(true);
    try {
      const r = await api<{ balance: number; price: number }>("market_buy", { lot: lot.lot_id });
      setBalance(r.balance);
      haptic.success();
      sound.win(lot.rarity);
      showToast("Подарок в инвентаре");
      refreshInventory().catch(() => {});
      onDone();
    } catch (e) {
      haptic.error();
      showToast(errorText(e), "err");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await api("market_cancel", { lot: lot.lot_id });
      haptic.tap();
      showToast("Снято с продажи — подарок снова в инвентаре");
      refreshInventory().catch(() => {});
      onDone();
    } catch (e) {
      showToast(errorText(e), "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={onClose}>
      <NftCard gift={lot}>
        <div class="lot-info glass">
          <div>
            <span class="dim">Цена лота</span>
            <b class="num"><Star size={18} /> {fmt(lot.price)}</b>
          </div>
          <div>
            <span class="dim">к Fragment</span>
            <b class={`num ${diff > 0.005 ? "down" : diff < -0.005 ? "up" : ""}`}>{diff >= 0 ? "+" : ""}{(diff * 100).toFixed(0)}%</b>
          </div>
          <div>
            <span class="dim">Продавец</span>
            <button class="link" onClick={() => { onClose(); go({ name: "player", id: lot.seller.id }); }}>{lot.seller.user}</button>
          </div>
        </div>
        {lot.mine ? (
          <button class="btn secondary" disabled={busy} onClick={cancel}>Снять с продажи</button>
        ) : (
          <button class="btn gold" disabled={busy || balance < lot.price} onClick={buy}>
            {balance < lot.price ? `Не хватает ${fmt(lot.price - balance)} ★` : `Купить за ${fmt(lot.price)} ★`}
          </button>
        )}
      </NftCard>
    </Sheet>
  );
}

function Mine() {
  const [d, setD] = useState<My | null>(null);
  const [open, setOpen] = useState<Lot | null>(null);
  const load = () => api<My>("market_my").then(setD).catch((e) => showToast(errorText(e), "err"));
  useEffect(() => { load(); }, []);
  if (!d) return <div class="skeleton" style={{ height: 240 }} />;
  return (
    <>
      <div class="lot-info glass" style={{ marginBottom: 12 }}>
        <div><span class="dim">На продаже</span><b class="num">{fmt(d.active.length)}</b></div>
        <div><span class="dim">Продано</span><b class="num">{fmt(d.sold.length)}</b></div>
        <div><span class="dim">Заработано</span><b class="num"><Star size={16} /> {short(d.earned)}</b></div>
      </div>
      {d.active.length === 0 ? (
        <div class="empty glass" style={{ padding: "28px 20px" }}>Выставь подарок: открой его в инвентаре и нажми «Маркет»</div>
      ) : (
        <div class="nft-grid">
          {d.active.map((l) => <NftTile g={{ ...l, value: l.price }} onClick={() => setOpen(l)} />)}
        </div>
      )}
      {d.sold.length > 0 && (
        <>
          <div class="section-title"><h2>Продано</h2></div>
          {d.sold.map((l) => (
            <div class="win-row glass" style={{ "--rc": RARITY[l.rarity].color }}>
              <GiftArt gift={l} size={40} />
              <div class="t-body">
                <b>{l.name}{l.num ? ` #${fmt(l.num)}` : ""}</b>
                <span>продан {l.closed_at ? ago(l.closed_at) : ""}</span>
              </div>
              <b class="num up">+{short(Math.floor(l.price * (1 - d.fee)))}</b>
            </div>
          ))}
        </>
      )}
      {open && <LotSheet lot={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); load(); }} />}
    </>
  );
}

// Выставить свой подарок: цена от 50% до 500% от цены Fragment.
export function ListPanel({ id, value, onDone }: { id: number; value: number; onDone: () => void }) {
  const min = Math.ceil(value * 0.5), max = Math.floor(value * 5);
  const [price, setPrice] = useState(Math.round(value * 1.1));
  const [busy, setBusy] = useState(false);
  const set = (v: number) => { haptic.tick(); setPrice(Math.min(max, Math.max(min, Math.round(v)))); };

  async function list() {
    setBusy(true);
    try {
      await api("market_list", { id, price });
      haptic.success();
      showToast("Выставлено на маркет");
      refreshInventory().catch(() => {});
      onDone();
    } catch (e) {
      haptic.error();
      showToast(errorText(e), "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="list-panel glass">
      <div class="dim" style={{ fontSize: 13, marginBottom: 8 }}>Цена на маркете (от {short(min)} до {short(max)} ★)</div>
      <label class="bet-input">
        <Star size={18} />
        <input class="num" type="number" inputMode="numeric" value={price}
          onInput={(e) => setPrice(Math.max(0, Math.floor(Number((e.target as HTMLInputElement).value) || 0)))} />
      </label>
      <div class="bet-quick" style={{ marginTop: 8 }}>
        <button onClick={() => set(value * 0.9)}>−10%</button>
        <button onClick={() => set(value)}>Fragment</button>
        <button onClick={() => set(value * 1.25)}>+25%</button>
        <button onClick={() => set(value * 2)}>×2</button>
      </div>
      <div class="dim num" style={{ fontSize: 13, margin: "10px 0" }}>
        Получишь {fmt(Math.floor(price * 0.95))} ★ после продажи (комиссия 5%)
      </div>
      <button class="btn" disabled={busy || price < min || price > max} onClick={list}>Выставить за {fmt(price)} ★</button>
    </div>
  );
}

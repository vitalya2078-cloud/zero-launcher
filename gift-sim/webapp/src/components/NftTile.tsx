import type { ComponentChildren } from "preact";
import { fmt, short } from "../format";
import type { Gift } from "../types";
import { GiftArt } from "./GiftArt";
import { Star } from "./icons";

// подходит и подарок из каталога (id — строка), и запись инвентаря (id — число, коллекция в gift_id)
type TileGift = Omit<Gift, "id"> & { id: string | number; gift_id?: string };

// Плитка подарка как в профиле Telegram: картинка номера на всю плитку (свой фон и узор),
// номер — на ленточке в правом верхнем углу, цена — плашкой снизу.
export function NftTile({ g, onClick, selected, badge, children }: {
  g: TileGift;
  onClick?: () => void;
  selected?: boolean;
  badge?: ComponentChildren;
  children?: ComponentChildren;
}) {
  return (
    <button class={`nft-tile ${selected ? "selected" : ""} ${g.kind !== "nft" ? "plain" : ""}`} onClick={onClick}>
      <GiftArt gift={g} size={160} />
      {g.num ? <span class="ribbon num">#{fmt(g.num)}</span> : null}
      {badge && <span class="tile-badge">{badge}</span>}
      <span class="tile-price num"><Star /> {short(g.value)}</span>
      {children}
    </button>
  );
}

// Фильтр по коллекциям («Все подарки», «Носки», «Банка»…), как над сеткой подарков в Telegram.
export function CollectionChips<T extends TileGift>({ items, value, onChange }: {
  items: T[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const groups = new Map<string, { g: T; n: number }>();
  for (const it of items) {
    const id = it.gift_id ?? String(it.id);
    const cur = groups.get(id);
    if (cur) cur.n++;
    else groups.set(id, { g: it, n: 1 });
  }
  if (groups.size < 2) return null;
  const list = [...groups.entries()].sort((a, b) => b[1].n - a[1].n || b[1].g.value - a[1].g.value);
  return (
    <div class="chips coll-chips">
      <button class={`chip ${value === null ? "active" : ""}`} onClick={() => onChange(null)}>Все подарки</button>
      {list.map(([id, { g, n }]) => (
        <button class={`chip ${value === id ? "active" : ""}`} onClick={() => onChange(value === id ? null : id)}>
          <GiftArt gift={g} size={22} />
          {g.name}
          {n > 1 && <span class="chip-n">{n}</span>}
        </button>
      ))}
    </div>
  );
}

import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { inventory, profile, refreshInventory } from "../state";
import { fmt, RARITY, short } from "../format";
import { haptic } from "../tg";
import type { Gift, InventoryItem } from "../types";
import { GiftArt } from "./GiftArt";
import { NftCard } from "./NftCard";
import { Star } from "./icons";
import { Sheet } from "./ui";
import { tf, toStars, ts } from "../money";

// Фон игрового поля: картинка из public/bg под затемняющим градиентом.
// Задаётся inline-стилем, чтобы относительный путь считался от страницы, а не от CSS-файла.
export const stageBg = (name: string) => ({
  backgroundImage: `linear-gradient(180deg, rgba(7, 11, 24, 0.3), rgba(7, 11, 24, 0.6)), url(./bg/${name}.webp)`,
});

// Поле суммы в TON: печатаем в TON (с запятой или точкой), наружу отдаём звёзды.
export function TonInput({ value, onChange, disabled }: { value: number; onChange: (stars: number) => void; disabled?: boolean }) {
  const [text, setText] = useState(() => tf(value).replace(/\s/g, ""));
  // внешнее изменение (½, ×2, быстрые кнопки) — обновляем текст, если он означает другую сумму
  useEffect(() => {
    const cur = Number(text.replace(",", ".")) || 0;
    if (toStars(cur) !== value) setText(tf(value).replace(/\s/g, ""));
  }, [value]);
  return (
    <input
      class="num"
      type="text"
      inputMode="decimal"
      value={text}
      disabled={disabled}
      onInput={(e) => {
        const t = (e.target as HTMLInputElement).value.replace(/[^\d.,]/g, "");
        setText(t);
        onChange(Math.max(0, toStars(Number(t.replace(",", ".")) || 0)));
      }}
    />
  );
}

// Поле ставки с быстрыми кнопками.
export function BetInput({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const balance = profile.value?.balance ?? 0;
  const set = (v: number) => {
    haptic.tick();
    onChange(Math.max(10, Math.min(Math.floor(v), Math.max(10, balance))));
  };
  return (
    <div class="bet glass">
      <div class="bet-row">
        <button class="bet-btn" disabled={disabled} onClick={() => set(value / 2)}>½</button>
        <label class="bet-input">
          <Star size={18} />
          <TonInput value={value} onChange={onChange} disabled={disabled} />
        </label>
        <button class="bet-btn" disabled={disabled} onClick={() => set(value * 2)}>×2</button>
      </div>
      <div class="bet-quick">
        {[1, 5, 10, 50].map((t) => (
          <button disabled={disabled} onClick={() => set(toStars(t))}>{t}</button>
        ))}
        <button disabled={disabled} onClick={() => set(balance)}>Макс</button>
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, disabled }: {
  value: T;
  options: { id: T; label: ComponentChildren }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div class="seg glass">
      {options.map((o) => (
        <button
          class={value === o.id ? "on" : ""}
          disabled={disabled}
          onClick={() => {
            haptic.tick();
            onChange(o.id);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function GameHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ margin: "6px 2px 14px" }}>
      <h1 style={{ margin: 0 }}>{title}</h1>
      {sub && <div class="dim" style={{ fontSize: 13, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// Итог мгновенной игры.
export function ResultLine({ payout, bet, multiplier }: { payout: number; bet: number; multiplier: number }) {
  const win = payout > bet;
  return (
    <div class={`result-line ${win ? "win" : payout > 0 ? "" : "lose"}`}>
      {win && <img class="result-coins" src="./fx/coins.webp" alt="" />}
      <b class="num">×{Number(multiplier).toFixed(2)}</b>
      <span class="num">{payout > 0 ? `+${tf(payout)} TON` : `−${tf(bet)} TON`}</span>
    </div>
  );
}

// Выбор подарков из инвентаря (апгрейд, контракт, джекпот).
export function ItemPicker({ title, max, min = 1, exclude = [], onDone, onClose, footer }: {
  title: string;
  max: number;
  min?: number;
  exclude?: number[];
  onDone: (items: InventoryItem[]) => void;
  onClose: () => void;
  footer?: (items: InventoryItem[]) => ComponentChildren;
}) {
  const [sel, setSel] = useState<number[]>([]);
  useEffect(() => {
    refreshInventory().catch(() => {});
  }, []);
  const items = (inventory.value?.items ?? []).filter((i) => !exclude.includes(i.id));
  const chosen = items.filter((i) => sel.includes(i.id));
  return (
    <Sheet onClose={onClose}>
      <div class="section-title" style={{ marginTop: 0 }}>
        <h2>{title}</h2>
        <span class="num">{sel.length}/{max}</span>
      </div>
      {items.length === 0 ? (
        <div class="empty">Подарков пока нет — открой кейс</div>
      ) : (
        <div class="gift-grid" style={{ maxHeight: "52vh", overflowY: "auto", padding: 2 }}>
          {items.map((g) => {
            const on = sel.includes(g.id);
            return (
              <button
                class={`gift-card glass ${on ? "selected" : ""}`}
                style={{ "--rc": RARITY[g.rarity].color }}
                onClick={() => {
                  haptic.tick();
                  setSel(on ? sel.filter((x) => x !== g.id) : sel.length < max ? [...sel, g.id] : sel);
                }}
              >
                {on && <span class="check">✓</span>}
                <GiftArt gift={g} size={56} />
                <div class="g-name">{g.name}</div>
                <div class="g-val num"><Star /> {ts(g.value)}</div>
              </button>
            );
          })}
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        {footer?.(chosen)}
        <button class="btn" disabled={sel.length < min} onClick={() => onDone(chosen)}>
          Выбрать {sel.length > 0 ? `· ${ts(chosen.reduce((s, i) => s + i.value, 0))} TON` : ""}
        </button>
      </div>
    </Sheet>
  );
}

// Окно с выигранным подарком.
export function PrizeSheet({ gift, title, note, onClose }: { gift: Gift; title?: string; note?: string; onClose: () => void }) {
  if (gift.kind === "nft") {
    return (
      <Sheet onClose={onClose}>
        <NftCard gift={gift}>
          {note && <div class="dim" style={{ textAlign: "center", marginBottom: 12, fontSize: 13 }}>{note}</div>}
          <button class="btn" onClick={onClose}>Забрать</button>
        </NftCard>
      </Sheet>
    );
  }
  return (
    <Sheet onClose={onClose}>
      <div class="win" style={{ "--rc": RARITY[gift.rarity].color }}>
        <div class="rays" />
        <img class="win-sparkle" src="./fx/sparkle.webp" alt="" />
        <div class="win-art"><GiftArt gift={gift} size={180} /></div>
        <div class="rarity">{RARITY[gift.rarity].name}</div>
        <h2>{title ?? gift.name}</h2>
        <div class="value num"><Star size={20} /> {tf(gift.value)}</div>
        {note && <div class="dim" style={{ marginTop: -10, marginBottom: 14, fontSize: 13 }}>{note}</div>}
        <button class="btn" onClick={onClose}>Забрать</button>
      </div>
    </Sheet>
  );
}

export function SmallGift({ g }: { g: Gift }) {
  return (
    <span class="small-gift" style={{ "--rc": RARITY[g.rarity].color }} title={g.name}>
      <GiftArt gift={g} size={34} />
    </span>
  );
}

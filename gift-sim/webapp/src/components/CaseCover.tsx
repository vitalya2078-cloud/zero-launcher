import type { Gift } from "../types";
import { GiftArt } from "./GiftArt";

// Обложка кейса: своя картинка по названию; «охота за подарком» — открытая шкатулка с NFT на постаменте,
// цвет шкатулки — по цене главного приза. Неизвестные (кастомные из админки) — обложка «Акция».
const BY_NAME: Record<string, string> = {
  "Бюджетный": "budget", "Стартовый": "starter", "Праздничный": "holiday", "Коллекционер": "collector",
  "Редкости": "rare", "Легенды": "legends", "Plush Pepe": "top", "Бесплатный": "free",
  "Любовь": "love", "Новый год": "newyear", "Мистика": "mystic", "Сладости": "sweets", "Роскошь": "luxury",
  "Звёзды": "stars", "Животные": "animals", "Космос": "space", "Герои": "heroes", "Чемпионы": "champions",
  "Дуров": "durov", "Реферальный I": "ref1", "Реферальный II": "ref2", "Реферальный III": "ref3",
};

const huntBox = (v: number) => (v < 10_000 ? "hunt-blue" : v < 50_000 ? "hunt-purple" : v < 200_000 ? "hunt-gold" : "hunt-red");

export function CaseCover({ name, category, cover, size }: { name: string; category: string; cover: Gift | null; size: number }) {
  const hunt = category === "gift" && cover;
  const file = hunt ? huntBox(cover.value) : BY_NAME[name] ?? "promo";
  return (
    <span class={`case-cover ${hunt ? "hunt" : ""}`} style={{ width: size, height: size }}>
      <img class="box" src={`./cases/${file}.webp`} alt="" draggable={false} decoding="async" />
      {hunt && (
        <span class="hunt-gift" style={{ width: Math.round(size * 0.46), height: Math.round(size * 0.46) }}>
          <GiftArt gift={cover} size={Math.round(size * 0.46)} />
        </span>
      )}
    </span>
  );
}

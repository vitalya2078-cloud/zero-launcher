import { useState } from "preact/hooks";
import type { Gift } from "../types";
import { Ico, KeyIcon, Star } from "./icons";

// Картинка приза: NFT — изображение с Fragment; звёзды — большая звезда с суммой; ключ — иконка.
export function GiftArt({ gift, size = 64 }: { gift: Pick<Gift, "kind" | "image_url" | "name" | "value">; size?: number }) {
  const [broken, setBroken] = useState(false);

  if (gift.kind === "stars") {
    // сумма всегда подписана рядом (в карточке, ленте, окне выигрыша), поэтому на звезде её не дублируем
    return (
      <span class="art" style={{ width: size, height: size }}>
        <Star size={size * 0.86} />
      </span>
    );
  }
  if (gift.kind === "key") {
    return (
      <span class="art" style={{ width: size, height: size }}>
        <KeyIcon size={size * 0.8} />
      </span>
    );
  }
  if (!gift.image_url || broken) {
    return (
      <span class="art" style={{ width: size, height: size }}>
        <Ico name="cat-special" size={size * 0.8} />
      </span>
    );
  }
  return (
    <img
      src={gift.image_url}
      alt={gift.name}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setBroken(true)}
    />
  );
}

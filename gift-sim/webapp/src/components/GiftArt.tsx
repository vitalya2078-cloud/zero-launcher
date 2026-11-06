import { useEffect, useState } from "preact/hooks";
import type { Gift } from "../types";
import { Ico, KeyIcon } from "./icons";

// Картинка приза: NFT — изображение с Fragment; приз-валюта (kind = stars) — значок TON; ключ — иконка.
export function GiftArt({ gift, size = 64 }: { gift: Pick<Gift, "kind" | "image_url" | "name" | "value">; size?: number }) {
  // 0 — картинка номера, 1 — запасная картинка коллекции (#2), 2 — заглушка
  const [fail, setFail] = useState(0);
  useEffect(() => setFail(0), [gift.image_url]);

  if (gift.kind === "stars") {
    // сумма всегда подписана рядом (в карточке, ленте, окне выигрыша), поэтому на звезде её не дублируем
    return (
      <span class="art" style={{ width: size, height: size }}>
        <img class="tg-star" src="./icons/ton.svg" alt="TON" style={{ width: size * 0.8, height: size * 0.8 }} draggable={false} />
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
  const src = fail === 0 ? gift.image_url : fail === 1 ? gift.image_url?.replace(/-\d+\.webp$/, "-2.webp") : null;
  if (!src || (fail === 1 && src === gift.image_url)) {
    return (
      <span class="art" style={{ width: size, height: size }}>
        <Ico name="cat-special" size={size * 0.8} />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={gift.name}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFail((f) => f + 1)}
    />
  );
}

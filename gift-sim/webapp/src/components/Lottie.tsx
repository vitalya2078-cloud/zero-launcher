import { useEffect, useRef, useState } from "preact/hooks";
import type { Gift } from "../types";
import { GiftArt } from "./GiftArt";

// Живая анимация подарка (lottie с Fragment). Пока грузится — показываем картинку.
// Библиотека подгружается лениво, только когда анимация реально нужна.
const cache = new Map<string, Promise<object>>();

function loadJson(url: string) {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => r.json()));
  return cache.get(url)!;
}

export function GiftLottie({ gift, size = 200 }: { gift: Gift; size?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!gift.animation_url || gift.kind !== "nft") return;
    let anim: { destroy(): void } | undefined;
    let cancelled = false;
    Promise.all([import("lottie-web/build/player/lottie_light"), loadJson(gift.animation_url)])
      .then(([mod, data]) => {
        if (cancelled || !box.current) return;
        anim = mod.default.loadAnimation({
          container: box.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: data,
        });
        setReady(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, [gift.animation_url]);

  return (
    <div class="lottie" style={{ width: size, height: size, position: "relative", margin: "0 auto" }}>
      <div ref={box} style={{ width: "100%", height: "100%" }} />
      {!ready && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <GiftArt gift={gift} size={size} />
        </div>
      )}
    </div>
  );
}

import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { api } from "../api";
import { fmt } from "../format";
import type { Gift } from "../types";
import { Star } from "./icons";
import { GiftLottie } from "./Lottie";
import { tf, ts } from "../money";

// Окно NFT-подарка как в Telegram: фон и узор конкретного номера, анимация модели,
// «Название #номер», модель под ним и таблица атрибутов с редкостью.

export type NftGift = Gift & { num?: number | null; gift_id?: string };

type Attrs = {
  found: boolean;
  model: string | null;
  model_rarity: number | null;
  backdrop: string | null;
  backdrop_rarity: number | null;
  symbol: string | null;
  symbol_rarity: number | null;
};

const attrsCache = new Map<string, Promise<Attrs | null>>();
function loadAttrs(gift: string, num: number) {
  const key = `${gift}-${num}`;
  if (!attrsCache.has(key)) {
    const p = api<Attrs | null>("nft_info", { gift, num }).catch(() => null);
    attrsCache.set(key, p);
    // «не найдено» не держим в кэше: t.me мог просто не ответить
    p.then((a) => { if (!a?.found) attrsCache.delete(key); });
  }
  return attrsCache.get(key)!;
}

// Цвета фона номера берём из его картинки: края — цвет по краям, середина — продолжение к центру.
export type Backdrop = { center: string; edge: string; hue: number; sat: number; light: number };
const bdCache = new Map<string, Promise<Backdrop | null>>();
export function loadBackdrop(url: string) {
  if (!bdCache.has(url)) {
    bdCache.set(url, new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = c.height = 32;
          const g = c.getContext("2d", { willReadFrequently: true })!;
          g.drawImage(img, 0, 0, 32, 32);
          const px = (x: number, y: number) => g.getImageData(x, y, 1, 1).data;
          const avg = (pts: [number, number][]) => {
            const s = [0, 0, 0];
            for (const [x, y] of pts) { const d = px(x, y); s[0] += d[0]; s[1] += d[1]; s[2] += d[2]; }
            return s.map((v) => v / pts.length);
          };
          const edge = avg([[1, 1], [30, 1], [1, 30], [30, 30], [2, 2], [29, 2], [2, 29], [29, 29]]);
          const mid = avg([[6, 16], [25, 16], [16, 3], [7, 8], [24, 8]]);
          const center = mid.map((m, i) => Math.max(0, Math.min(255, m + (m - edge[i]) * 0.9)));
          const rgb = (a: number[]) => `rgb(${a.map((v) => Math.round(v)).join(",")})`;
          resolve({ center: rgb(center), edge: rgb(edge), ...hsl(mid) });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    }));
  }
  return bdCache.get(url)!;
}

// оттенок фона — для сортировки коллекции «по цвету»
function hsl([r, g, b]: number[]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, light = (max + min) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * light - 1));
  let hue = 0;
  if (d) hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { hue: (hue * 60 + 360) % 360, sat, light };
}

const pct = (v: number | null) => (v == null ? "" : `${String(v).replace(".", ",")}%`);

export function NftCard({ gift, actions, children }: { gift: NftGift; actions?: ComponentChildren; children?: ComponentChildren }) {
  const giftId = gift.gift_id ?? gift.id;
  const num = gift.num ?? null;
  const [attrs, setAttrs] = useState<Attrs | null | undefined>(num ? undefined : null);
  const [bd, setBd] = useState<Backdrop | null>(null);

  useEffect(() => {
    if (!num) return;
    let live = true;
    loadAttrs(giftId, num).then((a) => live && setAttrs(a));
    return () => { live = false; };
  }, [giftId, num]);

  useEffect(() => {
    if (!gift.image_url) return;
    let live = true;
    loadBackdrop(gift.image_url).then((b) => live && setBd(b));
    return () => { live = false; };
  }, [gift.image_url]);

  const heroBg = bd
    ? `radial-gradient(120% 90% at 50% 34%, ${bd.center} 0%, ${bd.edge} 78%)`
    : "radial-gradient(120% 90% at 50% 34%, #3b4a8a 0%, #151b3a 78%)";

  return (
    <div class="nft-card">
      <div class="nft-hero" style={{ background: heroBg }}>
        <div class="nft-anim">
          <GiftLottie gift={{ ...gift, id: giftId }} size={250} />
        </div>
        <h2 class="nft-title">
          {gift.name}
          {num && <span class="num"> #{fmt(num)}</span>}
        </h2>
        <div class="nft-model">{attrs?.model ?? (attrs === undefined ? " " : "")}</div>
        {actions && <div class="nft-actions">{actions}</div>}
      </div>

      <div class="nft-table">
        {num && (
          attrs === undefined ? (
            <>
              <Row k="Модель"><span class="skeleton-line" /></Row>
              <Row k="Узор"><span class="skeleton-line" /></Row>
              <Row k="Фон"><span class="skeleton-line" /></Row>
            </>
          ) : attrs?.found ? (
            <>
              <Row k="Модель">{attrs.model} <mark>{pct(attrs.model_rarity)}</mark></Row>
              <Row k="Узор">{attrs.symbol} <mark>{pct(attrs.symbol_rarity)}</mark></Row>
              <Row k="Фон">{attrs.backdrop} <mark>{pct(attrs.backdrop_rarity)}</mark></Row>
            </>
          ) : (
            <Row k="Атрибуты"><span class="dim">не удалось загрузить</span></Row>
          )
        )}
        <Row k="Ценность"><span class="num">~{tf(gift.value)}</span> <Star /></Row>
      </div>
      {children}
    </div>
  );
}

function Row({ k, children }: { k: string; children: ComponentChildren }) {
  return (
    <div class="nft-row">
      <div class="nft-k">{k}</div>
      <div class="nft-v">{children}</div>
    </div>
  );
}

// Кнопка в стиле Telegram внутри цветной шапки
export function NftAction({ icon, label, onClick, disabled }: { icon: ComponentChildren; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button class="nft-action" onClick={onClick} disabled={disabled}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

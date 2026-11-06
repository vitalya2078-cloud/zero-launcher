// Деньги в интерфейсе показываем в TON, а внутри (сервер, ставки, история) всё по-прежнему в звёздах.
// Курс — с Fragment (1000 звёзд = N TON), сервер обновляет его вместе с ценами и отдаёт в профиле.

import { signal } from "@preact/signals";

export const starsPerTon = signal(81.97);

export const toTon = (stars: number) => stars / starsPerTon.value;
export const toStars = (ton: number) => Math.round(ton * starsPerTon.value);

const nf = (d: number) => new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: d });

// полная сумма: 12 345 · 123,4 · 12,35 · 0,123
export function tf(stars: number): string {
  const v = toTon(stars);
  const a = Math.abs(v);
  return nf(a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3).format(v);
}

// компактная: 1,2M · 12,3K · 123 · 4,56 · 0,12
export function ts(stars: number): string {
  const v = toTon(stars);
  const a = Math.abs(v);
  if (a >= 1e6) return nf(1).format(v / 1e6) + "M";
  if (a >= 1e4) return nf(a >= 1e5 ? 0 : 1).format(v / 1e3) + "K";
  return nf(a >= 100 ? 0 : a >= 1 ? 2 : 2).format(v);
}

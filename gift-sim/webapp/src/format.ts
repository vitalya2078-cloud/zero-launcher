import type { Rarity } from "./types";

const nf = new Intl.NumberFormat("ru-RU");
export const fmt = (n: number) => nf.format(Math.round(n));

// 1 234 → «1,2K»: для тесных мест
export function short(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(".", ",") + "M";
  if (n >= 10_000) return Math.round(n / 1000) + "K";
  if (n >= 1_000) return (n / 1000).toFixed(1).replace(".", ",") + "K";
  return String(Math.round(n));
}

export function chance(p: number): string {
  if (p >= 10) return p.toFixed(1) + "%";
  if (p >= 1) return p.toFixed(2) + "%";
  if (p >= 0.01) return p.toFixed(2) + "%";
  return "<0.01%";
}

export const RARITY: Record<Rarity, { name: string; color: string }> = {
  common: { name: "Обычный", color: "#8E9AB5" },
  rare: { name: "Редкий", color: "#3D9BFF" },
  epic: { name: "Эпический", color: "#A86BFF" },
  legendary: { name: "Легендарный", color: "#FFB547" },
  mythic: { name: "Мифический", color: "#FF5A6E" },
};

export function timeLeft(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return h > 0 ? `${h}ч ${String(m).padStart(2, "0")}м` : `${m}:${String(s).padStart(2, "0")}`;
}

// «5 мин назад», «2 ч назад»…
export function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "только что";
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
  const d = Math.floor(s / 86400);
  return `${d} ${plural(d, "день", "дня", "дней")} назад`;
}

export const SOURCE: Record<string, string> = {
  case: "Кейс",
  upgrade: "Апгрейд",
  contract: "Контракт",
  jackpot: "Джекпот",
  battle: "Битва",
};

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

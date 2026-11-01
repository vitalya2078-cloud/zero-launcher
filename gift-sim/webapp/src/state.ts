import { signal } from "@preact/signals";
import { api } from "./api";
import type { InventoryItem, Profile } from "./types";

// Глобальное состояние приложения.
export const profile = signal<Profile | null>(null);
export const inventory = signal<{ items: InventoryItem[]; total_value: number } | null>(null);
export const toast = signal<{ text: string; kind: "ok" | "err" } | null>(null);

export type Route =
  | { name: "home" }
  | { name: "games" }
  | { name: "inventory" }
  | { name: "profile" }
  | { name: "case"; id: string }
  | { name: "game"; id: GameId }
  | { name: "top" }
  | { name: "player"; id: string };

export type GameId = "crash" | "upgrade" | "contract" | "mines" | "wheel" | "plinko" | "coinflip" | "jackpot" | "battles";

export const route = signal<Route>({ name: "home" });
export const history: Route[] = [];

export function go(r: Route) {
  history.push(route.value);
  route.value = r;
  window.scrollTo(0, 0);
}

export function back() {
  route.value = history.pop() ?? { name: "home" };
}

export function tab(r: Route) {
  history.length = 0;
  route.value = r;
  window.scrollTo(0, 0);
}

let toastTimer: number | undefined;
export function showToast(text: string, kind: "ok" | "err" = "ok") {
  toast.value = { text, kind };
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.value = null), 2600);
}

export function setBalance(balance: number) {
  if (profile.value) profile.value = { ...profile.value, balance };
}

export async function refreshProfile() {
  profile.value = await api<Profile>("profile");
}

export async function refreshInventory() {
  inventory.value = await api("inventory");
}

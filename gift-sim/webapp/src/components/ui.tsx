import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { profile, route, tab, toast, type Route } from "../state";
import { fmt } from "../format";
import { haptic } from "../tg";
import { Ico, KeyIcon, Star } from "./icons";
import { tf, ts } from "../money";

export function Sheet({ onClose, children }: { onClose: () => void; children: ComponentChildren }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);
  return (
    <>
      <div class="sheet-backdrop" onClick={onClose} />
      <div class="sheet" role="dialog">
        <div class="grip" />
        {children}
      </div>
    </>
  );
}

export function TopBar() {
  const p = profile.value;
  return (
    <div class="topbar">
      <div class="brand">
        FORTUM DROPS
        <small>КЕЙСЫ · ИГРЫ</small>
      </div>
      <div class="spacer" />
      {p && p.referral_keys > 0 && (
        <div class="keys-pill glass num">
          <KeyIcon size={15} />
          {p.referral_keys}
        </div>
      )}
      <div class="balance glass num">
        <Star size={18} />
        {p ? tf(p.balance) : "…"}
      </div>
    </div>
  );
}

const TABS: { route: Route; label: string; icon: string }[] = [
  { route: { name: "home" }, label: "Главная", icon: "tab-home" },
  { route: { name: "games" }, label: "Игры", icon: "tab-games" },
  { route: { name: "market" }, label: "Маркет", icon: "fx/coins" },
  { route: { name: "inventory" }, label: "Инвентарь", icon: "tab-inventory" },
  { route: { name: "profile" }, label: "Профиль", icon: "tab-profile" },
];

export function TabBar() {
  const r = route.value;
  const current = r.name === "case" ? "home" : r.name === "game" ? "games" : r.name === "top" || r.name === "player" ? "profile" : r.name;
  return (
    <nav class="tabbar">
      {TABS.map((t) => (
        <button
          class={`tab ${current === t.route.name ? "active" : ""}`}
          onClick={() => {
            haptic.tap();
            tab(t.route);
          }}
        >
          <Ico name={t.icon} size={30} />
          {t.label}
        </button>
      ))}
    </nav>
  );
}

export function Toast() {
  const t = toast.value;
  if (!t) return null;
  return <div class={`toast ${t.kind === "err" ? "err" : ""}`}>{t.text}</div>;
}

export function Price({ value }: { value: number }) {
  return (
    <span class="num" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Star />
      {tf(value)}
    </span>
  );
}

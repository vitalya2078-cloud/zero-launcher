import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { profile, route, tab, toast, type Route } from "../state";
import { fmt } from "../format";
import { haptic } from "../tg";
import { KeyIcon, Star, TabIcons } from "./icons";

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
        <small>GIFT SIMULATOR</small>
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
        {p ? fmt(p.balance) : "…"}
      </div>
    </div>
  );
}

const TABS: { route: Route; label: string; icon: keyof typeof TabIcons }[] = [
  { route: { name: "home" }, label: "Главная", icon: "home" },
  { route: { name: "games" }, label: "Игры", icon: "games" },
  { route: { name: "inventory" }, label: "Инвентарь", icon: "inventory" },
  { route: { name: "profile" }, label: "Профиль", icon: "profile" },
];

export function TabBar() {
  const current = route.value.name === "case" ? "home" : route.value.name;
  return (
    <nav class="tabbar">
      {TABS.map((t) => {
        const Icon = TabIcons[t.icon];
        return (
          <button
            class={`tab ${current === t.route.name ? "active" : ""}`}
            onClick={() => {
              haptic.tap();
              tab(t.route);
            }}
          >
            <Icon />
            {t.label}
          </button>
        );
      })}
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
      {fmt(value)}
    </span>
  );
}

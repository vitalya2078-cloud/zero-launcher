// Обёртка над Telegram.WebApp: безопасна вне Telegram (в браузере методы просто ничего не делают).

import { vibroOn } from "./sound";

type Haptic = {
  impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
  notificationOccurred(type: "error" | "success" | "warning"): void;
  selectionChanged(): void;
};

type WebApp = {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name?: string; photo_url?: string }; start_param?: string };
  version: string;
  platform: string;
  ready(): void;
  expand(): void;
  setHeaderColor?(c: string): void;
  setBackgroundColor?(c: string): void;
  setBottomBarColor?(c: string): void;
  disableVerticalSwipes?(): void;
  openTelegramLink(url: string): void;
  openLink(url: string): void;
  HapticFeedback?: Haptic;
  BackButton?: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  isVersionAtLeast?(v: string): boolean;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: WebApp };
  }
}

export const tg: WebApp | undefined = window.Telegram?.WebApp;

export const BOT_USERNAME = "FortumDropsBot";

export function initTelegram() {
  if (!tg) return;
  tg.ready();
  tg.expand();
  try {
    tg.setHeaderColor?.("#070B18");
    tg.setBackgroundColor?.("#070B18");
    tg.setBottomBarColor?.("#070B18");
    tg.disableVerticalSwipes?.(); // чтобы свайп по рулетке не закрывал приложение
  } catch {
    /* старые клиенты Telegram */
  }
}

// Вибрация можно выключить в профиле (настройка общая с модулем звука).
const hf = () => (vibroOn.value ? tg?.HapticFeedback : undefined);
let lastReel = 0;

export const haptic = {
  tap: () => hf()?.impactOccurred("light"),
  medium: () => hf()?.impactOccurred("medium"),
  heavy: () => hf()?.impactOccurred("heavy"),
  tick: () => hf()?.selectionChanged(),
  // прокрутка ленты/колеса: на Android selectionChanged почти не ощущается, поэтому лёгкий удар,
  // но не чаще ~22 раз в секунду, чтобы не сливалось в гул
  reel: () => {
    const now = performance.now();
    if (now - lastReel < 45) return;
    lastReel = now;
    hf()?.impactOccurred("light");
  },
  success: () => hf()?.notificationOccurred("success"),
  error: () => hf()?.notificationOccurred("error"),
  warning: () => hf()?.notificationOccurred("warning"),
};

// Кнопка «Назад» Telegram: показываем на вложенных экранах.
let backHandler: (() => void) | null = null;
export function setBack(handler: (() => void) | null) {
  const bb = tg?.BackButton;
  if (!bb) return;
  if (backHandler) bb.offClick(backHandler);
  backHandler = handler;
  if (handler) {
    bb.onClick(handler);
    bb.show();
  } else {
    bb.hide();
  }
}

// Ссылка через /start: бот запоминает пригласившего, вход в приложение засчитывает приглашение.
// Работает без настройки «Main Mini App» в BotFather.
export function referralLink(tgId: number) {
  return `https://t.me/${BOT_USERNAME}?start=ref_${tgId}`;
}

export function shareLink(url: string, text: string) {
  const share = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  if (tg) tg.openTelegramLink(share);
  else window.open(share, "_blank");
}

// Обёртка над Telegram.WebApp: безопасна вне Telegram (в браузере методы просто ничего не делают).

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

export const haptic = {
  tap: () => tg?.HapticFeedback?.impactOccurred("light"),
  medium: () => tg?.HapticFeedback?.impactOccurred("medium"),
  heavy: () => tg?.HapticFeedback?.impactOccurred("heavy"),
  tick: () => tg?.HapticFeedback?.selectionChanged(),
  success: () => tg?.HapticFeedback?.notificationOccurred("success"),
  error: () => tg?.HapticFeedback?.notificationOccurred("error"),
  warning: () => tg?.HapticFeedback?.notificationOccurred("warning"),
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

export function referralLink(tgId: number) {
  return `https://t.me/${BOT_USERNAME}?startapp=ref_${tgId}`;
}

export function shareLink(url: string, text: string) {
  const share = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  if (tg) tg.openTelegramLink(share);
  else window.open(share, "_blank");
}

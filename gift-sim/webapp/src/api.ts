import { tg } from "./tg";

const API_URL = "https://cstkloumdkfqofgxmrfi.supabase.co/functions/v1/giftsim-api";

export class ApiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export async function api<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const initData = tg?.initData ?? "";
  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: `tma ${initData}`, "Content-Type": "application/json" },
      body: JSON.stringify({ method, params }),
    });
  } catch {
    throw new ApiError("network");
  }
  const body = await res.json().catch(() => ({ error: "bad_response" }));
  if (!res.ok || body.error) throw new ApiError(body.error ?? `http_${res.status}`);
  return body.result as T;
}

// Человеческие тексты для кодов ошибок из базы.
const MESSAGES: Record<string, string> = {
  network: "Нет соединения с сервером",
  unauthorized: "Открой игру через бота в Telegram",
  insufficient_balance: "Недостаточно звёзд",
  not_enough_keys: "Не хватает ключей",
  case_cooldown: "Бесплатный кейс ещё недоступен",
  case_sold_out: "Кейс закончился",
  case_expired: "Кейс больше недоступен",
  daily_not_ready: "Бонус уже забран — загляни позже",
  rescue_not_available: "Пока недоступно",
  item_not_found: "Подарок не найден",
  task_not_done: "Задание ещё не выполнено",
  task_already_claimed: "Награда уже получена",
  not_subscribed: "Сначала подпишись на канал",
  bad_bet: "Неверная ставка",
  round_active: "Сначала доиграй текущий раунд",
  forbidden: "Нет доступа",
};

export const errorText = (e: unknown) =>
  e instanceof ApiError ? MESSAGES[e.code] ?? `Ошибка: ${e.code}` : "Что-то пошло не так";

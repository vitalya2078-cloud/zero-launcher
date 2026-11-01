// Вебхук бота @FortumDropsBot.
// Telegram присылает обновления с заголовком X-Telegram-Bot-Api-Secret-Token — сверяем его с giftsim.settings.
// /start [ref_<id>] — запоминаем пригласившего и отвечаем кнопкой открытия мини-приложения.
//
// Переменные окружения: BOT_TOKEN (секрет), SUPABASE_DB_URL (выдаётся Supabase автоматически).

import postgres from "npm:postgres@3.4.5";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "";
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 2, prepare: false, idle_timeout: 20 });

async function tg(method: string, body: unknown) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

let cfg: { secret: string; appUrl: string } | null = null;
async function config() {
  if (!cfg) {
    const rows = await sql`select key, value #>> '{}' as v from giftsim.settings where key in ('bot_webhook_secret', 'app_url')`;
    const m = Object.fromEntries(rows.map((r) => [r.key, r.v]));
    cfg = { secret: m.bot_webhook_secret, appUrl: m.app_url };
  }
  return cfg;
}

const WELCOME = (name: string, invited: boolean) =>
  `🎁 <b>${name ? escape(name) + ", д" : "Д"}обро пожаловать в FORTUM DROPS!</b>\n\n` +
  `Открывай кейсы с настоящими NFT-подарками Telegram: Plush Pepe, Durov’s Cap, Heart Locket и ещё 120 коллекций. ` +
  `Цены обновляются каждый час по Fragment.\n\n` +
  `🎰 Краш, апгрейд, мины, колесо, битвы кейсов\n` +
  `🎁 3 000 ★ на старт и ежедневный бонус\n` +
  `🤝 Приглашай друзей — получай ключи от реферальных кейсов\n` +
  (invited ? `\n✨ Ты пришёл по приглашению — при первом входе получишь ещё +1 000 ★\n` : "") +
  `\n<i>Это бесплатный симулятор: подарки и звёзды виртуальные, вывести их нельзя. Не связан с Telegram.</i>`;

const escape = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const { secret, appUrl } = await config();
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  const update = await req.json().catch(() => null);
  const msg = update?.message;
  // отвечаем только в личных сообщениях
  if (!msg?.text || msg.chat?.type !== "private") return new Response("ok");

  const [cmd, payload] = msg.text.trim().split(/\s+/, 2);
  const button = { inline_keyboard: [[{ text: "🎁 Открыть FORTUM DROPS", web_app: { url: appUrl } }]] };

  try {
    if (cmd === "/start") {
      let invited = false;
      if (payload) {
        const [{ ok }] = await sql`select giftsim.set_pending_ref(${msg.from.id}, ${payload}) as ok`;
        invited = ok === true;
      }
      await tg("sendMessage", {
        chat_id: msg.chat.id,
        text: WELCOME(msg.from?.first_name ?? "", invited),
        parse_mode: "HTML",
        reply_markup: button,
      });
    } else if (cmd === "/help") {
      await tg("sendMessage", {
        chat_id: msg.chat.id,
        parse_mode: "HTML",
        text:
          "<b>Как играть</b>\n\n" +
          "• Открывай кейсы за звёзды симулятора — выпадают NFT-подарки и звёзды\n" +
          "• Подарки можно продать, поставить в апгрейд, контракт или джекпот\n" +
          "• Звёзды бесплатные: старт, ежедневный бонус, задания, уровни, друзья\n" +
          "• Шансы каждого кейса видны на его странице\n\n" +
          "Подарки и звёзды виртуальные, вывести их нельзя.",
        reply_markup: button,
      });
    } else {
      await tg("sendMessage", { chat_id: msg.chat.id, text: "Жми кнопку, чтобы открыть приложение 👇", reply_markup: button });
    }
  } catch (e) {
    console.error("bot", e);
  }
  return new Response("ok");
});

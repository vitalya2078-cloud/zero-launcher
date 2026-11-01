// API мини-приложения FORTUM DROPS.
//
// Клиент шлёт POST { "method": "...", "params": { ... } } с заголовком
//   Authorization: tma <Telegram.WebApp.initData>
// Подпись initData проверяется по BOT_TOKEN (алгоритм из документации Telegram Mini Apps),
// дальше вызывается одна из разрешённых SQL-функций схемы giftsim от имени этого игрока.
//
// Переменные окружения: BOT_TOKEN (секрет), SUPABASE_DB_URL (выдаётся Supabase автоматически).

import postgres from "npm:postgres@3.4.5";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "";
const MAX_AUTH_AGE_S = 24 * 60 * 60;

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 3, prepare: false, idle_timeout: 20 });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ---------------------------------------------------------------- проверка initData

const enc = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(data));
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

type TgUser = { id: number; username?: string; first_name?: string; last_name?: string; photo_url?: string; language_code?: string };

async function verifyInitData(initData: string): Promise<{ user: TgUser; startParam: string | null } | null> {
  if (!BOT_TOKEN || !initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheck = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = await hmac(enc.encode("WebAppData"), BOT_TOKEN);
  if (!safeEqual(hex(await hmac(secret, dataCheck)), hash)) return null;
  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AUTH_AGE_S) return null;
  const user = JSON.parse(params.get("user") ?? "null") as TgUser | null;
  if (!user?.id) return null;
  return { user, startParam: params.get("start_param") };
}

// ---------------------------------------------------------------- проверка параметров

class BadParams extends Error {}

const int = (v: unknown, name: string): number => {
  const n = Number(v);
  if (!Number.isSafeInteger(n)) throw new BadParams(name);
  return n;
};
const num = (v: unknown, name: string): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new BadParams(name);
  return n;
};
const optNum = (v: unknown, name: string) => (v === null || v === undefined || v === "" ? null : num(v, name));
const str = (v: unknown, name: string, max = 64): string => {
  if (typeof v !== "string" || v.length === 0 || v.length > max) throw new BadParams(name);
  return v;
};
const ids = (v: unknown, name: string): number[] => {
  if (!Array.isArray(v) || v.length === 0 || v.length > 20) throw new BadParams(name);
  return v.map((x) => int(x, name));
};
const strs = (v: unknown, name: string): string[] => {
  if (!Array.isArray(v) || v.length === 0 || v.length > 10) throw new BadParams(name);
  return v.map((x) => str(x, name));
};

// ---------------------------------------------------------------- маршруты
// Каждый метод — вызов одной SQL-функции; id игрока всегда берётся из проверенной подписи, не из параметров.

type P = Record<string, unknown>;
type Route = (uid: number, p: P) => Promise<unknown>;

const one = async (q: Promise<{ r: unknown }[]>) => (await q)[0]?.r ?? null;

const routes: Record<string, Route> = {
  profile: (u) => one(sql`select giftsim.get_profile(${u}) as r`),
  inventory: (u) => one(sql`select giftsim.get_inventory(${u}) as r`),
  claim_daily: (u) => one(sql`select giftsim.claim_daily(${u}) as r`),
  claim_rescue: (u) => one(sql`select giftsim.claim_rescue(${u}) as r`),
  sell: (u, p) => one(sql`select giftsim.sell_items(${u}, ${ids(p.ids, "ids")}::bigint[]) as r`),

  cases: (u) => one(sql`select giftsim.list_cases_v2(${u}) as r`),
  case: (_u, p) => one(sql`select giftsim.get_case(${str(p.id, "id")}) as r`),
  open_case: (u, p) => one(sql`select giftsim.open_case(${u}, ${str(p.id, "id")}) as r`),
  open_cases: (u, p) => {
    const count = int(p.count, "count");
    if (count < 1 || count > 5) throw new BadParams("count");
    return one(sql`select giftsim.open_case_multi(${u}, ${str(p.id, "id")}, ${count}) as r`);
  },
  drops: (_u, p) => one(sql`select giftsim.recent_drops(${p.limit ? int(p.limit, "limit") : 20}) as r`),
  gifts: (_u, p) => one(sql`select giftsim.list_gifts(${p.min ? int(p.min, "min") : 0}, ${p.max ? int(p.max, "max") : null}, ${p.search ? str(p.search, "search") : null}) as r`),
  gift_history: (_u, p) => one(sql`select giftsim.gift_history(${str(p.id, "id")}, ${p.days ? int(p.days, "days") : 7}) as r`),

  upgrade_chance: (_u, p) => one(sql`select giftsim.upgrade_chance(${int(p.stake, "stake")}, ${int(p.target, "target")}) as r`),
  upgrade: (u, p) => one(sql`select giftsim.upgrade(${u}, ${ids(p.ids, "ids")}::bigint[], ${str(p.target, "target")}) as r`),
  contract: (u, p) => one(sql`select giftsim.contract(${u}, ${ids(p.ids, "ids")}::bigint[]) as r`),

  wheel: (u, p) => one(sql`select giftsim.wheel_spin(${u}, ${int(p.bet, "bet")}, ${str(p.risk, "risk", 8)}) as r`),
  plinko: (u, p) => one(sql`select giftsim.plinko_drop(${u}, ${int(p.bet, "bet")}, ${str(p.risk, "risk", 8)}) as r`),
  coinflip: (u, p) => one(sql`select giftsim.coinflip(${u}, ${int(p.bet, "bet")}, ${str(p.side, "side", 8)}) as r`),

  mines_current: (u) => one(sql`select giftsim.mines_current(${u}) as r`),
  mines_start: (u, p) => one(sql`select giftsim.mines_start(${u}, ${int(p.bet, "bet")}, ${int(p.mines, "mines")}) as r`),
  mines_reveal: (u, p) => one(sql`select giftsim.mines_reveal(${u}, ${int(p.round_id, "round_id")}, ${int(p.cell, "cell")}) as r`),
  mines_cashout: (u, p) => one(sql`select giftsim.mines_cashout(${u}, ${int(p.round_id, "round_id")}) as r`),

  crash_state: (u) => one(sql`select giftsim.crash_game_state(${u}) as r`),
  crash_bet: (u, p) => one(sql`select giftsim.crash_game_bet(${u}, ${int(p.bet, "bet")}, ${optNum(p.auto_cashout, "auto_cashout")}) as r`),
  crash_cashout: (u) => one(sql`select giftsim.crash_game_cashout(${u}) as r`),
  // держим запрос до взрыва (не дольше 25 с), чтобы клиент узнал о нём сразу
  crash_wait: async (u) => {
    const [{ ms }] = await sql`select giftsim.crash_game_wait_ms() as ms`;
    if (Number(ms) > 0) await new Promise((r) => setTimeout(r, Math.min(Number(ms) + 15, 25_000)));
    return one(sql`select giftsim.crash_game_state(${u}) as r`);
  },
  solo_crash_start: (u, p) => one(sql`select giftsim.crash_start(${u}, ${int(p.bet, "bet")}, ${optNum(p.auto_cashout, "auto_cashout")}) as r`),
  solo_crash_cashout: (u, p) => one(sql`select giftsim.crash_cashout(${u}, ${int(p.round_id, "round_id")}) as r`),
  solo_crash_status: (u, p) => one(sql`select giftsim.crash_status(${u}, ${int(p.round_id, "round_id")}) as r`),
  solo_crash_history: (u) => one(sql`select giftsim.crash_history(${u}) as r`),

  jackpot_state: (u) => one(sql`select giftsim.jackpot_state(${u}) as r`),
  jackpot_bet: (u, p) => one(sql`select giftsim.jackpot_bet(${u}, ${ids(p.ids, "ids")}::bigint[]) as r`),

  battles: (u) => one(sql`select giftsim.battle_list(${u}) as r`),
  battle: (u, p) => one(sql`select giftsim.battle_get(${u}, ${int(p.id, "id")}) as r`),
  battle_create: (u, p) => one(sql`select giftsim.battle_create(${u}, ${strs(p.cases, "cases")}::text[], ${int(p.players, "players")}) as r`),
  battle_join: (u, p) => one(sql`select giftsim.battle_join(${u}, ${int(p.id, "id")}) as r`),
  battle_bots: (u, p) => one(sql`select giftsim.battle_add_bots(${u}, ${int(p.id, "id")}) as r`),
  battle_cancel: (u, p) => one(sql`select giftsim.battle_cancel(${u}, ${int(p.id, "id")}) as r`),

  tasks: (u) => one(sql`select giftsim.list_tasks(${u}) as r`),
  claim_task: async (u, p) => {
    const id = str(p.id, "id");
    const [{ chat }] = await sql`select giftsim.get_task_chat(${id}) as chat`;
    const verified = chat ? await isSubscribed(chat as string, u) : false;
    return one(sql`select giftsim.claim_task(${u}, ${id}, ${verified}) as r`);
  },
  leaderboard: (u, p) => {
    const kind = str(p.kind ?? "won", "kind", 16);
    if (!["won", "level", "inventory"].includes(kind)) throw new BadParams("kind");
    return one(sql`select giftsim.leaderboard(${kind}, ${u}) as r`);
  },
  // модель / фон / узор конкретного номера: кэш в базе, иначе — страница t.me/nft/<slug>-<номер>
  nft_info: async (_u, p) => {
    const gift = str(p.gift, "gift", 40);
    if (!/^[a-z0-9]+$/.test(gift)) throw new BadParams("gift");
    const num = int(p.num, "num");
    const cached = (await one(sql`select giftsim.nft_attrs_get(${gift}, ${num}) as r`)) as { cached: boolean } | null;
    if (!cached) throw new BadParams("num");
    if (cached.cached) return cached;
    const attrs = await fetchNftAttrs(gift, num);
    if (!attrs) return { ...cached, found: false };
    return one(sql`select giftsim.nft_attrs_put(${gift}, ${num}, ${sql.json(attrs)}) as r`);
  },
  // ---------------------------------------------------------------- маркет
  market: (u, p) => one(sql`select giftsim.market_lots(${u}, ${p.gift ? str(p.gift, "gift", 40) : null},
    ${p.sort ? str(p.sort, "sort", 12) : "price"}, ${p.offset ? int(p.offset, "offset") : 0}) as r`),
  market_my: (u) => one(sql`select giftsim.market_my(${u}) as r`),
  market_list: (u, p) => one(sql`select giftsim.market_list(${u}, ${int(p.id, "id")}, ${int(p.price, "price")}) as r`),
  market_cancel: (u, p) => one(sql`select giftsim.market_cancel(${u}, ${int(p.lot, "lot")}) as r`),
  market_buy: async (u, p) => {
    const r = (await one(sql`select giftsim.market_buy(${u}, ${int(p.lot, "lot")}) as r`)) as Record<string, unknown> | null;
    const n = r?.notify as SaleNotice | undefined;
    if (r) delete r.notify; // данные продавца в клиент не отдаём
    if (n) await notifySale(n);
    return r;
  },
  player: (u, p) => {
    const id = str(p.id, "id", 36);
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new BadParams("id");
    return one(sql`select giftsim.player_profile(${id}::uuid, ${u}) as r`);
  },

  admin_overview: (u) => one(sql`select giftsim.admin_overview(${u}) as r`),
  admin_cases: (u) => one(sql`select giftsim.admin_list_cases(${u}) as r`),
  admin_case: (u, p) => one(sql`select giftsim.admin_get_case(${u}, ${str(p.id, "id")}) as r`),
  admin_upsert_case: (u, p) => one(sql`select giftsim.admin_upsert_case(${u}, ${sql.json(p.case as object)}) as r`),
  admin_set_case_items: (u, p) => one(sql`select giftsim.admin_set_case_items(${u}, ${str(p.id, "id")}, ${sql.json(p.items as object)}) as r`),
  admin_grant: (u, p) => one(sql`select giftsim.admin_grant(${u}, ${int(p.target, "target")}, ${p.stars ? int(p.stars, "stars") : null}, ${p.gift ? str(p.gift, "gift") : null}) as r`),
  admin_set_setting: (u, p) => one(sql`select giftsim.admin_set_setting(${u}, ${str(p.key, "key")}, ${sql.json(p.value as object)}) as r`),
  admin_upsert_task: (u, p) => one(sql`select giftsim.admin_upsert_task(${u}, ${sql.json(p.task as object)}) as r`),
};

const decode = (t: string) =>
  t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .trim();

// Атрибуты номера со страницы t.me/nft/<slug>-<номер>: строки «Model / Backdrop / Symbol» с процентом редкости.
// null — страница без таблицы (номера нет или t.me не ответил как надо): такое не кэшируем.
async function fetchNftAttrs(gift: string, num: number): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://t.me/nft/${gift}-${num}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FortumDrops/1.0)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const out: Record<string, unknown> = {};
    for (const [key, field] of [["Model", "model"], ["Backdrop", "backdrop"], ["Symbol", "symbol"]]) {
      const m = html.match(new RegExp(`<th>${key}</th><td>([^<]*?)\\s*<mark>([\\d.,]+)%</mark>`));
      if (m) {
        out[field] = decode(m[1]);
        out[`${field}_rarity`] = Number(m[2].replace(",", "."));
      }
    }
    return out.model ? out : null;
  } catch {
    return null;
  }
}

type SaleNotice = { seller: number; net: number; name: string; num: number | null; buyer: string };

// Сообщение продавцу от бота: «у тебя купили подарок». Не дольше 3 с — покупка от этого не зависит.
async function notifySale(n: SaleNotice) {
  try {
    const [{ url }] = await sql`select giftsim.setting('app_url') #>> '{}' as url`;
    const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
    const fmt = (v: number) => new Intl.NumberFormat("ru-RU").format(v);
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(3000),
      body: JSON.stringify({
        chat_id: n.seller,
        parse_mode: "HTML",
        text: `🛒 <b>У тебя купили подарок</b>\n\n${esc(n.name)}${n.num ? ` #${fmt(n.num)}` : ""} — купил(а) ${esc(n.buyer)}\n` +
          `+${fmt(n.net)} ★ на баланс (комиссия маркета 5%)`,
        reply_markup: url ? { inline_keyboard: [[{ text: "Открыть маркет", web_app: { url: `${url}#market` } }]] } : undefined,
      }),
    });
  } catch (e) {
    console.error("notifySale", e);
  }
}

// Подписан ли игрок на канал (бот должен быть администратором канала).
async function isSubscribed(chat: string, userId: number): Promise<boolean> {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(chat)}&user_id=${userId}`;
  try {
    const r = await (await fetch(url)).json();
    return r.ok && ["creator", "administrator", "member", "restricted"].includes(r.result?.status) &&
      !(r.result?.status === "restricted" && r.result?.is_member === false);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- обработчик

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("authorization") ?? "";
  const initData = auth.startsWith("tma ") ? auth.slice(4) : "";
  const session = await verifyInitData(initData);
  if (!session) return json({ error: BOT_TOKEN ? "unauthorized" : "server_not_configured" }, 401);

  let body: { method?: string; params?: P };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const method = body.method ?? "";
  const u = session.user;

  try {
    if (method === "login") {
      const r = await one(sql`select giftsim.login(${u.id}, ${u.username ?? null}, ${u.first_name ?? null},
        ${u.last_name ?? null}, ${u.photo_url ?? null}, ${u.language_code ?? null}, ${session.startParam}) as r`);
      return json({ result: r });
    }
    const route = Object.hasOwn(routes, method) ? routes[method] : undefined;
    if (!route) return json({ error: "unknown_method" }, 404);
    return json({ result: await route(u.id, body.params ?? {}) });
  } catch (e) {
    if (e instanceof BadParams) return json({ error: "bad_params", field: e.message }, 400);
    // ошибки игровой логики приходят из SQL как raise exception '<код>'
    const msg = (e as { message?: string }).message ?? "";
    if (/^[a-z_0-9]{3,40}$/.test(msg)) return json({ error: msg }, 400);
    console.error(method, e);
    return json({ error: "internal" }, 500);
  }
});

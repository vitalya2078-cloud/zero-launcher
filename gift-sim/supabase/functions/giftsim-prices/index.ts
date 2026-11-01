// Обновление цен NFT-подарков: раз в час собирает минимальные цены коллекций и курс TON → Stars
// с fragment.com и передаёт их в giftsim.apply_prices (история цен + пересчёт шансов в кейсах).
//
// Вызывается планировщиком (pg_cron + pg_net) с заголовком x-cron-secret.
// Ключ хранится в закрытой таблице giftsim.settings (key = 'cron_token'), к которой нет доступа у публичных ролей.
// SUPABASE_DB_URL выдаётся Supabase автоматически.

import postgres from "npm:postgres@3.4.5";

const UA = "Mozilla/5.0 (compatible; GiftSimPriceBot/1.0)";
const CONCURRENCY = 3; // одновременных запросов к Fragment
const DELAY_MS = 250;  // пауза в каждом потоке между запросами, чтобы не нагружать сайт

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return await res.text();
}

const num = (s: string) => Number(s.replace(/,/g, ""));

// Курс: сколько звёзд дают за 1 TON (по пакету 1000 Stars на странице покупки).
async function starsPerTon(): Promise<number | null> {
  const html = await fetchText("https://fragment.com/stars/buy");
  const m = html.match(/1,000 Stars<\/span>[\s\S]{0,600}?icon-ton[^>]*>\s*([\d,]+)(?:<span[^>]*>)?(\.\d+)?/);
  if (!m) return null;
  const ton = num(m[1] + (m[2] ?? ""));
  return ton > 0 ? Math.round((1000 / ton) * 100) / 100 : null;
}

// Минимальная цена коллекции среди выставленных на продажу.
async function floorTon(slug: string): Promise<number | null> {
  const html = await fetchText(`https://fragment.com/gifts/${slug}?sort=price_asc&filter=sale`);
  const prices = [...html.matchAll(/tm-value icon-before icon-ton">([\d,]+)(?:<span class="mini-frac">(\.\d+)<\/span>)?/g)]
    .map((m) => num(m[1] + (m[2] ?? "")));
  const valid = prices.filter((p) => p > 0);
  return valid.length ? Math.min(...valid) : null;
}

Deno.serve(async (req) => {
  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 1, prepare: false });
  try {
    const [row] = await sql`select value #>> '{}' as token from giftsim.settings where key = 'cron_token'`;
    const given = req.headers.get("x-cron-secret") ?? "";
    if (!row?.token || given.length !== row.token.length || given !== row.token) {
      return new Response("forbidden", { status: 403 });
    }

    const rate = await starsPerTon();
    if (!rate) throw new Error("не удалось прочитать курс Stars/TON");

    const slugs: { id: string }[] = await sql`select id from giftsim.gifts where kind = 'nft' and active`;
    const items: { slug: string; floor_ton: number }[] = [];
    const errors: string[] = [];
    const queue = slugs.map((s) => s.id);
    const worker = async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        try {
          const floor = await floorTon(id);
          if (floor) items.push({ slug: id, floor_ton: floor });
        } catch (e) {
          errors.push(`${id}: ${(e as Error).message}`);
        }
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    // если Fragment не ответил почти ни по одной коллекции — ничего не меняем
    if (items.length < slugs.length * 0.5) {
      throw new Error(`слишком мало цен: ${items.length}/${slugs.length}; ${errors.slice(0, 3).join("; ")}`);
    }

    const [{ result }] = await sql`select giftsim.apply_prices(${sql.json(items)}, ${rate}) as result`;
    return Response.json({ ok: true, rate, collected: items.length, total: slugs.length, errors: errors.length, result });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  } finally {
    await sql.end();
  }
});

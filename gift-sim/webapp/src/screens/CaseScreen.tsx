import { stageBg } from "../components/game-ui";
import { useEffect, useRef, useState } from "preact/hooks";
import { api, errorText } from "../api";
import { GiftArt } from "../components/GiftArt";
import { NftCard } from "../components/NftCard";
import { CaseCover } from "../components/CaseCover";
import { KeyIcon, Star } from "../components/icons";
import { Sheet } from "../components/ui";
import { chance, fmt, RARITY, short, timeLeft } from "../format";
import { profile, refreshInventory, refreshProfile, setBalance, showToast } from "../state";
import { haptic } from "../tg";
import { sound } from "../sound";
import type { CaseFull, CaseItem, Gift } from "../types";

const REEL_LEN = 60;
const WIN_INDEX = 52;

// размер карточек ленты: чем больше кейсов открываем за раз, тем компактнее ленты
const SIZES: Record<number, { w: number; h: number; art: number; gap: number }> = {
  1: { w: 100, h: 112, art: 66, gap: 10 },
  2: { w: 88, h: 98, art: 58, gap: 9 },
  3: { w: 76, h: 86, art: 50, gap: 8 },
  4: { w: 66, h: 74, art: 44, gap: 7 },
  5: { w: 60, h: 66, art: 38, gap: 6 },
};

type OpenResult = {
  inventory_id: number | null;
  gift: Gift;
  prize: { stars?: number; keys?: number; inventory_id?: number };
  price: number;
  balance: number;
  referral_keys: number;
};

// Лента для анимации: случайные призы кейса (редкие показываем чуть чаще, чем они выпадают — для зрелищности),
// а на позиции WIN_INDEX — настоящий выигрыш, который уже определил сервер.
function buildReel(items: CaseItem[], win: Gift): Gift[] {
  const w = items.map((i) => Math.sqrt(Math.max(i.chance, 0.0001)));
  const total = w.reduce((a, b) => a + b, 0);
  const pick = () => {
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) if ((r -= w[i]) < 0) return items[i];
    return items[items.length - 1];
  };
  return Array.from({ length: REEL_LEN }, (_, i) => (i === WIN_INDEX ? win : pick()));
}

export function CaseScreen({ id }: { id: string }) {
  const [data, setData] = useState<CaseFull | null>(null);
  const [reels, setReels] = useState<Gift[][]>([]);
  const [count, setCount] = useState(() => Math.min(5, Math.max(1, Number(localStorage.getItem("case_count")) || 1)));
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<OpenResult | null>(null);
  const [multi, setMulti] = useState<OpenResult[] | null>(null);
  const [fast, setFast] = useState(() => localStorage.getItem("fast") === "1");
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const reelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    api<CaseFull>("case", { id })
      .then((c) => {
        setData(c);
        const k = c.pay_mode === "free" ? 1 : Math.min(5, Math.max(1, Number(localStorage.getItem("case_count")) || 1));
        setReels(Array.from({ length: k }, () => buildReel(c.items, c.items[0])));
      })
      .catch((e) => showToast(errorText(e), "err"));
    api<{ id: string; cooldown_until: string | null }[]>("cases")
      .then((list) => setCooldownUntil(list.find((c) => c.id === id)?.cooldown_until ?? null))
      .catch(() => {});
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [id]);

  if (!data) {
    return (
      <>
        <div class="skeleton" style={{ height: 230, marginTop: 6 }} />
        <div class="skeleton" style={{ height: 132, margin: "16px 0" }} />
      </>
    );
  }

  const top = [...data.items].sort((a, b) => b.value - a.value)[0];
  const rc = RARITY[top.rarity].color;
  const p = profile.value;
  const cooldown = data.pay_mode === "free" ? timeLeft(cooldownUntil) : null;
  const n = data.pay_mode === "free" ? 1 : count; // бесплатный — только по одному
  const canAfford =
    data.pay_mode === "stars" ? (p?.balance ?? 0) >= data.price * n
    : data.pay_mode === "keys" ? (p?.referral_keys ?? 0) >= (data.price_keys ?? 1) * n
    : !cooldown;
  const size = SIZES[reels.length > 1 ? reels.length : n] ?? SIZES[1];

  async function open() {
    if (spinning) return;
    haptic.medium();
    sound.start();
    setSpinning(true);
    let rs: OpenResult[];
    try {
      if (n === 1) {
        const r = await api<OpenResult>("open_case", { id });
        rs = [r];
        setBalance(r.balance);
        if (profile.value) profile.value = { ...profile.value, referral_keys: r.referral_keys };
      } else {
        const r = await api<{ results: OpenResult[]; balance: number; referral_keys: number }>("open_cases", { id, count: n });
        rs = r.results;
        setBalance(r.balance);
        if (profile.value) profile.value = { ...profile.value, referral_keys: r.referral_keys };
      }
    } catch (e) {
      haptic.error();
      showToast(errorText(e), "err");
      setSpinning(false);
      return;
    }
    if (data!.pay_mode === "free") setCooldownUntil(new Date(Date.now() + (data!.free_cooldown_h ?? 4) * 3_600_000).toISOString());
    spin(rs);
  }

  function spin(rs: OpenResult[]) {
    const sz = SIZES[rs.length] ?? SIZES[1];
    const step = sz.w + sz.gap;
    setReels(rs.map((r) => buildReel(data!.items, r.gift)));
    requestAnimationFrame(() => {
      const wrapW = (wrapRef.current!.firstElementChild as HTMLElement).clientWidth;
      const base = fast ? 1400 : 5600;
      // ленты останавливаются друг за другом
      const durations = rs.map((_, i) => base + i * (fast ? 120 : 260));
      rs.forEach((_, i) => {
        const el = reelRefs.current[i];
        if (!el) return;
        const jitter = (Math.random() - 0.5) * (sz.w * 0.7);
        const target = -(WIN_INDEX * step + sz.w / 2 + 8 - wrapW / 2) + jitter;
        el.style.transition = "none";
        el.style.transform = "translateX(0px)";
        void el.offsetWidth; // перезапуск анимации
        el.style.transition = `transform ${durations[i]}ms cubic-bezier(0.08, 0.72, 0.1, 1)`;
        el.style.transform = `translateX(${target}px)`;
      });

      // щелчок и вибрация каждый раз, когда под маркером первой ленты проходит подарок
      const el = reelRefs.current[0]!;
      let last = -1;
      const center = wrapW / 2;
      const started = performance.now();
      const loop = () => {
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        const idx = Math.floor((center - m.m41 - 8) / step);
        if (idx !== last) {
          last = idx;
          sound.tick();
          haptic.reel();
        }
        if (performance.now() - started < durations[0]) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);

      setTimeout(() => {
        const order = ["common", "rare", "epic", "legendary", "mythic"];
        const best = rs.reduce((b, r) => (order.indexOf(r.gift.rarity) > order.indexOf(b) ? r.gift.rarity : b), "common");
        haptic.heavy();
        if (best === "legendary" || best === "mythic") haptic.success();
        sound.win(best);
        if (rs.length === 1) setResult(rs[0]);
        else setMulti(rs);
        setSpinning(false);
        refreshProfile().catch(() => {});
        if (rs.some((r) => r.inventory_id)) refreshInventory().catch(() => {});
      }, Math.max(...durations) + 150);
    });
  }

  async function sellMany(ids: number[]) {
    if (!ids.length) return setMulti(null);
    try {
      const r = await api<{ balance: number; sold_for: number }>("sell", { ids });
      setBalance(r.balance);
      haptic.success();
      sound.coins();
      showToast(`Продано за ${fmt(r.sold_for)} ★`);
      refreshInventory().catch(() => {});
    } catch (e) {
      showToast(errorText(e), "err");
    }
    setMulti(null);
  }

  async function sell() {
    if (!result?.inventory_id) return;
    try {
      const r = await api<{ balance: number; sold_for: number }>("sell", { ids: [result.inventory_id] });
      setBalance(r.balance);
      haptic.success();
      showToast(`Продано за ${fmt(r.sold_for)} ★`);
      refreshInventory().catch(() => {});
    } catch (e) {
      showToast(errorText(e), "err");
    }
    setResult(null);
  }

  // кнопки окна выигрыша (общие для NFT и звёзд)
  const winButtons = result && (
    <>
      {result.inventory_id ? (
        <div class="row">
          <button class="btn secondary" onClick={sell}>
            Продать · {short(result.gift.value)} ★
          </button>
          <button class="btn" onClick={() => setResult(null)}>
            Забрать
          </button>
        </div>
      ) : (
        <button class="btn" onClick={() => setResult(null)}>
          Забрать
        </button>
      )}
      {canAfford && data.pay_mode !== "free" && (
        <button
          class="btn secondary"
          style={{ marginTop: 10 }}
          onClick={() => {
            setResult(null);
            setTimeout(open, 250);
          }}
        >
          Ещё раз
        </button>
      )}
    </>
  );

  return (
    <>
      <div class="case-hero glass stage-bg" style={{ "--rc": rc, ...stageBg("case") }}>
        <div class="glow" />
        <CaseCover name={data.name} category={data.category} cover={top} size={156} />
        <h1>{data.name}</h1>
        <p class="muted">{data.description ?? `Главный приз — ${top.name} · ${short(top.value)} ★`}</p>
      </div>

      <div class={`reels ${reels.length > 1 ? "multi" : ""}`} ref={wrapRef}>
        {reels.map((reel, ri) => (
          <div class="reel-wrap" style={{ height: size.h + 20, "--iw": `${size.w}px`, "--ih": `${size.h}px`, "--gap": `${size.gap}px` }}>
            <div class="reel-marker" />
            <div class="reel" ref={(el) => { reelRefs.current[ri] = el; }} style={{ paddingLeft: 8 }}>
              {reel.map((g) => (
                <div class="reel-item" style={{ "--rc": RARITY[g.rarity].color }}>
                  <GiftArt gift={g} size={size.art} />
                  <span class="num">{short(g.value)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div class="open-actions">
        {data.pay_mode !== "free" && (
          <div class="count-picker">
            {[1, 2, 3, 4, 5].map((k) => (
              <button
                class={k === count ? "on" : ""}
                disabled={spinning}
                onClick={() => {
                  haptic.tick();
                  sound.click();
                  setCount(k);
                  localStorage.setItem("case_count", String(k));
                  if (!spinning) setReels(Array.from({ length: k }, () => buildReel(data.items, data.items[0])));
                }}
              >
                ×{k}
              </button>
            ))}
          </div>
        )}
        <button class="btn" disabled={spinning || !canAfford} onClick={open}>
          {spinning ? (
            "Крутим…"
          ) : data.pay_mode === "free" ? (
            cooldown ? `Через ${cooldown}` : "Открыть"
          ) : data.pay_mode === "keys" ? (
            <>
              Открыть{n > 1 ? ` ${n}` : ""} за <KeyIcon size={18} /> {(data.price_keys ?? 1) * n}
            </>
          ) : (
            <>
              Открыть{n > 1 ? ` ${n}` : ""} за <Star size={18} /> <span class="num">{fmt(data.price * n)}</span>
            </>
          )}
        </button>
        {!canAfford && !spinning && data.pay_mode === "stars" && (
          <div class="dim" style={{ textAlign: "center", fontSize: 13 }}>
            Не хватает {fmt(data.price * n - (p?.balance ?? 0))} ★
          </div>
        )}
        <button
          class="fast-toggle"
          onClick={() => {
            const v = !fast;
            setFast(v);
            localStorage.setItem("fast", v ? "1" : "0");
          }}
        >
          <span class={`switch ${fast ? "on" : ""}`} /> Быстрое открытие
        </button>
      </div>

      <div class="section-title">
        <h2>Что внутри</h2>
        <span>шанс выпадения</span>
      </div>
      <div class="gift-grid">
        {data.items.map((g) => (
          <div class="gift-card glass" style={{ "--rc": RARITY[g.rarity].color }}>
            <GiftArt gift={g} size={64} />
            <div class="g-name">{g.kind === "stars" ? "Звёзды" : g.name}</div>
            <div class="g-val num">
              <Star /> {short(g.value)}
            </div>
            <div class="g-chance num">{chance(g.chance)}</div>
          </div>
        ))}
      </div>

      {result && (
        <Sheet onClose={() => setResult(null)}>
          {result.gift.kind === "nft" ? (
            <NftCard gift={result.gift}>
              {result.price > 0 && (
                <div class={`delta center ${result.gift.value >= result.price ? "up" : "down"}`} style={{ marginBottom: 12 }}>
                  {result.gift.value >= result.price ? "▲" : "▼"} ×{(result.gift.value / result.price).toFixed(2)} к цене кейса
                </div>
              )}
            {winButtons}
            </NftCard>
          ) : (
          <div class="win" style={{ "--rc": RARITY[result.gift.rarity].color }}>
            <div class="rays" />
            <img class="win-sparkle" src="./fx/sparkle.webp" alt="" />
            <div class="win-art"><GiftArt gift={result.gift} size={180} /></div>
            <div class="rarity">{RARITY[result.gift.rarity].name}</div>
            <h2>{result.gift.kind === "stars" ? `${fmt(result.gift.value)} звёзд` : result.gift.name}</h2>
            <div class="value num">
              {result.gift.kind === "stars" ? (
                <span class="muted">Уже на балансе</span>
              ) : (
                <>
                  <Star size={20} /> {fmt(result.gift.value)}
                  {result.price > 0 && (
                    <span class={`delta ${result.gift.value >= result.price ? "up" : "down"}`} style={{ fontSize: 14 }}>
                      {result.gift.value >= result.price ? "▲" : "▼"} ×{(result.gift.value / result.price).toFixed(2)}
                    </span>
                  )}
                </>
              )}
            </div>
            {winButtons}
          </div>
          )}
        </Sheet>
      )}

      {multi && (
        <Sheet onClose={() => setMulti(null)}>
          <MultiResult
            results={multi}
            onSell={() => sellMany(multi.filter((r) => r.inventory_id).map((r) => r.inventory_id!))}
            onTake={() => setMulti(null)}
            onAgain={canAfford ? () => { setMulti(null); setTimeout(open, 250); } : undefined}
          />
        </Sheet>
      )}
    </>
  );
}

function MultiResult({ results, onSell, onTake, onAgain }: { results: OpenResult[]; onSell: () => void; onTake: () => void; onAgain?: () => void }) {
  const total = results.reduce((s, r) => s + r.gift.value, 0);
  const cost = results.reduce((s, r) => s + r.price, 0);
  const nftValue = results.filter((r) => r.inventory_id).reduce((s, r) => s + r.gift.value, 0);
  return (
    <div class="multi-win">
      <h2>Твои призы</h2>
      <div class="multi-grid">
        {results.map((r) => (
          <div class="gift-card glass" style={{ "--rc": RARITY[r.gift.rarity].color }}>
            <GiftArt gift={r.gift} size={56} />
            <div class="g-name">{r.gift.kind === "stars" ? "Звёзды" : r.gift.name}</div>
            <div class="g-val num"><Star /> {short(r.gift.value)}</div>
          </div>
        ))}
      </div>
      <div class="multi-total num">
        <span class="dim">Итого</span>
        <b><Star size={18} /> {fmt(total)}</b>
        {cost > 0 && <span class={`delta ${total >= cost ? "up" : "down"}`}>{total >= cost ? "▲" : "▼"} ×{(total / cost).toFixed(2)}</span>}
      </div>
      {nftValue > 0 ? (
        <div class="row">
          <button class="btn secondary" onClick={onSell}>Продать подарки · {short(nftValue)} ★</button>
          <button class="btn" onClick={onTake}>Забрать</button>
        </div>
      ) : (
        <button class="btn" onClick={onTake}>Забрать</button>
      )}
      {onAgain && <button class="btn secondary" style={{ marginTop: 10 }} onClick={onAgain}>Ещё раз ×{results.length}</button>}
    </div>
  );
}

import { useEffect, useRef, useState } from "preact/hooks";
import { api, errorText } from "../api";
import { GiftArt } from "../components/GiftArt";
import { GiftLottie } from "../components/Lottie";
import { KeyIcon, Star } from "../components/icons";
import { Sheet } from "../components/ui";
import { chance, fmt, RARITY, short, timeLeft } from "../format";
import { profile, refreshInventory, refreshProfile, setBalance, showToast } from "../state";
import { haptic } from "../tg";
import type { CaseFull, CaseItem, Gift } from "../types";

const ITEM_W = 100;
const GAP = 10;
const STEP = ITEM_W + GAP;
const REEL_LEN = 60;
const WIN_INDEX = 52;

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
  const [reel, setReel] = useState<Gift[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<OpenResult | null>(null);
  const [fast, setFast] = useState(() => localStorage.getItem("fast") === "1");
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const reelRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    api<CaseFull>("case", { id })
      .then((c) => {
        setData(c);
        setReel(buildReel(c.items, c.items[0]));
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
  const canAfford =
    data.pay_mode === "stars" ? (p?.balance ?? 0) >= data.price
    : data.pay_mode === "keys" ? (p?.referral_keys ?? 0) >= (data.price_keys ?? 1)
    : !cooldown;

  async function open() {
    if (spinning) return;
    haptic.medium();
    setSpinning(true);
    let r: OpenResult;
    try {
      r = await api<OpenResult>("open_case", { id });
    } catch (e) {
      haptic.error();
      showToast(errorText(e), "err");
      setSpinning(false);
      return;
    }
    setBalance(r.balance);
    if (profile.value) profile.value = { ...profile.value, referral_keys: r.referral_keys };
    if (data!.pay_mode === "free") setCooldownUntil(new Date(Date.now() + (data!.free_cooldown_h ?? 4) * 3_600_000).toISOString());
    spin(buildReel(data!.items, r.gift), r);
  }

  function spin(items: Gift[], r: OpenResult) {
    setReel(items);
    requestAnimationFrame(() => {
      const el = reelRef.current!;
      const wrapW = wrapRef.current!.clientWidth;
      const jitter = (Math.random() - 0.5) * (ITEM_W * 0.7);
      const target = -(WIN_INDEX * STEP + ITEM_W / 2 - wrapW / 2) + jitter;
      const duration = fast ? 1400 : 5600;

      el.style.transition = "none";
      el.style.transform = "translateX(0px)";
      void el.offsetWidth; // перезапуск анимации
      el.style.transition = `transform ${duration}ms cubic-bezier(0.08, 0.72, 0.1, 1)`;
      el.style.transform = `translateX(${target}px)`;

      // вибрация каждый раз, когда под маркером проходит новый подарок
      let last = -1;
      const center = wrapW / 2;
      const started = performance.now();
      const loop = () => {
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        const idx = Math.floor((center - m.m41) / STEP);
        if (idx !== last) {
          last = idx;
          haptic.tick();
        }
        if (performance.now() - started < duration) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);

      setTimeout(() => {
        haptic.heavy();
        if (["legendary", "mythic"].includes(r.gift.rarity)) haptic.success();
        setResult(r);
        setSpinning(false);
        refreshProfile().catch(() => {});
        if (r.inventory_id) refreshInventory().catch(() => {});
      }, duration + 150);
    });
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

  return (
    <>
      <div class="case-hero glass" style={{ "--rc": rc }}>
        <div class="glow" />
        <GiftArt gift={top} size={140} />
        <h1>{data.name}</h1>
        <p class="muted">{data.description ?? `Главный приз — ${top.name} · ${short(top.value)} ★`}</p>
      </div>

      <div class="reel-wrap" ref={wrapRef}>
        <div class="reel-marker" />
        <div class="reel" ref={reelRef} style={{ paddingLeft: 8 }}>
          {reel.map((g) => (
            <div class="reel-item" style={{ "--rc": RARITY[g.rarity].color }}>
              <GiftArt gift={g} size={66} />
              <span class="num">{short(g.value)}</span>
            </div>
          ))}
        </div>
      </div>

      <div class="open-actions">
        <button class="btn" disabled={spinning || !canAfford} onClick={open}>
          {spinning ? (
            "Крутим…"
          ) : data.pay_mode === "free" ? (
            cooldown ? `Через ${cooldown}` : "Открыть"
          ) : data.pay_mode === "keys" ? (
            <>
              Открыть за <KeyIcon size={18} /> {data.price_keys}
            </>
          ) : (
            <>
              Открыть за <Star size={18} /> <span class="num">{fmt(data.price)}</span>
            </>
          )}
        </button>
        {!canAfford && !spinning && data.pay_mode === "stars" && (
          <div class="dim" style={{ textAlign: "center", fontSize: 13 }}>
            Не хватает {fmt(data.price - (p?.balance ?? 0))} ★
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
          <div class="win" style={{ "--rc": RARITY[result.gift.rarity].color }}>
            <div class="rays" />
            <div class="win-art">{result.gift.kind === "nft" ? <GiftLottie gift={result.gift} size={200} /> : <GiftArt gift={result.gift} size={180} />}</div>
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
          </div>
        </Sheet>
      )}
    </>
  );
}

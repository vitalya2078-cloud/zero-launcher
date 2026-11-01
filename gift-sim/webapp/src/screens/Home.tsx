import { stageBg } from "../components/game-ui";
import { useEffect, useMemo, useState } from "preact/hooks";
import { api, errorText } from "../api";
import { GiftArt } from "../components/GiftArt";
import { CaseCover } from "../components/CaseCover";
import { Ico, KeyIcon, Star } from "../components/icons";
import { fmt, plural, RARITY, short, timeLeft } from "../format";
import { go, profile, showToast } from "../state";
import { haptic } from "../tg";
import type { CaseCard, Drop, Profile } from "../types";

const CATEGORIES: { id: CaseCard["category"] | "all"; label: string; icon?: string }[] = [
  { id: "all", label: "Все" },
  { id: "special", label: "Особые", icon: "cat-special" },
  { id: "gift", label: "Охота", icon: "cat-hunt" },
  { id: "price", label: "Классика", icon: "cat-classic" },
  { id: "theme", label: "Коллекции", icon: "cat-collections" },
  { id: "referral", label: "За друзей", icon: "cat-friends" },
  { id: "custom", label: "Акции", icon: "cat-deals" },
];
const CAT_ICON = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.icon]));


const SECTION_TITLES: Record<string, string> = {
  special: "Особые",
  referral: "За друзей",
  price: "Классика",
  gift: "Охота за подарком",
  theme: "Коллекции",
  custom: "Акции",
};

// раз в секунду перерисовываем таймеры
function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

export function Home() {
  const [cases, setCases] = useState<CaseCard[] | null>(null);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]["id"]>("all");
  useTick();

  useEffect(() => {
    api<CaseCard[]>("cases").then(setCases).catch((e) => showToast(errorText(e), "err"));
    const loadDrops = () => api<Drop[]>("drops", { limit: 20 }).then(setDrops).catch(() => {});
    loadDrops();
    const t = setInterval(loadDrops, 8000);
    return () => clearInterval(t);
  }, []);

  const groups = useMemo(() => {
    if (!cases) return [];
    const list = cat === "all" ? cases : cases.filter((c) => c.category === cat);
    const by = new Map<string, CaseCard[]>();
    for (const c of list) by.set(c.category, [...(by.get(c.category) ?? []), c]);
    return [...by.entries()];
  }, [cases, cat]);

  const visibleCats = CATEGORIES.filter((c) => c.id === "all" || cases?.some((x) => x.category === c.id));

  return (
    <>
      <DailyBonus />
      {drops.length > 0 && (
        <div class="ticker">
          {drops.map((d) => (
            <div
              class={`drop glass ${d.uid ? "link" : ""}`}
              style={{ "--rc": RARITY[d.rarity].color }}
              key={d.at + d.id}
              onClick={d.uid ? () => { haptic.tap(); go({ name: "player", id: d.uid! }); } : undefined}
            >
              <GiftArt gift={d} size={44} />
              <div class="num" style={{ fontSize: 11, fontWeight: 700 }}>
                {short(d.value)}
              </div>
              <div class="who">{d.user}</div>
            </div>
          ))}
        </div>
      )}

      <div class="chips">
        {visibleCats.map((c) => (
          <button
            class={`chip ${cat === c.id ? "active" : ""}`}
            onClick={() => {
              haptic.tick();
              setCat(c.id);
            }}
          >
            {c.icon && <Ico name={c.icon} size={22} />}
            {c.label}
          </button>
        ))}
      </div>

      {!cases && (
        <div class="cases" style={{ marginTop: 20 }}>
          {Array.from({ length: 6 }, () => (
            <div class="skeleton" style={{ height: 210 }} />
          ))}
        </div>
      )}

      {groups.map(([category, list]) => (
        <section>
          <div class="section-title">
            <h2>
              {CAT_ICON[category] && <Ico name={CAT_ICON[category]!} size={30} />}
              {SECTION_TITLES[category] ?? category}
            </h2>
            <span>
              {list.length} {plural(list.length, "кейс", "кейса", "кейсов")}
            </span>
          </div>
          <div class="cases">
            {list.map((c) => (
              <CaseTile c={c} />
            ))}
          </div>
        </section>
      ))}

      <p class="disclaimer">
        Игра бесплатная. Подарки и звёзды внутриигровые — вывести их нельзя. FORTUM DROPS не является проектом Telegram.
      </p>
    </>
  );
}

function CaseTile({ c }: { c: CaseCard }) {
  const rc = c.cover ? RARITY[c.cover.rarity].color : "#3d9bff";
  const cooldown = c.pay_mode === "free" ? timeLeft(c.cooldown_until) : null;
  const discounted = c.price < c.base_price;
  return (
    <button
      class="case-card glass"
      style={{ "--rc": rc }}
      onClick={() => {
        haptic.tap();
        go({ name: "case", id: c.id });
      }}
    >
      <div class="glow" />
      {c.badge && <span class="badge">{c.badge}</span>}
      <div class="art-wrap"><CaseCover name={c.name} category={c.category} cover={c.cover} size={104} /></div>
      <div class="name">{c.name}</div>
      <div class="sub num">
        до {short(c.max_value)} ★ · {c.items_count} призов
      </div>
      <div class="price num">
        {c.pay_mode === "free" ? (
          cooldown ? <span class="dim cooldown"><Ico name="hourglass" size={16} /> {cooldown}</span> : <span style={{ color: "var(--ok)" }}>Бесплатно</span>
        ) : c.pay_mode === "keys" ? (
          <>
            <KeyIcon /> {c.price_keys}
          </>
        ) : (
          <>
            {discounted && <s>{fmt(c.base_price)}</s>}
            <Star /> {fmt(c.price)}
          </>
        )}
      </div>
    </button>
  );
}

function DailyBonus() {
  const p = profile.value;
  const [busy, setBusy] = useState(false);
  if (!p) return <div class="skeleton" style={{ height: 80, marginTop: 4 }} />;

  const wait = timeLeft(p.daily_available_at);
  const streak = Math.min(p.daily_streak, 7);

  async function claim() {
    setBusy(true);
    try {
      const r = await api<Profile & { bonus: number }>("claim_daily");
      profile.value = r;
      haptic.success();
      showToast(`+${fmt(r.bonus)} ★`);
    } catch (e) {
      haptic.error();
      showToast(errorText(e), "err");
    } finally {
      setBusy(false);
    }
  }

  async function rescue() {
    setBusy(true);
    try {
      const r = await api<Profile & { amount: number }>("claim_rescue");
      profile.value = r;
      haptic.success();
      showToast(`+${fmt(r.amount)} ★`);
    } catch (e) {
      showToast(errorText(e), "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div class="bonus glass stage-bg" style={stageBg("home")}>
        <Ico name="daily" size={56} class="bonus-icon" />
        <div class="bonus-text">
          <b>Бонус дня</b>
          <span class="num">{wait ? `Следующий через ${wait}` : `+${fmt(p.daily_next_amount)} ★ уже ждут`}</span>
          <div class="streak">
            {Array.from({ length: 7 }, (_, i) => (
              <i class={i < (wait ? streak : streak) ? "on" : ""} />
            ))}
          </div>
        </div>
        <button class="btn gold small" disabled={!!wait || busy} onClick={claim}>
          {wait ? "Получено" : "Забрать"}
        </button>
      </div>
      {p.rescue_available && (
        <div class="bonus glass" style={{ marginTop: 10 }}>
          <Ico name="rescue" size={56} class="bonus-icon" />
          <div class="bonus-text">
            <b>Звёзды кончились?</b>
            <span>Держи 700 ★ на отыгрыш</span>
          </div>
          <button class="btn small" disabled={busy} onClick={rescue}>
            Получить
          </button>
        </div>
      )}
    </>
  );
}

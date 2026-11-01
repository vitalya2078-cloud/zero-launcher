#!/usr/bin/env python3
"""
Генерирует 0004: витрину кейсов (по цене, тематические, кейсы одного подарка, особые, реферальные),
задания и таблицы множителей колеса/плинко.

Состав кейсов задаётся здесь, а шансы считает сама база (giftsim.rebalance_case) под цену и возврат игроку,
поэтому при обновлении цен шансы пересчитываются автоматически.

Запуск: python3 tools/build_cases.py > supabase/migrations/0004_giftsim_cases_tasks.sql
"""
import json
import math
import os
from math import comb

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RTP = 0.90
SHAPE = 1.15

data = json.load(open(os.path.join(ROOT, "data", "nft_floors.json"), encoding="utf-8"))
RATE = data["stars_per_ton"]
GIFTS = {}
for g in data["gifts"]:
    g = dict(g)
    g["stars"] = max(1, round(g["floor_ton"] * RATE))
    GIFTS[g["slug"]] = g
ALL = sorted(GIFTS.values(), key=lambda g: (g["stars"], g["slug"]))  # только NFT

# Призы звёздами: зачисляются на баланс. Ключ: +1 реферальный ключ (ценность = средний выигрыш «Реферального I»).
STAR_AMOUNTS = [25, 50, 100, 150, 250, 400, 500, 750, 1000, 1500, 2500, 4000, 5000, 7500, 10000, 15000, 25000]
STARS = {f"stars_{a}": dict(slug=f"stars_{a}", name=f"{a:,} звёзд".replace(",", " "), stars=a, kind="stars")
         for a in STAR_AMOUNTS}
KEY = dict(slug="ref_key", name="Реферальный ключ", stars=3000, kind="key")
ITEMS = {**GIFTS, **STARS, KEY["slug"]: KEY}
ADD_KEYS = False  # ключ как приз в кейсах — по решению владельца


def star_prizes(price, fractions):
    """Призы звёздами примерно на заданные доли цены кейса (без повторов)."""
    out = []
    for f in fractions:
        amt = min(STAR_AMOUNTS, key=lambda a: abs(math.log(a / (price * f))))
        if STARS[f"stars_{amt}"] not in out:
            out.append(STARS[f"stars_{amt}"])
    return out


def q(s):
    return "null" if s is None else "'" + str(s).replace("'", "''") + "'"


def nice(x):
    e = 10 ** max(0, int(math.log10(x)) - 1)
    return int(round(x / e) * e)


def ev_at(values, a):
    w = [v ** -a for v in values]
    return sum(wi * v for wi, v in zip(w, values)) / sum(w)


def pick_spread(pool, n):
    pool = sorted(pool, key=lambda g: (g["stars"], g["slug"]))
    if len(pool) <= n:
        return pool
    if n == 1:
        return [pool[len(pool) // 2]]
    lo, hi = math.log(pool[0]["stars"]), math.log(pool[-1]["stars"])
    chosen = []
    for i in range(n):
        t = lo + (hi - lo) * i / (n - 1)
        best = min((g for g in pool if g not in chosen), key=lambda g: abs(math.log(g["stars"]) - t))
        chosen.append(best)
    return sorted(chosen, key=lambda g: g["stars"])


def jackpot_for(price, exclude):
    """Подарок ценой ~x35 от кейса (допустимо x15..x60)."""
    cands = [g for g in ALL if 15 * price <= g["stars"] <= 60 * price and g["slug"] not in exclude]
    if not cands:
        return None
    return min(cands, key=lambda g: abs(math.log(g["stars"] / (35 * price))))


CASES = []  # dict(id, name, category, items[slugs], price, pay_mode, price_keys, cooldown, rtp, badge, description, sort)


def add_case(cid, name, category, items, price=None, jackpot=True, stars=(), key=False, **kw):
    items = sorted({g["slug"]: g for g in items}.values(), key=lambda g: g["stars"])
    if price is None:
        price = nice(ev_at([g["stars"] for g in items], SHAPE) / kw.get("rtp", RTP))
    vals = [g["stars"] for g in items]
    if jackpot:
        jp = jackpot_for(price, {g["slug"] for g in items})
        if jp:
            items.append(jp)
    items += star_prizes(price, stars)
    if key and ADD_KEYS:
        items.append(KEY)
    target = kw.get("rtp", RTP) * price
    if not (min(g["stars"] for g in items) < target < max(g["stars"] for g in items)):
        raise SystemExit(f"{cid}: недостижимый возврат, цена {price}, подарки {vals}")
    CASES.append(dict(id=cid, name=name, category=category, items=[g["slug"] for g in items], price=price,
                      cover=max((g for g in items if g.get("kind", "nft") == "nft"), key=lambda g: g["stars"])["slug"], **kw))


def by_ton(lo, hi):
    return [g for g in ALL if lo <= g["floor_ton"] <= hi]


# ---------------------------------------------------------------- по цене (id первых шести сохраняются из 0002)
PRICE = [
    ("budget",    "Бюджетный",    (5, 9),       8),
    ("starter",   "Стартовый",    (5, 15),      8),
    ("festive",   "Праздничный",  (5, 60),      10),
    ("collector", "Коллекционер", (9, 200),     10),
    ("rare",      "Редкости",     (35, 600),    10),
    ("legends",   "Легенды",      (100, 3450),  10),
    ("pepe",      "Plush Pepe",   (200, 7000),  8),
]
for i, (cid, name, (lo, hi), n) in enumerate(PRICE):
    add_case(cid, name, "price", pick_spread(by_ton(lo, hi), n), stars=(0.3, 0.6), key=True, sort=i)

# ---------------------------------------------------------------- тематические
THEMES = [
    ("t_love", "❤️ Любовь", "heartlocket eternalrose lovepotion cupidcharm valentinebox lovecandle trappedheart bondedring "
                            "cookieheart prettyposy lushbouquet diamondring sakuraflower"),
    ("t_newyear", "🎄 Новый год", "santahat snowglobe snowmittens xmasstocking winterwreath jinglebells sleighbell candycane "
                                 "gingercookie holidaydrink spicedwine partysparkler bigyear jackinthebox hangingstar joyfulbundle"),
    ("t_mystic", "🔮 Мистика", "witchhat madpumpkin hexpot evileye voodoodoll skullflower crystalball flyingbroom magicpotion "
                              "genielamp electricskull spyagaric eternalcandle faithamulet moonpendant astralshard"),
    ("t_sweets", "🍰 Сладости", "homemadecake moussecake whipcupcake icecream vicecream lolpop hypnolollipop cookieheart "
                               "berrybox bunnymuffin instantramen candycane gingercookie happybrownie springbasket easteregg"),
    ("t_luxury", "💎 Роскошь", "swisswatch diamondring perfumebottle signetring gemsignet nailbracelet vintagecigar "
                              "skystilettos tophat bowtie iongem finepen luckylocket blingbinky heartlocket"),
    ("t_stars", "🎤 Звёзды", "snoopdogg snoopcigar westsidesign lowrider swagbag khabibspapakha ufcstrike durovscap "
                            "durovsglasses recordplayer"),
    ("t_animals", "🐸 Животные", "kissedfrog jellybunny petsnake lunarsnake snakebox jollychimp rarebird resistancedog "
                                "scaredcat toybear plushpepe nekohelmet bunnymuffin"),
    ("t_space", "🚀 Космос и техника", "stellarrocket astralshard iongem inputkey tamagadget recordplayer ionicdryer "
                                      "lightsword electricskull deskcalendar starnotepad surgeboard chillflame"),
    ("t_heroes", "⚔️ Герои", "heroichelmet mightyarm lightsword victorymedal libertyfigure artisanbrick ufcstrike "
                            "resistancedog nekohelmet khabibspapakha"),
    ("t_champions", "🏆 Чемпионы", "algorithmcup intelligencecup victorymedal heroichelmet mightyarm ufcstrike "
                                  "khabibspapakha minioscar"),
    ("t_durov", "🧢 Дуров", "durovscap durovsglasses lootbag westsidesign mightyarm scaredcat swisswatch kissedfrog "
                           "genielamp signetring"),
]
for i, (cid, name, slugs) in enumerate(THEMES):
    items = [GIFTS[s] for s in slugs.split() if s in GIFTS]
    add_case(cid, name, "theme", pick_spread(items, 12), jackpot=False, stars=(0.3, 0.6), key=True, sort=i)

# ---------------------------------------------------------------- кейс одного подарка: главный приз — сам подарок
TOP = sorted([g for g in ALL if g["stars"] >= 5000], key=lambda g: -g["stars"])[:18]
for i, t in enumerate(TOP):
    price = max(500, nice(t["stars"] / 100))
    mids = pick_spread([g for g in ALL if price * 1.5 <= g["stars"] <= t["stars"] / 5 and g["slug"] != t["slug"]], 2)
    cheap = pick_spread([g for g in ALL if g["stars"] <= price * 1.2], 1) or [ALL[0]]
    add_case("g_" + t["slug"], "Кейс " + t["name"], "gift", mids + cheap + [t], price=price, jackpot=False,
             stars=(0.1, 0.25, 0.5, 0.75), key=True, sort=i, description=f"Главный приз — {t['name']}")

# ---------------------------------------------------------------- особые и реферальные
add_case("free", "🎁 Бесплатный", "special", pick_spread(by_ton(5, 6), 2), price=300, stars=(0.1, 0.2, 0.4, 0.8),
         pay_mode="free", cooldown=4, description="Бесплатно раз в 4 часа", badge="Бесплатно", sort=0)
REF = [("ref_1", "🤝 Реферальный I", 1, 3000, (15, 150)),
       ("ref_3", "🤝 Реферальный II", 3, 10000, (40, 600)),
       ("ref_10", "🤝 Реферальный III", 10, 40000, (150, 3450))]
for i, (cid, name, keys, price, (lo, hi)) in enumerate(REF):
    add_case(cid, name, "referral", pick_spread(by_ton(lo, hi), 9), price=price, pay_mode="keys", price_keys=keys,
             rtp=1.0, description=f"Открывается за {keys} реф. ключ(а). Ключ даётся за каждого активного друга",
             badge="За друзей", sort=i)

# ---------------------------------------------------------------- задания
TASKS = [
    # id, title, description, kind, stat_key, target, period, stars, keys, sort, active
    ("d_cases3", "Открой 3 кейса", None, "stat", "cases_opened", 3, "daily", 300, 0, 1, True),
    ("d_crash5", "Сыграй 5 раундов в краш", None, "stat", "crash_played", 5, "daily", 300, 0, 2, True),
    ("d_minigames5", "Сыграй 5 мини-игр", "Колесо, мины, плинко или монетка", "stat", "minigames", 5, "daily", 300, 0, 3, True),
    ("d_upgrade1", "Сделай апгрейд", None, "stat", "upgrades", 1, "daily", 200, 0, 4, True),
    ("d_battle1", "Сыграй в битву кейсов", None, "stat", "battles", 1, "daily", 300, 0, 5, True),
    ("sub_channel", "Подпишись на канал", "Новости и розыгрыши", "subscribe", None, 1, "once", 1000, 1, 0, False),
    ("o_cases10", "Открой 10 кейсов", None, "stat", "cases_opened", 10, "once", 1000, 0, 10, True),
    ("o_cases100", "Открой 100 кейсов", None, "stat", "cases_opened", 100, "once", 5000, 1, 11, True),
    ("o_cases500", "Открой 500 кейсов", None, "stat", "cases_opened", 500, "once", 20000, 3, 12, True),
    ("o_level5", "Достигни 5 уровня", None, "stat", "level", 5, "once", 1500, 0, 20, True),
    ("o_level10", "Достигни 10 уровня", None, "stat", "level", 10, "once", 4000, 1, 21, True),
    ("o_level25", "Достигни 25 уровня", None, "stat", "level", 25, "once", 15000, 3, 22, True),
    ("o_streak7", "Заходи 7 дней подряд", None, "stat", "streak", 7, "once", 3000, 1, 30, True),
    ("o_invite1", "Пригласи друга", "Друг должен достичь 2 уровня", "stat", "invites", 1, "once", 1000, 0, 40, True),
    ("o_invite5", "Пригласи 5 друзей", "Друзья должны достичь 2 уровня", "stat", "invites", 5, "once", 5000, 2, 41, True),
    ("o_invite20", "Пригласи 20 друзей", "Друзья должны достичь 2 уровня", "stat", "invites", 20, "once", 25000, 5, 42, True),
    ("o_legendary", "Выбей легендарный подарок", "Легендарный или мифический из кейса", "stat", "legendary_drops", 1, "once", 3000, 0, 50, True),
    ("o_crash10x", "Забери x10 в краше", None, "stat", "crash_best_x100", 1000, "once", 3000, 0, 51, True),
    ("o_contract", "Заключи контракт", None, "stat", "contracts", 1, "once", 500, 0, 52, True),
    ("o_battlewin", "Выиграй битву кейсов", None, "stat", "battle_wins", 1, "once", 1500, 0, 53, True),
    ("o_jackpot", "Выиграй джекпот", None, "stat", "jackpot_wins", 1, "once", 2000, 0, 54, True),
]

# ---------------------------------------------------------------- таблицы множителей


def scale_wins(mults, probs, target):
    """Масштабирует ненулевые множители так, чтобы средний возврат был target. Округление до 0.01 вниз."""
    win_ev = sum(m * p for m, p in zip(mults, probs) if m > 0)
    k = target / win_ev
    out = [math.floor(m * k * 100) / 100 if m > 0 else 0 for m in mults]
    return out, sum(m * p for m, p in zip(out, probs))


WHEEL_SHAPES = {
    "low":  [1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.5, 1.2, 1.2, 1.2, 0, 1.2, 2, 1.2],
    "mid":  [0, 1.5, 0, 2, 0, 1.5, 0, 3, 0, 1.5, 0, 2, 0, 1.5, 0, 5, 0, 1.5, 0, 2],
    "high": [0] * 19 + [20],
}
PLINKO_SHAPES = {
    "low":  [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    "mid":  [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    "high": [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
}


def main():
    out = [
        "-- Сгенерировано tools/build_cases.py. Не редактировать вручную.",
        "-- Шансы в кейсах после вставки считает giftsim.rebalance_case под цену и target_rtp.",
        "",
    ]
    report = []
    for risk, shape in WHEEL_SHAPES.items():
        probs = [1 / len(shape)] * len(shape)
        m, rtp = scale_wins(shape, probs, 0.96)
        report.append(f"-- колесо {risk}: возврат {rtp:.4f}")
        out.append(f"insert into giftsim.settings (key, value) values ('wheel_{risk}', '{json.dumps(m)}') "
                   f"on conflict (key) do update set value = excluded.value, updated_at = now();")
    for risk, shape in PLINKO_SHAPES.items():
        n = len(shape) - 1
        probs = [comb(n, k) / 2 ** n for k in range(n + 1)]
        m, rtp = scale_wins(shape, probs, 0.96)
        report.append(f"-- плинко {risk}: возврат {rtp:.4f}")
        out.append(f"insert into giftsim.settings (key, value) values ('plinko_{risk}', '{json.dumps(m)}') "
                   f"on conflict (key) do update set value = excluded.value, updated_at = now();")
    out = out[:3] + report + [""] + out[3:]
    out.append("")

    rows = []
    for it in list(STARS.values()) + [KEY]:
        rarity = "rare" if it["kind"] == "key" else ("epic" if it["stars"] >= 10000 else "rare" if it["stars"] >= 2500 else "common")
        rows.append(f"  ({q(it['slug'])}, {q(it['name'])}, {q(it['kind'])}, {q(rarity)}, {it['stars']}, 'system')")
    out.append("insert into giftsim.gifts (id, name, kind, rarity, price_stars, source) values\n" + ",\n".join(rows))
    out.append("on conflict (id) do update set name = excluded.name, kind = excluded.kind, rarity = excluded.rarity, "
               "price_stars = excluded.price_stars;")
    out.append("")
    for c in CASES:
        out.append(f"-- {c['name']} [{c['category']}]: {c['price']} зв., призов {len(c['items'])}, "
                   f"макс. {max(ITEMS[s]['stars'] for s in c['items'])}")
        out.append(
            "insert into giftsim.cases (id, name, price_stars, cover_gift, sort, category, description, badge, pay_mode, "
            "price_keys, free_cooldown_h, odds_mode, target_rtp, active) values ("
            f"{q(c['id'])}, {q(c['name'])}, {c['price']}, {q(c['cover'])}, {c.get('sort', 0)}, {q(c['category'])}, "
            f"{q(c.get('description'))}, {q(c.get('badge'))}, {q(c.get('pay_mode', 'stars'))}, "
            f"{c.get('price_keys') or 'null'}, {c.get('cooldown') or 'null'}, 'auto', {c.get('rtp', RTP)}, true) "
            "on conflict (id) do update set name = excluded.name, price_stars = excluded.price_stars, "
            "cover_gift = excluded.cover_gift, sort = excluded.sort, category = excluded.category, "
            "description = excluded.description, badge = excluded.badge, pay_mode = excluded.pay_mode, "
            "price_keys = excluded.price_keys, free_cooldown_h = excluded.free_cooldown_h, "
            "odds_mode = excluded.odds_mode, target_rtp = excluded.target_rtp, active = true;")
        vals = ", ".join(f"({q(c['id'])}, {q(s)}, 1)" for s in c["items"])
        out.append(f"insert into giftsim.case_items (case_id, gift_id, weight) values {vals} "
                   "on conflict (case_id, gift_id) do nothing;")
    out.append("")
    out.append("select giftsim.rebalance_case(id) from giftsim.cases where odds_mode = 'auto';")
    out.append("")

    rows = []
    for t in TASKS:
        tid, title, desc, kind, stat, target, period, stars, keys, sort, active = t
        rows.append(f"  ({q(tid)}, {q(title)}, {q(desc)}, {q(kind)}, {q(stat)}, {target}, {q(period)}, "
                    f"{stars}, {keys}, {sort}, {'true' if active else 'false'})")
    out.append("insert into giftsim.tasks (id, title, description, kind, stat_key, target, period, reward_stars, "
               "reward_keys, sort, active) values\n" + ",\n".join(rows))
    out.append("on conflict (id) do update set title = excluded.title, description = excluded.description, "
               "kind = excluded.kind, stat_key = excluded.stat_key, target = excluded.target, period = excluded.period, "
               "reward_stars = excluded.reward_stars, reward_keys = excluded.reward_keys, sort = excluded.sort;")
    print("\n".join(out))


if __name__ == "__main__":
    main()

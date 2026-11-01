#!/usr/bin/env python3
"""
Генерирует SQL заполнения каталога: NFT-подарки из data/nft_floors.json и кейсы.

Шансы в кейсах: вес подарка ~ value^-a. Цена кейса выводится из содержимого
(средний выигрыш при a = SHAPE, делённый на RTP, округлённый), затем a уточняется так,
чтобы средний выигрыш был ровно RTP * цена. Чем дороже подарок, тем реже он выпадает.

Запуск: python3 tools/build_seed.py > supabase/migrations/0002_giftsim_seed.sql
"""
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RTP = 0.90    # возврат игроку: 90% от цены кейса в среднем
SHAPE = 1.15  # насколько сильно дорогие подарки реже дешёвых (1 = шанс обратно пропорционален цене)

# id, название, диапазон минимальных цен подарков в TON, сколько подарков в кейсе
CASES = [
    ("starter",   "Стартовый",    (5, 15),      8),
    ("festive",   "Праздничный",  (5, 60),      10),
    ("collector", "Коллекционер", (9, 200),     10),
    ("rare",      "Редкости",     (35, 600),    10),
    ("legends",   "Легенды",      (100, 3450),  10),
    ("pepe",      "Plush Pepe",   (200, 7000),  8),
]


def nice(x):
    """Округление до 2 значащих цифр: 1234 -> 1200."""
    e = 10 ** max(0, int(math.log10(x)) - 1)
    return int(round(x / e) * e)


def ev_at(values, a):
    w = [v ** -a for v in values]
    return sum(wi * v for wi, v in zip(w, values)) / sum(w)


def rarity(ton):
    if ton < 10:
        return "common"
    if ton < 50:
        return "rare"
    if ton < 300:
        return "epic"
    if ton < 2000:
        return "legendary"
    return "mythic"


def q(s):
    return "null" if s is None else "'" + str(s).replace("'", "''") + "'"


def pick_spread(pool, n):
    """n подарков, равномерно разнесённых по логарифму цены; всегда включает самый дешёвый и самый дорогой."""
    pool = sorted(pool, key=lambda g: (g["stars"], g["slug"]))
    if len(pool) <= n:
        return pool
    lo, hi = math.log(pool[0]["stars"]), math.log(pool[-1]["stars"])
    chosen = []
    for i in range(n):
        target = lo + (hi - lo) * i / (n - 1)
        best = min((g for g in pool if g not in chosen), key=lambda g: abs(math.log(g["stars"]) - target))
        chosen.append(best)
    return sorted(chosen, key=lambda g: g["stars"])


def weights_for(values, target):
    def ev(a):
        w = [v ** -a for v in values]
        return sum(wi * v for wi, v in zip(w, values)) / sum(w)

    lo, hi = -5.0, 20.0
    if not (ev(hi) < target < ev(lo)):
        raise SystemExit(f"нельзя получить EV={target} из {values}")
    for _ in range(200):
        mid = (lo + hi) / 2
        if ev(mid) > target:
            lo = mid
        else:
            hi = mid
    a = (lo + hi) / 2
    raw = [v ** -a for v in values]
    scale = 1_000_000_000 / sum(raw)
    return [max(1, round(r * scale)) for r in raw]


def main():
    data = json.load(open(os.path.join(ROOT, "data", "nft_floors.json"), encoding="utf-8"))
    rate = data["stars_per_ton"]
    gifts = []
    for g in data["gifts"]:
        g = dict(g)
        g["stars"] = max(1, round(g["floor_ton"] * rate))
        gifts.append(g)

    out = [
        "-- Сгенерировано tools/build_seed.py. Не редактировать вручную.",
        f"-- Источник цен: {data['source']}, дата {data['collected_at']}.",
        f"-- Курс: {data['stars_rate_source']} -> {rate} звёзд за 1 TON.",
        "",
        "insert into giftsim.settings (key, value) values ('start_balance', '3000'), ('daily_bonus', '500') "
        "on conflict (key) do update set value = excluded.value, updated_at = now();",
        "",
        "insert into giftsim.gifts (id, name, kind, rarity, price_stars, price_ton, supply, image_url, animation_url, source) values",
    ]
    rows = []
    for g in gifts:
        base = f"https://nft.fragment.com/gift/{g['slug']}-{g['img_num']}"
        rows.append(
            f"  ({q(g['slug'])}, {q(g['name'])}, 'nft', {q(rarity(g['floor_ton']))}, {g['stars']}, "
            f"{g['floor_ton']}, {g['supply']}, {q(base + '.webp')}, {q(base + '.lottie.json')}, 'fragment')"
        )
    out.append(",\n".join(rows))
    out.append(
        "on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, "
        "price_stars = excluded.price_stars, price_ton = excluded.price_ton, supply = excluded.supply, "
        "image_url = excluded.image_url, animation_url = excluded.animation_url, updated_at = now();"
    )
    out.append("")

    for sort, (cid, name, (lo, hi), n) in enumerate(CASES):
        pool = [g for g in gifts if lo <= g["floor_ton"] <= hi]
        items = pick_spread(pool, n)
        price = nice(ev_at([g["stars"] for g in items], SHAPE) / RTP)
        w = weights_for([g["stars"] for g in items], RTP * price)
        total = sum(w)
        ev = sum(wi * g["stars"] for wi, g in zip(w, items)) / total
        cover = items[-1]["slug"]
        out.append(f"\n-- {name}: {price} звёзд, средний выигрыш {ev:.0f} ({ev / price:.1%})")
        for wi, g in zip(w, items):
            out.append(f"--   {g['name']:<20} {g['stars']:>8} зв.  шанс {wi / total:.4%}")
        out.append(
            f"insert into giftsim.cases (id, name, price_stars, cover_gift, sort) values "
            f"({q(cid)}, {q(name)}, {price}, {q(cover)}, {sort}) "
            f"on conflict (id) do update set name = excluded.name, price_stars = excluded.price_stars, "
            f"cover_gift = excluded.cover_gift, sort = excluded.sort, active = true;"
        )
        vals = ", ".join(f"({q(cid)}, {q(g['slug'])}, {wi})" for wi, g in zip(w, items))
        out.append(f"insert into giftsim.case_items (case_id, gift_id, weight) values {vals} "
                   f"on conflict (case_id, gift_id) do update set weight = excluded.weight;")

    print("\n".join(out))


if __name__ == "__main__":
    main()

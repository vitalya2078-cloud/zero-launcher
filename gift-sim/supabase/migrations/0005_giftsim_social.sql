-- FORTUM DROPS: топ игроков, публичный профиль игрока, живая лента выигрышей.

-- Публичный идентификатор игрока: в клиент уходит он, а не Telegram ID.
alter table giftsim.users add column if not exists public_id uuid not null default gen_random_uuid();
create unique index if not exists users_public_id_key on giftsim.users (public_id);

-- ---------------------------------------------------------------- выигрыши игрока
-- Кейсы (включая звёзды, которые сразу уходят на баланс) + подарки из апгрейда, контракта, джекпота и битв.
create or replace function giftsim._user_wins(p_user bigint, p_limit int) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select coalesce(jsonb_agg(w order by (w->>'at') desc), '[]'::jsonb) from (
        select * from (
            select giftsim._gift_json(o.gift_id) || jsonb_build_object('source', 'case', 'at', o.created_at) as w
              from giftsim.case_opens o
             where o.user_id = p_user
             union all
            select giftsim._gift_json(i.gift_id) || jsonb_build_object('source', i.source, 'at', i.obtained_at)
              from giftsim.inventory i
             where i.user_id = p_user and i.source in ('upgrade', 'contract', 'jackpot', 'battle')
        ) x
        order by (w->>'at') desc
        limit least(greatest(p_limit, 1), 50)
    ) t
$$;

-- ---------------------------------------------------------------- «выиграно за всё время»
-- users.total_won копит только краш, поэтому считаем по журналу: выигрыши в играх, звёзды из кейсов
-- и стоимость всех выигранных подарков (на момент выпадения). Админская выдача, бонусы и награды не входят.
create or replace function giftsim._won_total(p_user bigint) returns bigint
language sql stable set search_path = giftsim, pg_temp as $$
    select coalesce((select sum(amount) from giftsim.transactions
                      where user_id = p_user and reason in ('crash_win', 'game_win', 'prize_stars')), 0)
         + coalesce((select sum(value_at_drop) from giftsim.inventory
                      where user_id = p_user and source in ('case', 'upgrade', 'contract', 'jackpot', 'battle')), 0)
$$;

-- ---------------------------------------------------------------- топ
create or replace function giftsim._lb_score(p_kind text, p_user bigint) returns bigint
language sql stable set search_path = giftsim, pg_temp as $$
    select case p_kind
        when 'level' then (select xp from giftsim.users where tg_id = p_user)
        when 'inventory' then coalesce((select sum(g.price_stars) from giftsim.inventory i join giftsim.gifts g on g.id = i.gift_id
                                         where i.user_id = p_user and i.status = 'owned'), 0)
        else giftsim._won_total(p_user) end
$$;

create or replace function giftsim.leaderboard(p_kind text, p_viewer bigint) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    with scored as (
        select u.tg_id, u.public_id, u.first_name, u.photo_url, u.level,
               case p_kind
                   when 'level' then u.xp
                   when 'inventory' then coalesce(inv.v, 0)
                   else coalesce(tw.v, 0) + coalesce(iw.v, 0) end as score
          from giftsim.users u
          left join (select i.user_id, sum(g.price_stars) v from giftsim.inventory i join giftsim.gifts g on g.id = i.gift_id
                      where i.status = 'owned' group by i.user_id) inv on inv.user_id = u.tg_id
          left join (select user_id, sum(amount) v from giftsim.transactions
                      where reason in ('crash_win', 'game_win', 'prize_stars') group by user_id) tw on tw.user_id = u.tg_id
          left join (select user_id, sum(value_at_drop) v from giftsim.inventory
                      where source in ('case', 'upgrade', 'contract', 'jackpot', 'battle') group by user_id) iw on iw.user_id = u.tg_id
    ), ranked as (
        select *, row_number() over (order by score desc, tg_id) as rank from scored where score > 0
    )
    select jsonb_build_object(
        'kind', coalesce(nullif(p_kind, ''), 'won'),
        'items', coalesce((select jsonb_agg(jsonb_build_object(
                     'id', public_id, 'user', coalesce(first_name, 'Игрок'), 'photo_url', photo_url, 'level', level,
                     'score', score, 'rank', rank, 'me', tg_id = p_viewer) order by rank)
                  from ranked where rank <= 50), '[]'::jsonb),
        'me', (select jsonb_build_object('rank', rank, 'score', score) from ranked where tg_id = p_viewer)
    )
$$;

-- ---------------------------------------------------------------- публичный профиль
create or replace function giftsim.player_profile(p_public_id uuid, p_viewer bigint) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select jsonb_build_object(
        'id', u.public_id, 'user', coalesce(u.first_name, 'Игрок'), 'photo_url', u.photo_url,
        'level', u.level, 'me', u.tg_id = p_viewer,
        'total_won', giftsim._won_total(u.tg_id),
        'cases_opened', (select count(*) from giftsim.case_opens o where o.user_id = u.tg_id),
        'since', u.created_at,
        'collection_value', coalesce(c.v, 0),
        'collection_count', coalesce(c.n, 0),
        'collection', coalesce((select jsonb_agg(x.j order by x.v desc) from (
                          select giftsim._gift_json(i.gift_id) || jsonb_build_object('inv_id', i.id) as j, g.price_stars as v
                            from giftsim.inventory i join giftsim.gifts g on g.id = i.gift_id
                           where i.user_id = u.tg_id and i.status = 'owned'
                           order by g.price_stars desc limit 60) x), '[]'::jsonb),
        'best', (select giftsim._gift_json(o.gift_id) from giftsim.case_opens o join giftsim.gifts g on g.id = o.gift_id
                  where o.user_id = u.tg_id order by g.price_stars desc limit 1),
        'recent', giftsim._user_wins(u.tg_id, 20)
    )
    from giftsim.users u
    left join (select i.user_id, sum(g.price_stars) v, count(*) n from giftsim.inventory i join giftsim.gifts g on g.id = i.gift_id
                where i.status = 'owned' group by i.user_id) c on c.user_id = u.tg_id
    where u.public_id = p_public_id
$$;

-- ---------------------------------------------------------------- живая лента
-- Настоящие выигрыши + фоновые выигрыши «из зала», чтобы лента не стояла пустой.
-- Фоновые детерминированы по времени (слоты по 5 с): у всех игроков одна и та же лента, она не скачет при опросе.
-- Кейс выбирается чаще дешёвый, приз — по весам этого кейса, сглаженным (вес^0.6): звёзды и дешёвые подарки
-- по-прежнему чаще всего, но в ленте заметнее редкие призы.
create or replace function giftsim._rnd(p_seed text) returns double precision
language sql immutable as $$
    select ('x' || substr(md5(p_seed), 1, 8))::bit(32)::bigint / 4294967296.0
$$;

create or replace function giftsim.recent_drops(p_limit int default 20) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    with lim as (select least(greatest(p_limit, 1), 50) as n),
    real_drops as (
        select * from (
            select giftsim._gift_json(o.gift_id) || jsonb_build_object('user', coalesce(u.first_name, 'Игрок'), 'uid', u.public_id,
                       'source', 'case', 'at', o.created_at) as d, o.created_at as at
              from giftsim.case_opens o join giftsim.users u on u.tg_id = o.user_id
             order by o.created_at desc limit 50
        ) a
        union all
        select * from (
            select giftsim._gift_json(i.gift_id) || jsonb_build_object('user', coalesce(u.first_name, 'Игрок'), 'uid', u.public_id,
                       'source', i.source, 'at', i.obtained_at), i.obtained_at
              from giftsim.inventory i join giftsim.users u on u.tg_id = i.user_id
             where i.source in ('upgrade', 'contract', 'jackpot', 'battle')
             order by i.obtained_at desc limit 50
        ) b
    ),
    slots as (
        select k, to_timestamp(k * 5 + floor(giftsim._rnd('t' || k) * 5)) as at,
               giftsim._rnd('c' || k) as r_case, giftsim._rnd('g' || k) as r_gift, giftsim._rnd('n' || k) as r_name
          from generate_series(floor(extract(epoch from now()) / 5)::bigint - 80, floor(extract(epoch from now()) / 5)::bigint) k
         where giftsim._rnd('s' || k) < 0.7
    ),
    cases_w as (
        select id, sum(w) over (order by id) as cum, sum(w) over () as tot
          from (select id, 1.0 / sqrt(greatest(price_stars, 100)) as w from giftsim.cases
                 where active and pay_mode = 'stars' and category in ('price', 'gift', 'theme')) c
    ),
    names as (
        select array['Артём','Никита','Маша','Даня','Алина','Влад','Катя','Илья','Соня','Max','Kirill','Лёша','Polina','Егор','Вика',
                     'Тимур','Настя','Рома','Даша','Миша','Arina','Глеб','Лиза','Саша','Denis','Ваня','Ника','Олег','Юля','Mark',
                     'Стас','Яна','Женя','Ксюша','Паша','Lena','Богдан','Аня','Слава','Vera','Кир','Милана','Сергей','Ульяна','Fedor',
                     'Марк','Диана','Gleb','Эмиль','Таня','Artur','Лев','Варя','Nikolai','Ева','Захар','Alex','Рита','Матвей','Zlata'] as a
    ),
    fake as (
        select giftsim._gift_json(g.gift_id) || jsonb_build_object('user', n.a[1 + floor(s.r_name * array_length(n.a, 1))::int],
                   'uid', null, 'source', 'case', 'at', s.at) as d, s.at
          from slots s
          cross join names n
          cross join lateral (select id from cases_w where cum >= s.r_case * tot order by cum limit 1) c
          cross join lateral (
              select gift_id from (
                  select gift_id, sum(power(weight, 0.6)) over (order by gift_id) as cum, sum(power(weight, 0.6)) over () as tot
                    from giftsim.case_items where case_id = c.id and weight > 0) ci
               where cum >= s.r_gift * tot order by cum limit 1) g
         where s.at <= now()
    )
    select coalesce(jsonb_agg(d order by at desc), '[]'::jsonb)
      from (select d, at from (select * from real_drops union all select * from fake) all_drops
             order by at desc limit (select n from lim)) t
$$;

revoke all on all functions in schema giftsim from public, anon, authenticated;

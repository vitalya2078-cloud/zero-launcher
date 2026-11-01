-- Gift Sim: схема симулятора подарков Telegram.
-- Всё живёт в отдельной схеме giftsim. Доступ только у серверных функций
-- (Edge Functions подключаются к базе напрямую); anon/authenticated доступа не имеют.
-- Баланс и цены — во внутренних «звёздах» (виртуальная валюта, не Telegram Stars).

create schema if not exists giftsim;
revoke all on schema giftsim from public, anon, authenticated;

-- ---------------------------------------------------------------- настройки

create table giftsim.settings (
    key   text primary key,
    value jsonb not null,
    updated_at timestamptz not null default now()
);

insert into giftsim.settings (key, value) values
    ('stars_per_ton',    '81.37'),  -- Fragment, 01.11.2026: 1000 Stars = 12.29 TON
    ('start_balance',    '1000'),
    ('daily_bonus',      '200'),
    ('daily_cooldown_h', '24'),
    ('crash_house_edge', '0.04'),
    ('crash_rate',       '0.06'),   -- множитель = e^(rate * секунды)
    ('crash_min_bet',    '10'),
    ('crash_max_bet',    '1000000');

create function giftsim.setting(p_key text) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select value from giftsim.settings where key = p_key
$$;

-- ---------------------------------------------------------------- каталог подарков

create table giftsim.gifts (
    id            text primary key,                 -- slug: plushpepe, regular-heart
    name          text not null,
    kind          text not null check (kind in ('regular', 'nft')),
    rarity        text not null check (rarity in ('common', 'rare', 'epic', 'legendary', 'mythic')),
    price_stars   bigint not null check (price_stars > 0),
    price_ton     numeric(14, 2),                   -- минимальная цена на Fragment (только NFT)
    supply        integer,                          -- сколько выпущено (только NFT)
    image_url     text,
    animation_url text,                             -- lottie json
    tg_gift_id    text,                             -- id обычного подарка из Bot API getAvailableGifts
    source        text,                             -- откуда взяты данные
    active        boolean not null default true,
    updated_at    timestamptz not null default now()
);

create index gifts_kind_price on giftsim.gifts (kind, price_stars);

-- ---------------------------------------------------------------- игроки и баланс

create table giftsim.users (
    tg_id         bigint primary key,
    username      text,
    first_name    text,
    last_name     text,
    photo_url     text,
    language      text,
    balance       bigint not null default 0 check (balance >= 0),
    total_won     bigint not null default 0,
    total_spent   bigint not null default 0,
    last_daily_at timestamptz,
    created_at    timestamptz not null default now(),
    last_seen_at  timestamptz not null default now()
);

-- Журнал всех движений баланса: по нему всегда можно проверить, откуда деньги.
create table giftsim.transactions (
    id            bigint generated always as identity primary key,
    user_id       bigint not null references giftsim.users (tg_id) on delete cascade,
    amount        bigint not null,
    balance_after bigint not null,
    reason        text not null check (reason in
                    ('start', 'daily', 'case_open', 'item_sell', 'crash_bet', 'crash_win', 'admin')),
    ref           text,
    created_at    timestamptz not null default now()
);

create index transactions_user_time on giftsim.transactions (user_id, created_at desc);

-- ---------------------------------------------------------------- инвентарь

create table giftsim.inventory (
    id           bigint generated always as identity primary key,
    user_id      bigint not null references giftsim.users (tg_id) on delete cascade,
    gift_id      text not null references giftsim.gifts (id),
    status       text not null default 'owned' check (status in ('owned', 'sold')),
    source       text not null check (source in ('case', 'crash', 'daily', 'admin')),
    source_ref   text,
    value_at_drop bigint not null,
    obtained_at  timestamptz not null default now(),
    sold_at      timestamptz,
    sold_for     bigint
);

create index inventory_user_owned on giftsim.inventory (user_id, obtained_at desc) where status = 'owned';

-- ---------------------------------------------------------------- кейсы

create table giftsim.cases (
    id          text primary key,
    name        text not null,
    price_stars bigint not null check (price_stars > 0),
    cover_gift  text references giftsim.gifts (id),
    sort        integer not null default 0,
    active      boolean not null default true
);

create table giftsim.case_items (
    case_id text not null references giftsim.cases (id) on delete cascade,
    gift_id text not null references giftsim.gifts (id),
    weight  integer not null check (weight > 0),
    primary key (case_id, gift_id)
);

create table giftsim.case_opens (
    id           bigint generated always as identity primary key,
    user_id      bigint not null references giftsim.users (tg_id) on delete cascade,
    case_id      text not null references giftsim.cases (id),
    price        bigint not null,
    gift_id      text not null references giftsim.gifts (id),
    inventory_id bigint references giftsim.inventory (id),
    created_at   timestamptz not null default now()
);

create index case_opens_user_time on giftsim.case_opens (user_id, created_at desc);
create index case_opens_time on giftsim.case_opens (created_at desc);

-- ---------------------------------------------------------------- краш

create table giftsim.crash_rounds (
    id           bigint generated always as identity primary key,
    user_id      bigint not null references giftsim.users (tg_id) on delete cascade,
    bet          bigint not null check (bet > 0),
    crash_point  numeric(12, 2) not null,           -- известна только серверу до конца раунда
    auto_cashout numeric(12, 2),
    status       text not null default 'active' check (status in ('active', 'cashed', 'busted')),
    cashout_at   numeric(12, 2),
    payout       bigint not null default 0,
    started_at   timestamptz not null default clock_timestamp(),
    ended_at     timestamptz
);

-- не больше одного активного раунда на игрока
create unique index crash_one_active on giftsim.crash_rounds (user_id) where status = 'active';
create index crash_user_time on giftsim.crash_rounds (user_id, started_at desc);

-- ---------------------------------------------------------------- RLS: всё закрыто для клиентских ролей

alter table giftsim.settings     enable row level security;
alter table giftsim.gifts        enable row level security;
alter table giftsim.users        enable row level security;
alter table giftsim.transactions enable row level security;
alter table giftsim.inventory    enable row level security;
alter table giftsim.cases        enable row level security;
alter table giftsim.case_items   enable row level security;
alter table giftsim.case_opens   enable row level security;
alter table giftsim.crash_rounds enable row level security;
-- Политик нет намеренно: anon/authenticated не видят ничего, серверная роль postgres обходит RLS.

-- ================================================================ логика

-- Криптостойкое случайное число в [0, 1).
create function giftsim.rand() returns double precision
language sql volatile set search_path = giftsim, extensions, pg_temp as $$
    select (('x' || encode(extensions.gen_random_bytes(7), 'hex'))::bit(56)::bigint)::double precision
           / 72057594037927936.0  -- 2^56
$$;

-- Единственное место, где меняется баланс. Блокирует строку игрока.
create function giftsim._move(p_user bigint, p_amount bigint, p_reason text, p_ref text)
returns bigint
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_balance bigint;
begin
    update giftsim.users
       set balance     = balance + p_amount,
           total_won   = total_won   + case when p_reason = 'crash_win' then p_amount else 0 end,
           total_spent = total_spent + greatest(-p_amount, 0)
     where tg_id = p_user
    returning balance into v_balance;

    if v_balance is null then
        raise exception 'user_not_found';
    end if;
    -- check (balance >= 0) не даст уйти в минус: ловим и отдаём понятную ошибку
    insert into giftsim.transactions (user_id, amount, balance_after, reason, ref)
    values (p_user, p_amount, v_balance, p_reason, p_ref);
    return v_balance;
exception
    when check_violation then
        raise exception 'insufficient_balance';
end;
$$;

-- Создаёт игрока при первом входе (со стартовым балансом) и обновляет профиль.
create function giftsim.ensure_user(
    p_tg_id bigint, p_username text, p_first_name text, p_last_name text,
    p_photo_url text, p_language text
) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_new boolean;
begin
    insert into giftsim.users (tg_id, username, first_name, last_name, photo_url, language)
    values (p_tg_id, p_username, p_first_name, p_last_name, p_photo_url, p_language)
    on conflict (tg_id) do update
        set username = excluded.username, first_name = excluded.first_name,
            last_name = excluded.last_name, photo_url = excluded.photo_url,
            language = excluded.language, last_seen_at = now()
    returning (xmax = 0) into v_new;

    if v_new then
        perform giftsim._move(p_tg_id, (giftsim.setting('start_balance'))::bigint, 'start', null);
    end if;
    return giftsim.get_state(p_tg_id) || jsonb_build_object('is_new', v_new);
end;
$$;

-- Баланс, инвентарь и таймер ежедневного бонуса.
create function giftsim.get_state(p_tg_id bigint) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select jsonb_build_object(
        'balance', u.balance,
        'daily_available_at', coalesce(u.last_daily_at + make_interval(hours => (giftsim.setting('daily_cooldown_h'))::int), now()),
        'inventory', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', i.id, 'gift_id', i.gift_id, 'name', g.name, 'kind', g.kind,
                       'rarity', g.rarity, 'value', g.price_stars, 'image_url', g.image_url,
                       'animation_url', g.animation_url, 'obtained_at', i.obtained_at)
                   order by i.obtained_at desc)
              from giftsim.inventory i join giftsim.gifts g on g.id = i.gift_id
             where i.user_id = u.tg_id and i.status = 'owned'), '[]'::jsonb),
        'inventory_value', coalesce((
            select sum(g.price_stars) from giftsim.inventory i join giftsim.gifts g on g.id = i.gift_id
             where i.user_id = u.tg_id and i.status = 'owned'), 0)
    )
    from giftsim.users u where u.tg_id = p_tg_id
$$;

create function giftsim.claim_daily(p_tg_id bigint) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_last timestamptz;
    v_bonus bigint := (giftsim.setting('daily_bonus'))::bigint;
begin
    select last_daily_at into v_last from giftsim.users where tg_id = p_tg_id for update;
    if not found then raise exception 'user_not_found'; end if;
    if v_last is not null and v_last + make_interval(hours => (giftsim.setting('daily_cooldown_h'))::int) > now() then
        raise exception 'daily_not_ready';
    end if;
    update giftsim.users set last_daily_at = now() where tg_id = p_tg_id;
    perform giftsim._move(p_tg_id, v_bonus, 'daily', null);
    return jsonb_build_object('bonus', v_bonus) || giftsim.get_state(p_tg_id);
end;
$$;

-- Каталог кейсов с содержимым и шансами (для экрана кейсов).
create function giftsim.list_cases() returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select coalesce(jsonb_agg(c order by (c->>'sort')::int), '[]'::jsonb) from (
        select jsonb_build_object(
            'id', cs.id, 'name', cs.name, 'price', cs.price_stars, 'sort', cs.sort,
            'cover', (select image_url from giftsim.gifts where id = cs.cover_gift),
            'items', (
                select jsonb_agg(jsonb_build_object(
                           'gift_id', g.id, 'name', g.name, 'rarity', g.rarity, 'value', g.price_stars,
                           'image_url', g.image_url, 'animation_url', g.animation_url,
                           'chance', round(ci.weight::numeric / tot.w * 100, 4))
                       order by g.price_stars desc)
                  from giftsim.case_items ci
                  join giftsim.gifts g on g.id = ci.gift_id
                 cross join (select sum(weight) as w from giftsim.case_items where case_id = cs.id) tot
                 where ci.case_id = cs.id)
        ) as c
        from giftsim.cases cs where cs.active
    ) t
$$;

-- Открытие кейса: списание, взвешенный случайный выбор, подарок в инвентарь.
create function giftsim.open_case(p_tg_id bigint, p_case_id text) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_price bigint;
    v_total bigint;
    v_roll  double precision;
    v_gift  text;
    v_value bigint;
    v_inv   bigint;
    v_open  bigint;
begin
    select price_stars into v_price from giftsim.cases where id = p_case_id and active;
    if v_price is null then raise exception 'case_not_found'; end if;

    perform giftsim._move(p_tg_id, -v_price, 'case_open', p_case_id);

    select sum(weight) into v_total from giftsim.case_items where case_id = p_case_id;
    v_roll := giftsim.rand() * v_total;

    select gift_id into v_gift from (
        select gift_id, sum(weight) over (order by gift_id) as upto
          from giftsim.case_items where case_id = p_case_id
    ) t where upto > v_roll order by upto limit 1;

    select price_stars into v_value from giftsim.gifts where id = v_gift;

    insert into giftsim.case_opens (user_id, case_id, price, gift_id)
    values (p_tg_id, p_case_id, v_price, v_gift) returning id into v_open;

    insert into giftsim.inventory (user_id, gift_id, source, source_ref, value_at_drop)
    values (p_tg_id, v_gift, 'case', v_open::text, v_value) returning id into v_inv;

    update giftsim.case_opens set inventory_id = v_inv where id = v_open;

    return jsonb_build_object(
        'inventory_id', v_inv,
        'gift', (select jsonb_build_object('id', id, 'name', name, 'kind', kind, 'rarity', rarity,
                        'value', price_stars, 'image_url', image_url, 'animation_url', animation_url)
                   from giftsim.gifts where id = v_gift),
        'balance', (select balance from giftsim.users where tg_id = p_tg_id)
    );
end;
$$;

-- Продажа подарка из инвентаря по текущей цене каталога.
create function giftsim.sell_item(p_tg_id bigint, p_inventory_id bigint) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_price bigint;
    v_balance bigint;
begin
    select g.price_stars into v_price
      from giftsim.inventory i join giftsim.gifts g on g.id = i.gift_id
     where i.id = p_inventory_id and i.user_id = p_tg_id and i.status = 'owned'
       for update of i;
    if v_price is null then raise exception 'item_not_found'; end if;

    update giftsim.inventory set status = 'sold', sold_at = now(), sold_for = v_price
     where id = p_inventory_id;
    v_balance := giftsim._move(p_tg_id, v_price, 'item_sell', p_inventory_id::text);
    return jsonb_build_object('sold_for', v_price, 'balance', v_balance);
end;
$$;

-- ---------------------------------------------------------------- краш: одиночный режим
-- Точка взрыва выбирается сервером при старте и не отдаётся клиенту до конца раунда.
-- Множитель считается по серверному времени, поэтому подделать момент «забрать» нельзя.

create function giftsim._crash_multiplier(p_started timestamptz) returns numeric
language sql stable set search_path = giftsim, pg_temp as $$
    select floor(exp((giftsim.setting('crash_rate'))::numeric
                     * extract(epoch from clock_timestamp() - p_started)) * 100) / 100
$$;

-- Закрывает раунд, если он уже взорвался или сработал автовывод.
create function giftsim._crash_settle(p_round giftsim.crash_rounds) returns giftsim.crash_rounds
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_m numeric := giftsim._crash_multiplier(p_round.started_at);
    v_r giftsim.crash_rounds := p_round;
begin
    if v_r.status <> 'active' then return v_r; end if;

    if v_r.auto_cashout is not null and v_r.auto_cashout < v_r.crash_point and v_m >= v_r.auto_cashout then
        update giftsim.crash_rounds
           set status = 'cashed', cashout_at = auto_cashout, payout = floor(bet * auto_cashout), ended_at = clock_timestamp()
         where id = v_r.id returning * into v_r;
        perform giftsim._move(v_r.user_id, v_r.payout, 'crash_win', v_r.id::text);
    elsif v_m >= v_r.crash_point then
        update giftsim.crash_rounds set status = 'busted', ended_at = clock_timestamp()
         where id = v_r.id returning * into v_r;
    end if;
    return v_r;
end;
$$;

create function giftsim._crash_public(p_round giftsim.crash_rounds) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select jsonb_build_object(
        'round_id', p_round.id, 'bet', p_round.bet, 'status', p_round.status,
        'auto_cashout', p_round.auto_cashout, 'started_at', p_round.started_at,
        'server_time', clock_timestamp(), 'rate', giftsim.setting('crash_rate'),
        'cashout_at', p_round.cashout_at, 'payout', p_round.payout,
        -- точка взрыва раскрывается только после окончания раунда
        'crash_point', case when p_round.status = 'active' then null else p_round.crash_point end,
        'balance', (select balance from giftsim.users where tg_id = p_round.user_id)
    )
$$;

create function giftsim.crash_start(p_tg_id bigint, p_bet bigint, p_auto_cashout numeric default null)
returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_edge  numeric := (giftsim.setting('crash_house_edge'))::numeric;
    v_point numeric;
    v_r     giftsim.crash_rounds;
begin
    if p_bet < (giftsim.setting('crash_min_bet'))::bigint or p_bet > (giftsim.setting('crash_max_bet'))::bigint then
        raise exception 'bad_bet';
    end if;
    if p_auto_cashout is not null and p_auto_cashout < 1.01 then
        raise exception 'bad_auto_cashout';
    end if;

    -- закрываем зависший предыдущий раунд, если он уже должен был закончиться
    for v_r in select * from giftsim.crash_rounds where user_id = p_tg_id and status = 'active' for update loop
        v_r := giftsim._crash_settle(v_r);
        if v_r.status = 'active' then raise exception 'round_active'; end if;
    end loop;

    -- классическое распределение: P(точка >= x) = (1 - edge) / x
    v_point := greatest(1.00, floor((1 - v_edge) / (1 - giftsim.rand()) * 100) / 100);
    v_point := least(v_point, 10000.00);

    insert into giftsim.crash_rounds (user_id, bet, crash_point, auto_cashout)
    values (p_tg_id, p_bet, v_point, p_auto_cashout) returning * into v_r;

    -- при нехватке баланса исключение откатит и вставку раунда
    perform giftsim._move(p_tg_id, -p_bet, 'crash_bet', v_r.id::text);

    return giftsim._crash_public(v_r);
end;
$$;

create function giftsim.crash_cashout(p_tg_id bigint, p_round_id bigint) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_r giftsim.crash_rounds;
    v_m numeric;
begin
    select * into v_r from giftsim.crash_rounds
     where id = p_round_id and user_id = p_tg_id for update;
    if not found then raise exception 'round_not_found'; end if;

    v_r := giftsim._crash_settle(v_r);
    if v_r.status = 'active' then
        v_m := giftsim._crash_multiplier(v_r.started_at);
        update giftsim.crash_rounds
           set status = 'cashed', cashout_at = v_m, payout = floor(bet * v_m), ended_at = clock_timestamp()
         where id = v_r.id returning * into v_r;
        perform giftsim._move(p_tg_id, v_r.payout, 'crash_win', v_r.id::text);
    end if;
    return giftsim._crash_public(v_r);
end;
$$;

-- Состояние раунда (клиент опрашивает, чтобы узнать о взрыве / автовыводе).
create function giftsim.crash_status(p_tg_id bigint, p_round_id bigint) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_r giftsim.crash_rounds;
begin
    select * into v_r from giftsim.crash_rounds
     where id = p_round_id and user_id = p_tg_id for update;
    if not found then raise exception 'round_not_found'; end if;
    return giftsim._crash_public(giftsim._crash_settle(v_r));
end;
$$;

-- Последние точки взрыва игрока — для полоски истории над графиком.
create function giftsim.crash_history(p_tg_id bigint) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select coalesce(jsonb_agg(crash_point order by started_at desc), '[]'::jsonb) from (
        select crash_point, started_at from giftsim.crash_rounds
         where user_id = p_tg_id and status <> 'active'
         order by started_at desc limit 20
    ) t
$$;

-- Лента последних дропов всех игроков (для «живой» ленты на главной).
create function giftsim.recent_drops(p_limit int default 20) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select coalesce(jsonb_agg(d order by (d->>'at') desc), '[]'::jsonb) from (
        select jsonb_build_object(
                   'name', g.name, 'rarity', g.rarity, 'value', g.price_stars, 'image_url', g.image_url,
                   'user', coalesce(u.first_name, 'Игрок'), 'at', o.created_at) as d
          from giftsim.case_opens o
          join giftsim.gifts g on g.id = o.gift_id
          join giftsim.users u on u.tg_id = o.user_id
         order by o.created_at desc
         limit least(greatest(p_limit, 1), 50)
    ) t
$$;

-- Функции вызываются только серверной ролью.
revoke all on all functions in schema giftsim from public, anon, authenticated;
revoke all on all tables in schema giftsim from public, anon, authenticated;
alter default privileges in schema giftsim revoke all on functions from public, anon, authenticated;
alter default privileges in schema giftsim revoke all on tables from public, anon, authenticated;

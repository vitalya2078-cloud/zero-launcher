-- Gift Sim, часть 2: история цен, расширенные кейсы, все мини-игры, прогресс игрока,
-- рефералы, задания и админка. Применяется поверх 0001/0002.

-- ================================================================ расширение существующих таблиц

alter table giftsim.transactions drop constraint transactions_reason_check;
alter table giftsim.transactions add constraint transactions_reason_check check (reason in (
    'start', 'daily', 'case_open', 'item_sell', 'crash_bet', 'crash_win', 'admin',
    'referral_bonus', 'referral_reward', 'referral_commission', 'level_reward', 'task_reward', 'rescue',
    'game_bet', 'game_win', 'battle_join', 'battle_refund', 'prize_stars'));

-- в кейсах кроме NFT-подарков бывают призы звёздами и реферальные ключи
alter table giftsim.gifts drop constraint gifts_kind_check;
alter table giftsim.gifts add constraint gifts_kind_check check (kind in ('regular', 'nft', 'stars', 'key'));

alter table giftsim.inventory drop constraint inventory_status_check;
alter table giftsim.inventory add constraint inventory_status_check
    check (status in ('owned', 'sold', 'consumed', 'staked'));
alter table giftsim.inventory drop constraint inventory_source_check;
alter table giftsim.inventory add constraint inventory_source_check check (source in (
    'case', 'crash', 'daily', 'admin', 'upgrade', 'contract', 'jackpot', 'battle', 'task'));

alter table giftsim.users
    add column xp              bigint  not null default 0,
    add column level           integer not null default 0,
    add column daily_streak    integer not null default 0,
    add column referral_keys   integer not null default 0 check (referral_keys >= 0),
    add column referred_by     bigint references giftsim.users (tg_id),
    add column referral_active boolean not null default false,
    add column last_rescue_at  timestamptz;

create index users_referred_by on giftsim.users (referred_by) where referred_by is not null;

alter table giftsim.cases
    add column category        text not null default 'price'
        check (category in ('price', 'theme', 'gift', 'special', 'referral', 'custom')),
    add column description     text,
    add column badge           text,
    add column pay_mode        text not null default 'stars' check (pay_mode in ('stars', 'free', 'keys')),
    add column price_keys      integer check (price_keys > 0),
    add column free_cooldown_h integer check (free_cooldown_h > 0),
    add column available_until timestamptz,
    add column max_opens       integer check (max_opens > 0),
    add column opens_count     integer not null default 0,
    add column odds_mode       text not null default 'auto' check (odds_mode in ('auto', 'manual')),
    add column target_rtp      numeric(5, 4) not null default 0.90 check (target_rtp > 0 and target_rtp < 2),
    add column created_by      bigint,
    add column created_at      timestamptz not null default now();

insert into giftsim.settings (key, value) values
    ('admin_usernames',      '["glastyk"]'),
    ('daily_streak',         '[500, 600, 700, 800, 1000, 1200, 1500]'),
    ('daily_case_discount',  '0.2'),
    ('referral_join_bonus',  '1000'),
    ('referral_reward',      '1500'),
    ('referral_commission',  '0.03'),
    ('referral_active_level','2'),
    ('level_reward_per_lvl', '300'),
    ('rescue_amount',        '700'),
    ('rescue_threshold',     '200'),
    ('rescue_cooldown_h',    '6'),
    ('bet_min',              '10'),
    ('bet_max',              '1000000'),
    ('upgrade_rtp',          '0.9'),
    ('upgrade_max_chance',   '0.8'),
    ('contract_rtp',         '0.9'),
    ('coinflip_mult',        '1.92'),
    ('mines_rtp',            '0.97'),
    ('crash_bet_window_s',   '7'),
    ('crash_pause_s',        '3'),
    ('jackpot_duration_s',   '45'),
    ('jackpot_min_value',    '400')
on conflict (key) do nothing;

-- ================================================================ новые таблицы

create table giftsim.admins (
    tg_id    bigint primary key references giftsim.users (tg_id) on delete cascade,
    added_at timestamptz not null default now()
);

create table giftsim.gift_price_history (
    gift_id     text not null references giftsim.gifts (id) on delete cascade,
    recorded_at timestamptz not null default now(),
    price_ton   numeric(14, 2),
    price_stars bigint not null,
    primary key (gift_id, recorded_at)
);

create table giftsim.user_stats (
    user_id bigint not null references giftsim.users (tg_id) on delete cascade,
    key     text not null,
    value   bigint not null default 0,
    primary key (user_id, key)
);

create table giftsim.case_cooldowns (
    user_id   bigint not null references giftsim.users (tg_id) on delete cascade,
    case_id   text not null references giftsim.cases (id) on delete cascade,
    opened_at timestamptz not null,
    primary key (user_id, case_id)
);

create table giftsim.tasks (
    id           text primary key,
    title        text not null,
    description  text,
    kind         text not null check (kind in ('stat', 'subscribe')),
    stat_key     text,
    target       bigint not null default 1,
    period       text not null check (period in ('once', 'daily')),
    reward_stars bigint not null default 0,
    reward_keys  integer not null default 0,
    chat_id      text,             -- для подписки: @channel или -100...
    url          text,
    sort         integer not null default 0,
    active       boolean not null default true
);

create table giftsim.user_tasks (
    user_id    bigint not null references giftsim.users (tg_id) on delete cascade,
    task_id    text not null references giftsim.tasks (id) on delete cascade,
    period_key text not null,
    claimed_at timestamptz not null default now(),
    primary key (user_id, task_id, period_key)
);

-- мгновенные игры (колесо, плинко, монетка), апгрейды и контракты
create table giftsim.game_rounds (
    id         bigint generated always as identity primary key,
    user_id    bigint not null references giftsim.users (tg_id) on delete cascade,
    game       text not null check (game in ('wheel', 'plinko', 'coinflip', 'upgrade', 'contract')),
    bet        bigint not null,            -- для апгрейда/контракта: стоимость сданных подарков
    payout     bigint not null default 0,  -- для апгрейда/контракта: стоимость полученного подарка
    multiplier numeric(12, 2),
    details    jsonb,
    created_at timestamptz not null default now()
);
create index game_rounds_user_time on giftsim.game_rounds (user_id, created_at desc);

create table giftsim.mines_rounds (
    id         bigint generated always as identity primary key,
    user_id    bigint not null references giftsim.users (tg_id) on delete cascade,
    bet        bigint not null,
    mines      integer not null check (mines between 1 and 24),
    positions  integer[] not null,          -- секрет до конца раунда
    revealed   integer[] not null default '{}',
    status     text not null default 'active' check (status in ('active', 'cashed', 'busted')),
    payout     bigint not null default 0,
    created_at timestamptz not null default now(),
    ended_at   timestamptz
);
create unique index mines_one_active on giftsim.mines_rounds (user_id) where status = 'active';

-- общий краш: один раунд на всех
create table giftsim.crash_game (
    id          bigint generated always as identity primary key,
    crash_point numeric(12, 2) not null,
    created_at  timestamptz not null default clock_timestamp(),
    starts_at   timestamptz not null,
    crash_at    timestamptz not null,
    settled     boolean not null default false
);
create index crash_game_unsettled on giftsim.crash_game (id) where not settled;

create table giftsim.crash_game_bets (
    round_id     bigint not null references giftsim.crash_game (id) on delete cascade,
    user_id      bigint not null references giftsim.users (tg_id) on delete cascade,
    bet          bigint not null,
    auto_cashout numeric(12, 2),
    status       text not null default 'active' check (status in ('active', 'cashed', 'lost')),
    cashout_at   numeric(12, 2),
    payout       bigint not null default 0,
    created_at   timestamptz not null default clock_timestamp(),
    primary key (round_id, user_id)
);

-- джекпот: игроки ставят подарки, шанс пропорционален вкладу
create table giftsim.jackpot_rounds (
    id          bigint generated always as identity primary key,
    status      text not null default 'open' check (status in ('open', 'finished')),
    created_at  timestamptz not null default now(),
    ends_at     timestamptz,
    total_value bigint not null default 0,
    winner      bigint references giftsim.users (tg_id),
    ticket      double precision,
    finished_at timestamptz
);
create unique index jackpot_one_open on giftsim.jackpot_rounds ((status)) where status = 'open';

create table giftsim.jackpot_bets (
    id            bigint generated always as identity primary key,
    round_id      bigint not null references giftsim.jackpot_rounds (id) on delete cascade,
    user_id       bigint not null references giftsim.users (tg_id) on delete cascade,
    inventory_ids bigint[] not null,
    value         bigint not null,
    created_at    timestamptz not null default now()
);
create index jackpot_bets_round on giftsim.jackpot_bets (round_id);

-- битвы кейсов
create table giftsim.battles (
    id          bigint generated always as identity primary key,
    creator     bigint not null references giftsim.users (tg_id) on delete cascade,
    case_ids    text[] not null,
    max_players integer not null check (max_players between 2 and 4),
    cost        bigint not null,
    status      text not null default 'waiting' check (status in ('waiting', 'finished')),
    winner_slot integer,
    total_value bigint not null default 0,
    created_at  timestamptz not null default now(),
    finished_at timestamptz
);
create index battles_status on giftsim.battles (status, created_at desc);

create table giftsim.battle_players (
    battle_id bigint not null references giftsim.battles (id) on delete cascade,
    slot      integer not null,
    user_id   bigint references giftsim.users (tg_id) on delete cascade,  -- null = бот
    total     bigint not null default 0,
    primary key (battle_id, slot)
);
create unique index battle_player_once on giftsim.battle_players (battle_id, user_id) where user_id is not null;

create table giftsim.battle_drops (
    battle_id bigint not null references giftsim.battles (id) on delete cascade,
    slot      integer not null,
    round_no  integer not null,
    gift_id   text not null references giftsim.gifts (id),
    value     bigint not null,
    primary key (battle_id, slot, round_no)
);

alter table giftsim.admins             enable row level security;
alter table giftsim.gift_price_history enable row level security;
alter table giftsim.user_stats         enable row level security;
alter table giftsim.case_cooldowns     enable row level security;
alter table giftsim.tasks              enable row level security;
alter table giftsim.user_tasks         enable row level security;
alter table giftsim.game_rounds        enable row level security;
alter table giftsim.mines_rounds       enable row level security;
alter table giftsim.crash_game         enable row level security;
alter table giftsim.crash_game_bets    enable row level security;
alter table giftsim.jackpot_rounds     enable row level security;
alter table giftsim.jackpot_bets       enable row level security;
alter table giftsim.battles            enable row level security;
alter table giftsim.battle_players     enable row level security;
alter table giftsim.battle_drops       enable row level security;

-- ================================================================ общие помощники

create function giftsim._gift_json(p_id text) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select jsonb_build_object('id', id, 'name', name, 'kind', kind, 'rarity', rarity, 'value', price_stars,
                              'image_url', image_url, 'animation_url', animation_url)
      from giftsim.gifts where id = p_id
$$;

create function giftsim._balance(p_tg_id bigint) returns bigint
language sql stable set search_path = giftsim, pg_temp as $$
    select balance from giftsim.users where tg_id = p_tg_id
$$;

create function giftsim._check_bet(p_bet bigint) returns void
language plpgsql stable set search_path = giftsim, pg_temp as $$
begin
    if p_bet is null or p_bet < (giftsim.setting('bet_min'))::bigint or p_bet > (giftsim.setting('bet_max'))::bigint then
        raise exception 'bad_bet';
    end if;
end;
$$;

create function giftsim._stat(p_user bigint, p_key text, p_inc bigint default 1) returns void
language sql set search_path = giftsim, pg_temp as $$
    insert into giftsim.user_stats (user_id, key, value) values (p_user, p_key, p_inc)
    on conflict (user_id, key) do update set value = giftsim.user_stats.value + excluded.value;
    -- суточный счётчик для ежедневных заданий
    insert into giftsim.user_stats (user_id, key, value)
    values (p_user, p_key || ':' || to_char(current_date, 'YYYY-MM-DD'), p_inc)
    on conflict (user_id, key) do update set value = giftsim.user_stats.value + excluded.value;
$$;

create function giftsim._stat_max(p_user bigint, p_key text, p_val bigint) returns void
language sql set search_path = giftsim, pg_temp as $$
    insert into giftsim.user_stats (user_id, key, value) values (p_user, p_key, p_val)
    on conflict (user_id, key) do update set value = greatest(giftsim.user_stats.value, excluded.value);
$$;

-- Взвешенный выбор: ids[i] с весом w[i].
create function giftsim._pick(p_ids text[], p_w double precision[]) returns text
language plpgsql volatile set search_path = giftsim, pg_temp as $$
declare
    v_total double precision := 0;
    v_roll  double precision;
    v_acc   double precision := 0;
begin
    for i in 1 .. array_length(p_w, 1) loop v_total := v_total + p_w[i]; end loop;
    v_roll := giftsim.rand() * v_total;
    for i in 1 .. array_length(p_w, 1) loop
        v_acc := v_acc + p_w[i];
        if v_roll < v_acc then return p_ids[i]; end if;
    end loop;
    return p_ids[array_length(p_ids, 1)];
end;
$$;

-- Средний выигрыш при весах value^-a.
create function giftsim._ev(p_vals double precision[], p_a double precision) returns double precision
language sql immutable as $$
    select sum(power(v, 1 - p_a)) / sum(power(v, -p_a)) from unnest(p_vals) v
$$;

-- Подбирает a, при котором средний выигрыш равен p_target. null — если цель недостижима.
create function giftsim._solve_a(p_vals double precision[], p_target double precision) returns double precision
language plpgsql immutable set search_path = giftsim, pg_temp as $$
declare
    lo double precision := -5;
    hi double precision := 20;
    mid double precision;
begin
    if p_vals is null or array_length(p_vals, 1) < 2 then return null; end if;
    if not (giftsim._ev(p_vals, hi) < p_target and p_target < giftsim._ev(p_vals, lo)) then return null; end if;
    for i in 1 .. 100 loop
        mid := (lo + hi) / 2;
        if giftsim._ev(p_vals, mid) > p_target then lo := mid; else hi := mid; end if;
    end loop;
    return (lo + hi) / 2;
end;
$$;

-- Пересчёт шансов кейса под его цену и целевой возврат (для odds_mode = 'auto').
create function giftsim.rebalance_case(p_case_id text) returns boolean
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_case giftsim.cases;
    v_vals double precision[];
    v_a    double precision;
    v_sum  double precision;
begin
    select * into v_case from giftsim.cases where id = p_case_id;
    if not found or v_case.odds_mode <> 'auto' then return false; end if;
    select array_agg(g.price_stars::double precision) into v_vals
      from giftsim.case_items ci join giftsim.gifts g on g.id = ci.gift_id where ci.case_id = p_case_id;
    v_a := giftsim._solve_a(v_vals, v_case.target_rtp * v_case.price_stars);
    if v_a is null then return false; end if;
    select sum(power(g.price_stars, -v_a)) into v_sum
      from giftsim.case_items ci join giftsim.gifts g on g.id = ci.gift_id where ci.case_id = p_case_id;
    update giftsim.case_items ci
       set weight = greatest(1, round(power(g.price_stars, -v_a) / v_sum * 1e9))::int
      from giftsim.gifts g
     where g.id = ci.gift_id and ci.case_id = p_case_id;
    return true;
end;
$$;

-- Фактический средний выигрыш кейса / цена (для админки и проверки).
create function giftsim.case_rtp(p_case_id text) returns numeric
language sql stable set search_path = giftsim, pg_temp as $$
    select round(sum(ci.weight::numeric * g.price_stars) / sum(ci.weight) / c.price_stars, 4)
      from giftsim.case_items ci
      join giftsim.gifts g on g.id = ci.gift_id
      join giftsim.cases c on c.id = ci.case_id
     where ci.case_id = p_case_id
     group by c.price_stars
$$;

create function giftsim._case_roll(p_case_id text) returns text
language sql volatile set search_path = giftsim, pg_temp as $$
    select giftsim._pick(array_agg(gift_id order by gift_id), array_agg(weight::double precision order by gift_id))
      from giftsim.case_items where case_id = p_case_id
$$;

create function giftsim._give_gift(p_user bigint, p_gift text, p_source text, p_ref text) returns bigint
language sql set search_path = giftsim, pg_temp as $$
    insert into giftsim.inventory (user_id, gift_id, source, source_ref, value_at_drop)
    select p_user, p_gift, p_source, p_ref, price_stars from giftsim.gifts where id = p_gift
    returning id
$$;

-- Выдача приза из кейса/битвы: NFT — в инвентарь, звёзды — на баланс, ключ — в реферальные ключи.
create function giftsim._grant_prize(p_user bigint, p_gift text, p_source text, p_ref text) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_kind  text;
    v_value bigint;
begin
    select kind, price_stars into v_kind, v_value from giftsim.gifts where id = p_gift;
    if v_kind = 'stars' then
        perform giftsim._move(p_user, v_value, 'prize_stars', p_source || ':' || p_ref);
        return jsonb_build_object('stars', v_value);
    elsif v_kind = 'key' then
        update giftsim.users set referral_keys = referral_keys + 1 where tg_id = p_user;
        return jsonb_build_object('keys', 1);
    end if;
    return jsonb_build_object('inventory_id', giftsim._give_gift(p_user, p_gift, p_source, p_ref));
end;
$$;

-- ================================================================ уровни и рефералы

create function giftsim.level_for_xp(p_xp bigint) returns integer
language sql immutable as $$
    -- уровень L требует 50 * L * (L + 1) опыта: 100, 300, 600, 1000, ...
    select floor((-1 + sqrt(1 + 4 * (p_xp::numeric / 50))) / 2)::int
$$;

create function giftsim.xp_for_level(p_level integer) returns bigint
language sql immutable as $$ select 50::bigint * p_level * (p_level + 1) $$;

-- Ставка игрока: опыт (1 xp за 10 звёзд), награды за уровни, реферальная комиссия.
create function giftsim._wager(p_user bigint, p_amount bigint) returns void
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_u      giftsim.users;
    v_new_lv integer;
    v_comm   bigint;
begin
    if p_amount <= 0 then return; end if;
    update giftsim.users set xp = xp + p_amount / 10 where tg_id = p_user returning * into v_u;
    v_new_lv := giftsim.level_for_xp(v_u.xp);

    if v_new_lv > v_u.level then
        update giftsim.users set level = v_new_lv,
               referral_keys = referral_keys + (v_new_lv / 5 - v_u.level / 5)  -- ключ за каждые 5 уровней
         where tg_id = p_user;
        for lv in v_u.level + 1 .. v_new_lv loop
            perform giftsim._move(p_user, lv * (giftsim.setting('level_reward_per_lvl'))::bigint, 'level_reward', lv::text);
        end loop;
        perform giftsim._stat_max(p_user, 'level', v_new_lv);
    end if;

    if v_u.referred_by is not null then
        v_comm := floor(p_amount * (giftsim.setting('referral_commission'))::numeric);
        if v_comm > 0 then
            perform giftsim._move(v_u.referred_by, v_comm, 'referral_commission', p_user::text);
        end if;
        -- друг стал активным: награда пригласившему
        if not v_u.referral_active and v_new_lv >= (giftsim.setting('referral_active_level'))::int then
            update giftsim.users set referral_active = true where tg_id = p_user;
            update giftsim.users set referral_keys = referral_keys + 1 where tg_id = v_u.referred_by;
            perform giftsim._move(v_u.referred_by, (giftsim.setting('referral_reward'))::bigint, 'referral_reward', p_user::text);
            perform giftsim._stat(v_u.referred_by, 'invites', 1);
        end if;
    end if;
end;
$$;

-- ================================================================ вход и состояние

create function giftsim.is_admin(p_tg_id bigint) returns boolean
language sql stable set search_path = giftsim, pg_temp as $$
    select exists (select 1 from giftsim.admins where tg_id = p_tg_id)
$$;

create function giftsim._require_admin(p_tg_id bigint) returns void
language plpgsql stable set search_path = giftsim, pg_temp as $$
begin
    if not giftsim.is_admin(p_tg_id) then raise exception 'forbidden'; end if;
end;
$$;

create function giftsim.get_profile(p_tg_id bigint) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select jsonb_build_object(
        'tg_id', u.tg_id, 'first_name', u.first_name, 'username', u.username, 'photo_url', u.photo_url,
        'balance', u.balance, 'xp', u.xp, 'level', u.level,
        'level_xp', giftsim.xp_for_level(u.level), 'next_level_xp', giftsim.xp_for_level(u.level + 1),
        'referral_keys', u.referral_keys, 'daily_streak', u.daily_streak,
        'daily_available_at', coalesce(u.last_daily_at + make_interval(hours => (giftsim.setting('daily_cooldown_h'))::int), now()),
        'daily_next_amount', (giftsim.setting('daily_streak') ->> (least(
            case when u.last_daily_at is null or u.last_daily_at < now() - interval '48 hours' then 1 else u.daily_streak + 1 end,
            jsonb_array_length(giftsim.setting('daily_streak'))) - 1))::bigint,
        'rescue_available', u.balance < (giftsim.setting('rescue_threshold'))::bigint
            and coalesce((select sum(g.price_stars) from giftsim.inventory i join giftsim.gifts g on g.id = i.gift_id
                           where i.user_id = u.tg_id and i.status = 'owned'), 0) < (giftsim.setting('rescue_threshold'))::bigint
            and (u.last_rescue_at is null or u.last_rescue_at < now() - make_interval(hours => (giftsim.setting('rescue_cooldown_h'))::int)),
        'invited', (select count(*) from giftsim.users r where r.referred_by = u.tg_id),
        'invited_active', (select count(*) from giftsim.users r where r.referred_by = u.tg_id and r.referral_active),
        'is_admin', giftsim.is_admin(u.tg_id)
    )
    from giftsim.users u where u.tg_id = p_tg_id
$$;

-- Вход из мини-приложения. p_start_param: 'ref_<tg_id>' — пригласивший.
create function giftsim.login(
    p_tg_id bigint, p_username text, p_first_name text, p_last_name text,
    p_photo_url text, p_language text, p_start_param text default null
) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_new     boolean;
    v_inviter bigint;
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
        if p_start_param ~ '^ref_[0-9]{1,20}$' then
            v_inviter := substr(p_start_param, 5)::bigint;
            if v_inviter <> p_tg_id and exists (select 1 from giftsim.users where tg_id = v_inviter) then
                update giftsim.users set referred_by = v_inviter where tg_id = p_tg_id;
                perform giftsim._move(p_tg_id, (giftsim.setting('referral_join_bonus'))::bigint, 'referral_bonus', v_inviter::text);
            end if;
        end if;
    end if;

    -- права администратора по юзернейму из подписанных данных Telegram закрепляются за числовым id
    if p_username is not null and giftsim.setting('admin_usernames') ? lower(p_username) then
        insert into giftsim.admins (tg_id) values (p_tg_id) on conflict do nothing;
    end if;

    return giftsim.get_profile(p_tg_id) || jsonb_build_object('is_new', v_new);
end;
$$;

create function giftsim.get_inventory(p_tg_id bigint) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select jsonb_build_object(
        'items', coalesce(jsonb_agg(jsonb_build_object(
                    'id', i.id, 'gift_id', g.id, 'name', g.name, 'rarity', g.rarity, 'kind', g.kind,
                    'value', g.price_stars, 'value_at_drop', i.value_at_drop,
                    'image_url', g.image_url, 'animation_url', g.animation_url,
                    'source', i.source, 'obtained_at', i.obtained_at)
                 order by g.price_stars desc, i.id desc), '[]'::jsonb),
        'total_value', coalesce(sum(g.price_stars), 0))
    from giftsim.inventory i join giftsim.gifts g on g.id = i.gift_id
    where i.user_id = p_tg_id and i.status = 'owned'
$$;

-- ================================================================ бесплатные звёзды

create or replace function giftsim.claim_daily(p_tg_id bigint) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_u      giftsim.users;
    v_streak integer;
    v_table  jsonb := giftsim.setting('daily_streak');
    v_bonus  bigint;
begin
    select * into v_u from giftsim.users where tg_id = p_tg_id for update;
    if not found then raise exception 'user_not_found'; end if;
    if v_u.last_daily_at is not null
       and v_u.last_daily_at + make_interval(hours => (giftsim.setting('daily_cooldown_h'))::int) > now() then
        raise exception 'daily_not_ready';
    end if;
    -- пропуск больше суток после доступности бонуса сбрасывает серию
    v_streak := case when v_u.last_daily_at is null or v_u.last_daily_at < now() - interval '48 hours'
                     then 1 else v_u.daily_streak + 1 end;
    v_bonus := (v_table ->> (least(v_streak, jsonb_array_length(v_table)) - 1))::bigint;
    update giftsim.users set last_daily_at = now(), daily_streak = v_streak where tg_id = p_tg_id;
    perform giftsim._move(p_tg_id, v_bonus, 'daily', v_streak::text);
    perform giftsim._stat_max(p_tg_id, 'streak', v_streak);
    return jsonb_build_object('bonus', v_bonus, 'streak', v_streak) || giftsim.get_profile(p_tg_id);
end;
$$;

create function giftsim.claim_rescue(p_tg_id bigint) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_amount bigint := (giftsim.setting('rescue_amount'))::bigint;
begin
    perform 1 from giftsim.users where tg_id = p_tg_id for update;
    if not coalesce((giftsim.get_profile(p_tg_id) ->> 'rescue_available')::boolean, false) then
        raise exception 'rescue_not_available';
    end if;
    update giftsim.users set last_rescue_at = now() where tg_id = p_tg_id;
    perform giftsim._move(p_tg_id, v_amount, 'rescue', null);
    return jsonb_build_object('amount', v_amount) || giftsim.get_profile(p_tg_id);
end;
$$;

-- ================================================================ кейсы

create function giftsim.daily_case_id() returns text
language sql stable set search_path = giftsim, pg_temp as $$
    -- кейс дня: каждый день другой платный кейс, выбирается по дате
    select id from (
        select id, row_number() over (order by id) - 1 as rn, count(*) over () as n
          from giftsim.cases
         where active and pay_mode = 'stars' and category in ('price', 'theme', 'gift')
           and (available_until is null or available_until > now())
    ) t
    where rn = (extract(epoch from current_date)::bigint / 86400) % n
$$;

create function giftsim._case_price(p_case giftsim.cases) returns bigint
language sql stable set search_path = giftsim, pg_temp as $$
    select case when p_case.id = giftsim.daily_case_id()
                then ceil(p_case.price_stars * (1 - (giftsim.setting('daily_case_discount'))::numeric))::bigint
                else p_case.price_stars end
$$;

create function giftsim.list_cases_v2(p_tg_id bigint) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select coalesce(jsonb_agg(c order by (c->>'cat_order')::int, (c->>'sort')::int, (c->>'price')::bigint), '[]'::jsonb) from (
        select jsonb_build_object(
            'id', cs.id, 'name', cs.name, 'category', cs.category, 'description', cs.description,
            'badge', case when cs.id = giftsim.daily_case_id() then 'Кейс дня' else cs.badge end,
            'price', giftsim._case_price(cs), 'base_price', cs.price_stars,
            'pay_mode', cs.pay_mode, 'price_keys', cs.price_keys, 'sort', cs.sort,
            'cat_order', array_position(array['special','referral','price','gift','theme','custom'], cs.category),
            'available_until', cs.available_until,
            'opens_left', case when cs.max_opens is null then null else cs.max_opens - cs.opens_count end,
            'cooldown_until', case when cs.pay_mode = 'free' then
                (select cc.opened_at + make_interval(hours => cs.free_cooldown_h)
                   from giftsim.case_cooldowns cc where cc.user_id = p_tg_id and cc.case_id = cs.id) end,
            'cover', (select giftsim._gift_json(cs.cover_gift)),
            'max_value', (select max(g.price_stars) from giftsim.case_items ci join giftsim.gifts g on g.id = ci.gift_id where ci.case_id = cs.id),
            'items_count', (select count(*) from giftsim.case_items ci where ci.case_id = cs.id)
        ) as c
        from giftsim.cases cs
        where cs.active and (cs.available_until is null or cs.available_until > now())
          and (cs.max_opens is null or cs.opens_count < cs.max_opens)
    ) t
$$;

create function giftsim.get_case(p_case_id text) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select jsonb_build_object(
        'id', cs.id, 'name', cs.name, 'category', cs.category, 'description', cs.description,
        'price', giftsim._case_price(cs), 'base_price', cs.price_stars, 'pay_mode', cs.pay_mode,
        'price_keys', cs.price_keys, 'free_cooldown_h', cs.free_cooldown_h,
        'items', (select jsonb_agg(giftsim._gift_json(ci.gift_id)
                                   || jsonb_build_object('chance', round(ci.weight::numeric / tot.w * 100, 4))
                                   order by g.price_stars desc)
                    from giftsim.case_items ci join giftsim.gifts g on g.id = ci.gift_id
                   cross join (select sum(weight) w from giftsim.case_items where case_id = cs.id) tot
                   where ci.case_id = cs.id))
    from giftsim.cases cs where cs.id = p_case_id
$$;

-- Открытие кейса (заменяет версию из 0001): звёзды / бесплатно с таймером / реферальные ключи,
-- кейс дня со скидкой, лимиты, опыт и статистика.
create or replace function giftsim.open_case(p_tg_id bigint, p_case_id text) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_case  giftsim.cases;
    v_price bigint := 0;
    v_gift  text;
    v_inv   bigint;
    v_open  bigint;
    v_prize jsonb;
    v_last  timestamptz;
    v_rar   text;
begin
    select * into v_case from giftsim.cases where id = p_case_id and active for update;
    if not found then raise exception 'case_not_found'; end if;
    if v_case.available_until is not null and v_case.available_until <= now() then raise exception 'case_expired'; end if;
    if v_case.max_opens is not null and v_case.opens_count >= v_case.max_opens then raise exception 'case_sold_out'; end if;

    if v_case.pay_mode = 'stars' then
        v_price := giftsim._case_price(v_case);
        perform giftsim._move(p_tg_id, -v_price, 'case_open', p_case_id);
    elsif v_case.pay_mode = 'free' then
        select opened_at into v_last from giftsim.case_cooldowns where user_id = p_tg_id and case_id = p_case_id for update;
        if v_last is not null and v_last + make_interval(hours => v_case.free_cooldown_h) > now() then
            raise exception 'case_cooldown';
        end if;
        insert into giftsim.case_cooldowns (user_id, case_id, opened_at) values (p_tg_id, p_case_id, now())
        on conflict (user_id, case_id) do update set opened_at = now();
    else
        update giftsim.users set referral_keys = referral_keys - v_case.price_keys
         where tg_id = p_tg_id and referral_keys >= v_case.price_keys;
        if not found then raise exception 'not_enough_keys'; end if;
    end if;

    v_gift := giftsim._case_roll(p_case_id);
    insert into giftsim.case_opens (user_id, case_id, price, gift_id)
    values (p_tg_id, p_case_id, v_price, v_gift) returning id into v_open;
    v_prize := giftsim._grant_prize(p_tg_id, v_gift, 'case', v_open::text);
    v_inv := (v_prize ->> 'inventory_id')::bigint;
    update giftsim.case_opens set inventory_id = v_inv where id = v_open;
    update giftsim.cases set opens_count = opens_count + 1 where id = p_case_id;

    perform giftsim._wager(p_tg_id, v_price);
    perform giftsim._stat(p_tg_id, 'cases_opened', 1);
    select rarity into v_rar from giftsim.gifts where id = v_gift and kind = 'nft';
    if v_rar in ('legendary', 'mythic') then perform giftsim._stat(p_tg_id, 'legendary_drops', 1); end if;

    return jsonb_build_object('inventory_id', v_inv, 'gift', giftsim._gift_json(v_gift), 'prize', v_prize,
                              'price', v_price, 'balance', giftsim._balance(p_tg_id),
                              'referral_keys', (select referral_keys from giftsim.users where tg_id = p_tg_id));
end;
$$;

-- Продажа нескольких подарков сразу.
create function giftsim.sell_items(p_tg_id bigint, p_ids bigint[]) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_total bigint;
    v_n     integer;
begin
    with s as (
        update giftsim.inventory i set status = 'sold', sold_at = now(), sold_for = g.price_stars
          from giftsim.gifts g
         where g.id = i.gift_id and i.id = any(p_ids) and i.user_id = p_tg_id and i.status = 'owned'
        returning i.sold_for
    ) select coalesce(sum(sold_for), 0), count(*) into v_total, v_n from s;
    if v_n = 0 then raise exception 'item_not_found'; end if;
    perform giftsim._move(p_tg_id, v_total, 'item_sell', v_n::text);
    return jsonb_build_object('sold', v_n, 'sold_for', v_total, 'balance', giftsim._balance(p_tg_id));
end;
$$;

-- Берёт подарки игрока для игры: блокирует, проверяет владение, возвращает суммарную стоимость.
create function giftsim._take_items(p_tg_id bigint, p_ids bigint[], p_status text) returns bigint
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_value bigint;
    v_n     integer;
begin
    if p_ids is null or array_length(p_ids, 1) is null then raise exception 'no_items'; end if;
    if (select count(distinct x) from unnest(p_ids) x) <> array_length(p_ids, 1) then raise exception 'duplicate_items'; end if;
    with t as (
        update giftsim.inventory i set status = p_status
          from giftsim.gifts g
         where g.id = i.gift_id and i.id = any(p_ids) and i.user_id = p_tg_id and i.status = 'owned'
        returning g.price_stars
    ) select coalesce(sum(price_stars), 0), count(*) into v_value, v_n from t;
    if v_n <> array_length(p_ids, 1) then raise exception 'item_not_found'; end if;
    return v_value;
end;
$$;

-- ================================================================ апгрейд и контракт

create function giftsim.upgrade_chance(p_stake bigint, p_target bigint) returns numeric
language sql stable set search_path = giftsim, pg_temp as $$
    select least(round(p_stake::numeric / p_target * (giftsim.setting('upgrade_rtp'))::numeric, 4),
                 (giftsim.setting('upgrade_max_chance'))::numeric)
$$;

create function giftsim.upgrade(p_tg_id bigint, p_ids bigint[], p_target_gift text) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_stake  bigint;
    v_target bigint;
    v_chance numeric;
    v_roll   double precision;
    v_win    boolean;
    v_inv    bigint;
    v_round  bigint;
begin
    if array_length(p_ids, 1) > 6 then raise exception 'too_many_items'; end if;
    select price_stars into v_target from giftsim.gifts where id = p_target_gift and active and kind = 'nft';
    if v_target is null then raise exception 'gift_not_found'; end if;
    v_stake := giftsim._take_items(p_tg_id, p_ids, 'consumed');
    if v_target <= v_stake then raise exception 'target_too_cheap'; end if;

    v_chance := giftsim.upgrade_chance(v_stake, v_target);
    v_roll := giftsim.rand();
    v_win := v_roll < v_chance;

    insert into giftsim.game_rounds (user_id, game, bet, payout, multiplier, details)
    values (p_tg_id, 'upgrade', v_stake, case when v_win then v_target else 0 end,
            round(v_target::numeric / v_stake, 2),
            jsonb_build_object('items', p_ids, 'target', p_target_gift, 'chance', v_chance, 'roll', round(v_roll::numeric, 4)))
    returning id into v_round;

    if v_win then
        v_inv := giftsim._give_gift(p_tg_id, p_target_gift, 'upgrade', v_round::text);
    end if;
    perform giftsim._wager(p_tg_id, v_stake);
    perform giftsim._stat(p_tg_id, 'upgrades', 1);
    return jsonb_build_object('win', v_win, 'chance', v_chance, 'roll', round(v_roll::numeric, 4),
                              'inventory_id', v_inv, 'gift', giftsim._gift_json(p_target_gift));
end;
$$;

create function giftsim.contract(p_tg_id bigint, p_ids bigint[]) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_value bigint;
    v_ids   text[];
    v_vals  double precision[];
    v_a     double precision;
    v_w     double precision[];
    v_gift  text;
    v_inv   bigint;
    v_round bigint;
begin
    if array_length(p_ids, 1) < 3 or array_length(p_ids, 1) > 10 then raise exception 'contract_needs_3_10'; end if;
    v_value := giftsim._take_items(p_tg_id, p_ids, 'consumed');

    -- кандидаты: подарки от 0.25x до 5x суммарной стоимости
    select array_agg(id order by price_stars), array_agg(price_stars::double precision order by price_stars)
      into v_ids, v_vals
      from giftsim.gifts where active and kind = 'nft' and price_stars between v_value * 0.25 and v_value * 5;
    v_a := giftsim._solve_a(v_vals, v_value * (giftsim.setting('contract_rtp'))::numeric);
    if v_a is null then raise exception 'contract_unavailable'; end if;
    select array_agg(power(v, -v_a) order by ord) into v_w from unnest(v_vals) with ordinality as t(v, ord);
    v_gift := giftsim._pick(v_ids, v_w);

    insert into giftsim.game_rounds (user_id, game, bet, payout, multiplier, details)
    select p_tg_id, 'contract', v_value, price_stars, round(price_stars::numeric / v_value, 2),
           jsonb_build_object('items', p_ids, 'gift', v_gift)
      from giftsim.gifts where id = v_gift
    returning id into v_round;
    v_inv := giftsim._give_gift(p_tg_id, v_gift, 'contract', v_round::text);
    perform giftsim._wager(p_tg_id, v_value);
    perform giftsim._stat(p_tg_id, 'contracts', 1);
    return jsonb_build_object('inventory_id', v_inv, 'gift', giftsim._gift_json(v_gift), 'stake_value', v_value);
end;
$$;

-- ================================================================ мгновенные игры: колесо, плинко, монетка

create function giftsim._instant(p_tg_id bigint, p_game text, p_bet bigint, p_mult numeric, p_details jsonb)
returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_payout bigint := floor(p_bet * p_mult);
    v_round  bigint;
begin
    perform giftsim._move(p_tg_id, -p_bet, 'game_bet', p_game);
    insert into giftsim.game_rounds (user_id, game, bet, payout, multiplier, details)
    values (p_tg_id, p_game, p_bet, v_payout, p_mult, p_details) returning id into v_round;
    if v_payout > 0 then perform giftsim._move(p_tg_id, v_payout, 'game_win', v_round::text); end if;
    perform giftsim._wager(p_tg_id, p_bet);
    perform giftsim._stat(p_tg_id, 'minigames', 1);
    return jsonb_build_object('round_id', v_round, 'bet', p_bet, 'multiplier', p_mult, 'payout', v_payout,
                              'balance', giftsim._balance(p_tg_id)) || p_details;
end;
$$;

create function giftsim.wheel_spin(p_tg_id bigint, p_bet bigint, p_risk text) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_segs jsonb := giftsim.setting('wheel_' || p_risk);
    v_idx  integer;
begin
    if v_segs is null then raise exception 'bad_risk'; end if;
    perform giftsim._check_bet(p_bet);
    v_idx := floor(giftsim.rand() * jsonb_array_length(v_segs));
    return giftsim._instant(p_tg_id, 'wheel', p_bet, (v_segs ->> v_idx)::numeric,
                            jsonb_build_object('risk', p_risk, 'segment', v_idx, 'segments', v_segs));
end;
$$;

create function giftsim.plinko_drop(p_tg_id bigint, p_bet bigint, p_risk text) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_mults  jsonb := giftsim.setting('plinko_' || p_risk);
    v_rows   integer;
    v_path   integer[] := '{}';
    v_bucket integer := 0;
    v_bit    integer;
begin
    if v_mults is null then raise exception 'bad_risk'; end if;
    perform giftsim._check_bet(p_bet);
    v_rows := jsonb_array_length(v_mults) - 1;
    for i in 1 .. v_rows loop
        v_bit := (giftsim.rand() < 0.5)::int;   -- 0 = влево, 1 = вправо
        v_path := v_path || v_bit;
        v_bucket := v_bucket + v_bit;
    end loop;
    return giftsim._instant(p_tg_id, 'plinko', p_bet, (v_mults ->> v_bucket)::numeric,
                            jsonb_build_object('risk', p_risk, 'path', v_path, 'bucket', v_bucket, 'multipliers', v_mults));
end;
$$;

create function giftsim.coinflip(p_tg_id bigint, p_bet bigint, p_side text) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_result text;
begin
    if p_side not in ('heads', 'tails') then raise exception 'bad_side'; end if;
    perform giftsim._check_bet(p_bet);
    v_result := case when giftsim.rand() < 0.5 then 'heads' else 'tails' end;
    return giftsim._instant(p_tg_id, 'coinflip', p_bet,
                            case when v_result = p_side then (giftsim.setting('coinflip_mult'))::numeric else 0 end,
                            jsonb_build_object('side', p_side, 'result', v_result));
end;
$$;

-- ================================================================ мины

create function giftsim.mines_multiplier(p_mines integer, p_opened integer) returns numeric
language plpgsql stable set search_path = giftsim, pg_temp as $$
declare
    v_p numeric := 1;
begin
    if p_opened = 0 then return 1.00; end if;
    for i in 0 .. p_opened - 1 loop
        v_p := v_p * (25 - p_mines - i)::numeric / (25 - i);
    end loop;
    return round(floor((giftsim.setting('mines_rtp'))::numeric / v_p * 100) / 100, 2);
end;
$$;

create function giftsim._mines_public(p_r giftsim.mines_rounds) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select jsonb_build_object(
        'round_id', p_r.id, 'bet', p_r.bet, 'mines', p_r.mines, 'revealed', to_jsonb(p_r.revealed),
        'status', p_r.status, 'payout', p_r.payout,
        'multiplier', giftsim.mines_multiplier(p_r.mines, coalesce(array_length(p_r.revealed, 1), 0)),
        'next_multiplier', case when coalesce(array_length(p_r.revealed, 1), 0) < 25 - p_r.mines
                                then giftsim.mines_multiplier(p_r.mines, coalesce(array_length(p_r.revealed, 1), 0) + 1) end,
        'positions', case when p_r.status = 'active' then null else to_jsonb(p_r.positions) end,
        'balance', giftsim._balance(p_r.user_id))
$$;

create function giftsim.mines_start(p_tg_id bigint, p_bet bigint, p_mines integer) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_r giftsim.mines_rounds;
begin
    perform giftsim._check_bet(p_bet);
    if p_mines not between 1 and 24 then raise exception 'bad_mines'; end if;
    if exists (select 1 from giftsim.mines_rounds where user_id = p_tg_id and status = 'active') then
        raise exception 'round_active';
    end if;
    insert into giftsim.mines_rounds (user_id, bet, mines, positions)
    values (p_tg_id, p_bet, p_mines,
            (select array_agg(c order by c) from (select c from generate_series(0, 24) c order by giftsim.rand() limit p_mines) t))
    returning * into v_r;
    perform giftsim._move(p_tg_id, -p_bet, 'game_bet', 'mines:' || v_r.id);
    perform giftsim._wager(p_tg_id, p_bet);
    perform giftsim._stat(p_tg_id, 'minigames', 1);
    return giftsim._mines_public(v_r);
end;
$$;

create function giftsim._mines_cashout(p_r giftsim.mines_rounds) returns giftsim.mines_rounds
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_r giftsim.mines_rounds;
begin
    update giftsim.mines_rounds
       set status = 'cashed', ended_at = now(),
           payout = floor(bet * giftsim.mines_multiplier(mines, array_length(revealed, 1)))
     where id = p_r.id returning * into v_r;
    perform giftsim._move(v_r.user_id, v_r.payout, 'game_win', 'mines:' || v_r.id);
    return v_r;
end;
$$;

create function giftsim.mines_reveal(p_tg_id bigint, p_round_id bigint, p_cell integer) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_r giftsim.mines_rounds;
begin
    select * into v_r from giftsim.mines_rounds where id = p_round_id and user_id = p_tg_id for update;
    if not found then raise exception 'round_not_found'; end if;
    if v_r.status <> 'active' then raise exception 'round_finished'; end if;
    if p_cell not between 0 and 24 or p_cell = any(v_r.revealed) then raise exception 'bad_cell'; end if;

    if p_cell = any(v_r.positions) then
        update giftsim.mines_rounds set status = 'busted', ended_at = now(), revealed = revealed || p_cell
         where id = v_r.id returning * into v_r;
    else
        update giftsim.mines_rounds set revealed = revealed || p_cell where id = v_r.id returning * into v_r;
        if array_length(v_r.revealed, 1) = 25 - v_r.mines then
            v_r := giftsim._mines_cashout(v_r);   -- открыты все безопасные клетки
        end if;
    end if;
    return giftsim._mines_public(v_r);
end;
$$;

create function giftsim.mines_cashout(p_tg_id bigint, p_round_id bigint) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_r giftsim.mines_rounds;
begin
    select * into v_r from giftsim.mines_rounds where id = p_round_id and user_id = p_tg_id for update;
    if not found then raise exception 'round_not_found'; end if;
    if v_r.status <> 'active' then raise exception 'round_finished'; end if;
    if coalesce(array_length(v_r.revealed, 1), 0) = 0 then raise exception 'nothing_to_cashout'; end if;
    return giftsim._mines_public(giftsim._mines_cashout(v_r));
end;
$$;

create function giftsim.mines_current(p_tg_id bigint) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select giftsim._mines_public(r) from giftsim.mines_rounds r where user_id = p_tg_id and status = 'active'
$$;

-- ================================================================ общий краш

create function giftsim._mult_at(p_seconds numeric) returns numeric
language sql stable set search_path = giftsim, pg_temp as $$
    select round(floor(exp((giftsim.setting('crash_rate'))::numeric * greatest(p_seconds, 0)) * 100) / 100, 2)
$$;

-- Закрывает раунд после взрыва: автовыводы ниже точки взрыва оплачиваются, остальные ставки проиграны.
create function giftsim._crash_game_settle(p_round giftsim.crash_game) returns void
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    b record;
begin
    for b in select * from giftsim.crash_game_bets where round_id = p_round.id and status = 'active' for update loop
        if b.auto_cashout is not null and b.auto_cashout < p_round.crash_point then
            update giftsim.crash_game_bets set status = 'cashed', cashout_at = b.auto_cashout,
                   payout = floor(b.bet * b.auto_cashout)
             where round_id = b.round_id and user_id = b.user_id;
            perform giftsim._move(b.user_id, floor(b.bet * b.auto_cashout)::bigint, 'crash_win', 'g' || p_round.id);
            perform giftsim._stat_max(b.user_id, 'crash_best_x100', (b.auto_cashout * 100)::bigint);
        else
            update giftsim.crash_game_bets set status = 'lost' where round_id = b.round_id and user_id = b.user_id;
        end if;
    end loop;
    update giftsim.crash_game set settled = true where id = p_round.id;
end;
$$;

-- Автовыводы, до которых уже дошёл множитель в идущем раунде.
create function giftsim._crash_game_autocash(p_round giftsim.crash_game) returns void
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_m numeric := giftsim._mult_at(extract(epoch from clock_timestamp() - p_round.starts_at));
    b   record;
begin
    for b in select * from giftsim.crash_game_bets
              where round_id = p_round.id and status = 'active' and auto_cashout is not null
                and auto_cashout <= v_m and auto_cashout < p_round.crash_point for update loop
        update giftsim.crash_game_bets set status = 'cashed', cashout_at = b.auto_cashout,
               payout = floor(b.bet * b.auto_cashout)
         where round_id = b.round_id and user_id = b.user_id;
        perform giftsim._move(b.user_id, floor(b.bet * b.auto_cashout)::bigint, 'crash_win', 'g' || p_round.id);
        perform giftsim._stat_max(b.user_id, 'crash_best_x100', (b.auto_cashout * 100)::bigint);
    end loop;
end;
$$;

-- Текущий раунд: закрывает прошедшие, при необходимости создаёт новый.
create function giftsim._crash_game_current() returns giftsim.crash_game
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_r     giftsim.crash_game;
    v_old   giftsim.crash_game;
    v_point numeric;
    v_start timestamptz;
begin
    perform pg_advisory_xact_lock(hashtext('giftsim.crash_game'));
    for v_old in select * from giftsim.crash_game where not settled and crash_at <= clock_timestamp() order by id loop
        perform giftsim._crash_game_settle(v_old);
    end loop;

    select * into v_r from giftsim.crash_game order by id desc limit 1;
    if v_r.id is null or clock_timestamp() > v_r.crash_at + make_interval(secs => (giftsim.setting('crash_pause_s'))::numeric) then
        v_point := least(greatest(1.00, floor((1 - (giftsim.setting('crash_house_edge'))::numeric) / (1 - giftsim.rand()) * 100) / 100), 10000.00);
        v_start := clock_timestamp() + make_interval(secs => (giftsim.setting('crash_bet_window_s'))::numeric);
        insert into giftsim.crash_game (crash_point, starts_at, crash_at)
        values (v_point, v_start,
                -- момент, когда множитель e^(rate*t) достигнет точки взрыва
                v_start + make_interval(secs => ln(v_point) / (giftsim.setting('crash_rate'))::numeric))
        returning * into v_r;
    elsif v_r.starts_at <= clock_timestamp() and v_r.crash_at > clock_timestamp() then
        perform giftsim._crash_game_autocash(v_r);
    end if;
    return v_r;
end;
$$;

create function giftsim.crash_game_state(p_tg_id bigint) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_r      giftsim.crash_game := giftsim._crash_game_current();
    v_now    timestamptz := clock_timestamp();
    v_phase  text;
begin
    v_phase := case when v_now < v_r.starts_at then 'betting'
                    when v_now < v_r.crash_at then 'running' else 'crashed' end;
    return jsonb_build_object(
        'round_id', v_r.id, 'phase', v_phase, 'server_time', v_now, 'starts_at', v_r.starts_at,
        'rate', giftsim.setting('crash_rate'),
        'crash_point', case when v_phase = 'crashed' then v_r.crash_point end,
        'next_round_at', case when v_phase = 'crashed'
                              then v_r.crash_at + make_interval(secs => (giftsim.setting('crash_pause_s'))::numeric) end,
        'bets', coalesce((select jsonb_agg(jsonb_build_object(
                    'user', coalesce(u.first_name, 'Игрок'), 'photo_url', u.photo_url, 'bet', b.bet,
                    'status', b.status, 'cashout_at', b.cashout_at, 'payout', b.payout, 'me', b.user_id = p_tg_id)
                 order by b.bet desc)
                 from giftsim.crash_game_bets b join giftsim.users u on u.tg_id = b.user_id
                 where b.round_id = v_r.id), '[]'::jsonb),
        'history', coalesce((select jsonb_agg(crash_point order by id desc) from (
                    select id, crash_point from giftsim.crash_game where crash_at <= v_now order by id desc limit 15) h), '[]'::jsonb),
        'balance', giftsim._balance(p_tg_id));
end;
$$;

create function giftsim.crash_game_bet(p_tg_id bigint, p_bet bigint, p_auto_cashout numeric default null) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_r giftsim.crash_game := giftsim._crash_game_current();
begin
    perform giftsim._check_bet(p_bet);
    if p_auto_cashout is not null and p_auto_cashout < 1.01 then raise exception 'bad_auto_cashout'; end if;
    if clock_timestamp() >= v_r.starts_at then raise exception 'betting_closed'; end if;
    insert into giftsim.crash_game_bets (round_id, user_id, bet, auto_cashout)
    values (v_r.id, p_tg_id, p_bet, p_auto_cashout)
    on conflict (round_id, user_id) do nothing;
    if not found then raise exception 'already_bet'; end if;
    perform giftsim._move(p_tg_id, -p_bet, 'crash_bet', 'g' || v_r.id);
    perform giftsim._wager(p_tg_id, p_bet);
    perform giftsim._stat(p_tg_id, 'crash_played', 1);
    return giftsim.crash_game_state(p_tg_id);
end;
$$;

create function giftsim.crash_game_cashout(p_tg_id bigint) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_r   giftsim.crash_game := giftsim._crash_game_current();
    v_now timestamptz := clock_timestamp();
    v_m   numeric;
    v_bet bigint;
begin
    if v_now < v_r.starts_at or v_now >= v_r.crash_at then raise exception 'not_running'; end if;
    select bet into v_bet from giftsim.crash_game_bets
     where round_id = v_r.id and user_id = p_tg_id and status = 'active' for update;
    if v_bet is null then raise exception 'no_active_bet'; end if;
    v_m := giftsim._mult_at(extract(epoch from v_now - v_r.starts_at));
    update giftsim.crash_game_bets set status = 'cashed', cashout_at = v_m, payout = floor(v_bet * v_m)
     where round_id = v_r.id and user_id = p_tg_id;
    perform giftsim._move(p_tg_id, floor(v_bet * v_m)::bigint, 'crash_win', 'g' || v_r.id);
    perform giftsim._stat_max(p_tg_id, 'crash_best_x100', (v_m * 100)::bigint);
    return giftsim.crash_game_state(p_tg_id) || jsonb_build_object('cashout_at', v_m, 'payout', floor(v_bet * v_m));
end;
$$;

-- одиночный краш тоже засчитываем в статистику
create or replace function giftsim.crash_cashout(p_tg_id bigint, p_round_id bigint) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_r giftsim.crash_rounds;
    v_m numeric;
begin
    select * into v_r from giftsim.crash_rounds where id = p_round_id and user_id = p_tg_id for update;
    if not found then raise exception 'round_not_found'; end if;
    v_r := giftsim._crash_settle(v_r);
    if v_r.status = 'active' then
        v_m := giftsim._crash_multiplier(v_r.started_at);
        update giftsim.crash_rounds
           set status = 'cashed', cashout_at = v_m, payout = floor(bet * v_m), ended_at = clock_timestamp()
         where id = v_r.id returning * into v_r;
        perform giftsim._move(p_tg_id, v_r.payout, 'crash_win', v_r.id::text);
    end if;
    if v_r.status = 'cashed' then perform giftsim._stat_max(p_tg_id, 'crash_best_x100', (v_r.cashout_at * 100)::bigint); end if;
    return giftsim._crash_public(v_r);
end;
$$;

create or replace function giftsim.crash_start(p_tg_id bigint, p_bet bigint, p_auto_cashout numeric default null)
returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_edge  numeric := (giftsim.setting('crash_house_edge'))::numeric;
    v_point numeric;
    v_r     giftsim.crash_rounds;
begin
    perform giftsim._check_bet(p_bet);
    if p_auto_cashout is not null and p_auto_cashout < 1.01 then raise exception 'bad_auto_cashout'; end if;
    for v_r in select * from giftsim.crash_rounds where user_id = p_tg_id and status = 'active' for update loop
        v_r := giftsim._crash_settle(v_r);
        if v_r.status = 'active' then raise exception 'round_active'; end if;
    end loop;
    v_point := least(greatest(1.00, floor((1 - v_edge) / (1 - giftsim.rand()) * 100) / 100), 10000.00);
    insert into giftsim.crash_rounds (user_id, bet, crash_point, auto_cashout)
    values (p_tg_id, p_bet, v_point, p_auto_cashout) returning * into v_r;
    perform giftsim._move(p_tg_id, -p_bet, 'crash_bet', v_r.id::text);
    perform giftsim._wager(p_tg_id, p_bet);
    perform giftsim._stat(p_tg_id, 'crash_played', 1);
    return giftsim._crash_public(v_r);
end;
$$;

-- ================================================================ джекпот

create function giftsim._jackpot_settle(p_round giftsim.jackpot_rounds) returns void
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_ticket double precision := giftsim.rand() * p_round.total_value;
    v_acc    bigint := 0;
    v_winner bigint;
    b        record;
begin
    for b in select user_id, value from giftsim.jackpot_bets where round_id = p_round.id order by id loop
        v_acc := v_acc + b.value;
        if v_ticket < v_acc then v_winner := b.user_id; exit; end if;
    end loop;
    v_winner := coalesce(v_winner, (select user_id from giftsim.jackpot_bets where round_id = p_round.id order by id desc limit 1));

    update giftsim.inventory set user_id = v_winner, status = 'owned', source = 'jackpot', source_ref = p_round.id::text
     where id in (select unnest(inventory_ids) from giftsim.jackpot_bets where round_id = p_round.id);
    update giftsim.jackpot_rounds set status = 'finished', winner = v_winner, ticket = v_ticket, finished_at = now()
     where id = p_round.id;
    perform giftsim._stat(v_winner, 'jackpot_wins', 1);
end;
$$;

create function giftsim._jackpot_current() returns giftsim.jackpot_rounds
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_r giftsim.jackpot_rounds;
begin
    perform pg_advisory_xact_lock(hashtext('giftsim.jackpot'));
    select * into v_r from giftsim.jackpot_rounds where status = 'open';
    if v_r.id is not null and v_r.ends_at is not null and v_r.ends_at <= now() then
        perform giftsim._jackpot_settle(v_r);
        v_r := null;
    end if;
    if v_r.id is null then
        insert into giftsim.jackpot_rounds default values returning * into v_r;
    end if;
    return v_r;
end;
$$;

create function giftsim.jackpot_state(p_tg_id bigint) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_r giftsim.jackpot_rounds := giftsim._jackpot_current();
begin
    return jsonb_build_object(
        'round_id', v_r.id, 'ends_at', v_r.ends_at, 'server_time', now(), 'total_value', v_r.total_value,
        'bets', coalesce((select jsonb_agg(jsonb_build_object(
                    'user', coalesce(u.first_name, 'Игрок'), 'photo_url', u.photo_url, 'me', b.user_id = p_tg_id,
                    'value', b.value,
                    'chance', case when v_r.total_value > 0 then round(b.value::numeric / v_r.total_value * 100, 2) end,
                    'gifts', (select jsonb_agg(giftsim._gift_json(i.gift_id)) from giftsim.inventory i where i.id = any(b.inventory_ids)))
                 order by b.id)
                 from giftsim.jackpot_bets b join giftsim.users u on u.tg_id = b.user_id where b.round_id = v_r.id), '[]'::jsonb),
        'last_winners', coalesce((select jsonb_agg(jsonb_build_object(
                    'round_id', r.id, 'user', coalesce(u.first_name, 'Игрок'), 'photo_url', u.photo_url,
                    'total_value', r.total_value, 'finished_at', r.finished_at,
                    'chance', round((select sum(value) from giftsim.jackpot_bets where round_id = r.id and user_id = r.winner)::numeric
                                    / r.total_value * 100, 2))
                 order by r.id desc)
                 from (select * from giftsim.jackpot_rounds where status = 'finished' order by id desc limit 10) r
                 join giftsim.users u on u.tg_id = r.winner), '[]'::jsonb));
end;
$$;

create function giftsim.jackpot_bet(p_tg_id bigint, p_ids bigint[]) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_r       giftsim.jackpot_rounds := giftsim._jackpot_current();
    v_value   bigint;
    v_players integer;
begin
    if array_length(p_ids, 1) > 10 then raise exception 'too_many_items'; end if;
    v_value := giftsim._take_items(p_tg_id, p_ids, 'staked');
    if v_value < (giftsim.setting('jackpot_min_value'))::bigint then raise exception 'bet_too_small'; end if;
    insert into giftsim.jackpot_bets (round_id, user_id, inventory_ids, value) values (v_r.id, p_tg_id, p_ids, v_value);
    select count(distinct user_id) into v_players from giftsim.jackpot_bets where round_id = v_r.id;
    update giftsim.jackpot_rounds
       set total_value = total_value + v_value,
           -- таймер запускается, когда в раунде появляется второй игрок
           ends_at = case when ends_at is null and v_players >= 2
                          then now() + make_interval(secs => (giftsim.setting('jackpot_duration_s'))::numeric) else ends_at end
     where id = v_r.id;
    perform giftsim._wager(p_tg_id, v_value);
    perform giftsim._stat(p_tg_id, 'jackpot_bets', 1);
    return giftsim.jackpot_state(p_tg_id);
end;
$$;

-- ================================================================ битвы кейсов

create function giftsim._battle_public(p_id bigint, p_tg_id bigint) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select jsonb_build_object(
        'id', b.id, 'status', b.status, 'max_players', b.max_players, 'cost', b.cost,
        'winner_slot', b.winner_slot, 'total_value', b.total_value, 'created_at', b.created_at,
        'is_creator', b.creator = p_tg_id,
        'cases', (select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'price', c.price_stars,
                                                     'cover', giftsim._gift_json(c.cover_gift)) order by ord)
                    from unnest(b.case_ids) with ordinality as t(cid, ord) join giftsim.cases c on c.id = t.cid),
        'players', (select jsonb_agg(jsonb_build_object(
                        'slot', p.slot, 'bot', p.user_id is null, 'me', p.user_id = p_tg_id,
                        'user', case when p.user_id is null then 'Бот' else coalesce(u.first_name, 'Игрок') end,
                        'photo_url', u.photo_url, 'total', p.total,
                        'drops', (select jsonb_agg(giftsim._gift_json(d.gift_id) order by d.round_no)
                                    from giftsim.battle_drops d where d.battle_id = b.id and d.slot = p.slot))
                     order by p.slot)
                      from giftsim.battle_players p left join giftsim.users u on u.tg_id = p.user_id
                     where p.battle_id = b.id))
    from giftsim.battles b where b.id = p_id
$$;

create function giftsim._battle_resolve(p_id bigint) returns void
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_b     giftsim.battles;
    p       record;
    v_gift  text;
    v_best  bigint;
    v_win   integer;
    v_total bigint;
begin
    select * into v_b from giftsim.battles where id = p_id for update;
    for p in select slot from giftsim.battle_players where battle_id = p_id order by slot loop
        for r in 1 .. array_length(v_b.case_ids, 1) loop
            v_gift := giftsim._case_roll(v_b.case_ids[r]);
            insert into giftsim.battle_drops (battle_id, slot, round_no, gift_id, value)
            select p_id, p.slot, r, v_gift, price_stars from giftsim.gifts where id = v_gift;
        end loop;
    end loop;
    update giftsim.battle_players bp set total = (select coalesce(sum(value), 0) from giftsim.battle_drops d
                                                  where d.battle_id = p_id and d.slot = bp.slot)
     where bp.battle_id = p_id;

    select max(total) into v_best from giftsim.battle_players where battle_id = p_id;
    -- при равенстве победителя выбирает случай
    select slot into v_win from giftsim.battle_players where battle_id = p_id and total = v_best
     order by giftsim.rand() limit 1;
    select sum(value) into v_total from giftsim.battle_drops where battle_id = p_id;

    update giftsim.battles set status = 'finished', winner_slot = v_win, total_value = v_total, finished_at = now()
     where id = p_id;

    -- все дропы получает победитель (если победил бот — призы сгорают)
    perform giftsim._grant_prize(bp.user_id, d.gift_id, 'battle', p_id::text)
       from giftsim.battle_drops d
       join giftsim.battle_players bp on bp.battle_id = p_id and bp.slot = v_win
      where d.battle_id = p_id and bp.user_id is not null;
    perform giftsim._stat(user_id, 'battle_wins', 1)
       from giftsim.battle_players where battle_id = p_id and slot = v_win and user_id is not null;
end;
$$;

create function giftsim.battle_create(p_tg_id bigint, p_case_ids text[], p_players integer) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_cost bigint;
    v_n    integer;
    v_id   bigint;
begin
    if p_players not between 2 and 4 then raise exception 'bad_players'; end if;
    if array_length(p_case_ids, 1) is null or array_length(p_case_ids, 1) > 10 then raise exception 'bad_cases'; end if;
    select sum(c.price_stars), count(*) into v_cost, v_n
      from unnest(p_case_ids) t(cid) join giftsim.cases c on c.id = t.cid and c.active and c.pay_mode = 'stars';
    if v_n <> array_length(p_case_ids, 1) then raise exception 'bad_cases'; end if;

    insert into giftsim.battles (creator, case_ids, max_players, cost)
    values (p_tg_id, p_case_ids, p_players, v_cost) returning id into v_id;
    insert into giftsim.battle_players (battle_id, slot, user_id) values (v_id, 0, p_tg_id);
    perform giftsim._move(p_tg_id, -v_cost, 'battle_join', v_id::text);
    perform giftsim._wager(p_tg_id, v_cost);
    perform giftsim._stat(p_tg_id, 'battles', 1);
    return giftsim._battle_public(v_id, p_tg_id);
end;
$$;

create function giftsim.battle_join(p_tg_id bigint, p_battle_id bigint) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_b    giftsim.battles;
    v_slot integer;
begin
    select * into v_b from giftsim.battles where id = p_battle_id for update;
    if not found then raise exception 'battle_not_found'; end if;
    if v_b.status <> 'waiting' then raise exception 'battle_started'; end if;
    if exists (select 1 from giftsim.battle_players where battle_id = p_battle_id and user_id = p_tg_id) then
        raise exception 'already_joined';
    end if;
    select count(*) into v_slot from giftsim.battle_players where battle_id = p_battle_id;
    insert into giftsim.battle_players (battle_id, slot, user_id) values (p_battle_id, v_slot, p_tg_id);
    perform giftsim._move(p_tg_id, -v_b.cost, 'battle_join', p_battle_id::text);
    perform giftsim._wager(p_tg_id, v_b.cost);
    perform giftsim._stat(p_tg_id, 'battles', 1);
    if v_slot + 1 = v_b.max_players then perform giftsim._battle_resolve(p_battle_id); end if;
    return giftsim._battle_public(p_battle_id, p_tg_id);
end;
$$;

-- Создатель может заполнить свободные места ботами и сразу начать.
create function giftsim.battle_add_bots(p_tg_id bigint, p_battle_id bigint) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_b giftsim.battles;
    v_n integer;
begin
    select * into v_b from giftsim.battles where id = p_battle_id for update;
    if not found then raise exception 'battle_not_found'; end if;
    if v_b.creator <> p_tg_id then raise exception 'forbidden'; end if;
    if v_b.status <> 'waiting' then raise exception 'battle_started'; end if;
    select count(*) into v_n from giftsim.battle_players where battle_id = p_battle_id;
    insert into giftsim.battle_players (battle_id, slot, user_id)
    select p_battle_id, s, null from generate_series(v_n, v_b.max_players - 1) s;
    perform giftsim._battle_resolve(p_battle_id);
    return giftsim._battle_public(p_battle_id, p_tg_id);
end;
$$;

-- Создатель может отменить битву, пока никто не присоединился.
create function giftsim.battle_cancel(p_tg_id bigint, p_battle_id bigint) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_b giftsim.battles;
begin
    select * into v_b from giftsim.battles where id = p_battle_id for update;
    if not found then raise exception 'battle_not_found'; end if;
    if v_b.creator <> p_tg_id then raise exception 'forbidden'; end if;
    if v_b.status <> 'waiting' or (select count(*) from giftsim.battle_players where battle_id = p_battle_id) > 1 then
        raise exception 'battle_cannot_cancel';
    end if;
    update giftsim.battles set status = 'finished', finished_at = now() where id = p_battle_id;
    perform giftsim._move(p_tg_id, v_b.cost, 'battle_refund', p_battle_id::text);
    return jsonb_build_object('cancelled', true, 'balance', giftsim._balance(p_tg_id));
end;
$$;

create function giftsim.battle_list(p_tg_id bigint) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select jsonb_build_object(
        'waiting', coalesce((select jsonb_agg(giftsim._battle_public(id, p_tg_id) order by created_at desc)
                               from (select id, created_at from giftsim.battles where status = 'waiting'
                                     order by created_at desc limit 30) w), '[]'::jsonb),
        'recent', coalesce((select jsonb_agg(giftsim._battle_public(id, p_tg_id) order by finished_at desc)
                              from (select id, finished_at from giftsim.battles where status = 'finished' and winner_slot is not null
                                    order by finished_at desc limit 10) r), '[]'::jsonb))
$$;

create function giftsim.battle_get(p_tg_id bigint, p_battle_id bigint) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$ select giftsim._battle_public(p_battle_id, p_tg_id) $$;

-- ================================================================ задания

create function giftsim._task_period(p_period text) returns text
language sql stable as $$
    select case when p_period = 'daily' then to_char(current_date, 'YYYY-MM-DD') else 'once' end
$$;

create function giftsim._task_progress(p_tg_id bigint, p_task giftsim.tasks) returns bigint
language sql stable set search_path = giftsim, pg_temp as $$
    select case when p_task.kind <> 'stat' then null else coalesce((
        select value from giftsim.user_stats
         where user_id = p_tg_id
           and key = p_task.stat_key || case when p_task.period = 'daily' then ':' || to_char(current_date, 'YYYY-MM-DD') else '' end
    ), 0) end
$$;

create function giftsim.list_tasks(p_tg_id bigint) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'title', t.title, 'description', t.description, 'kind', t.kind, 'period', t.period,
        'target', t.target, 'progress', least(giftsim._task_progress(p_tg_id, t), t.target),
        'reward_stars', t.reward_stars, 'reward_keys', t.reward_keys, 'url', t.url,
        'claimed', exists (select 1 from giftsim.user_tasks ut where ut.user_id = p_tg_id and ut.task_id = t.id
                             and ut.period_key = giftsim._task_period(t.period)))
        order by (t.period = 'daily') desc, t.sort), '[]'::jsonb)
    from giftsim.tasks t where t.active
$$;

-- Для заданий-подписок серверная функция сначала проверяет подписку через Bot API и передаёт p_verified = true.
create function giftsim.claim_task(p_tg_id bigint, p_task_id text, p_verified boolean default false) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_t giftsim.tasks;
begin
    select * into v_t from giftsim.tasks where id = p_task_id and active;
    if not found then raise exception 'task_not_found'; end if;
    if v_t.kind = 'subscribe' and not p_verified then raise exception 'not_subscribed'; end if;
    if v_t.kind = 'stat' and giftsim._task_progress(p_tg_id, v_t) < v_t.target then raise exception 'task_not_done'; end if;

    insert into giftsim.user_tasks (user_id, task_id, period_key)
    values (p_tg_id, p_task_id, giftsim._task_period(v_t.period))
    on conflict do nothing;
    if not found then raise exception 'task_already_claimed'; end if;

    if v_t.reward_stars > 0 then perform giftsim._move(p_tg_id, v_t.reward_stars, 'task_reward', p_task_id); end if;
    if v_t.reward_keys > 0 then
        update giftsim.users set referral_keys = referral_keys + v_t.reward_keys where tg_id = p_tg_id;
    end if;
    return jsonb_build_object('reward_stars', v_t.reward_stars, 'reward_keys', v_t.reward_keys)
           || giftsim.get_profile(p_tg_id);
end;
$$;

create function giftsim.get_task_chat(p_task_id text) returns text
language sql stable set search_path = giftsim, pg_temp as $$
    select chat_id from giftsim.tasks where id = p_task_id and kind = 'subscribe' and active
$$;

-- ================================================================ рейтинг, лента, каталог, история цен

create function giftsim.leaderboard(p_kind text) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select coalesce(jsonb_agg(r order by (r->>'score')::bigint desc), '[]'::jsonb) from (
        select jsonb_build_object('user', coalesce(u.first_name, 'Игрок'), 'photo_url', u.photo_url, 'level', u.level,
               'score', case p_kind
                    when 'level' then u.xp
                    when 'inventory' then coalesce((select sum(g.price_stars) from giftsim.inventory i
                                                     join giftsim.gifts g on g.id = i.gift_id
                                                    where i.user_id = u.tg_id and i.status = 'owned'), 0)
                    else u.total_won end) as r
          from giftsim.users u
         order by case p_kind
                    when 'level' then u.xp
                    when 'inventory' then coalesce((select sum(g.price_stars) from giftsim.inventory i
                                                     join giftsim.gifts g on g.id = i.gift_id
                                                    where i.user_id = u.tg_id and i.status = 'owned'), 0)
                    else u.total_won end desc
         limit 50
    ) t
$$;

create function giftsim.list_gifts(p_min bigint default 0, p_max bigint default null, p_search text default null)
returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select coalesce(jsonb_agg(giftsim._gift_json(id) || jsonb_build_object('supply', supply, 'price_ton', price_ton)
                              order by price_stars), '[]'::jsonb)
      from giftsim.gifts
     where active and kind = 'nft' and price_stars >= p_min and (p_max is null or price_stars <= p_max)
       and (p_search is null or name ilike '%' || p_search || '%')
$$;

create function giftsim.gift_history(p_gift_id text, p_days integer default 7) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select jsonb_build_object(
        'gift', giftsim._gift_json(p_gift_id),
        'points', coalesce((select jsonb_agg(jsonb_build_object('t', recorded_at, 'stars', price_stars, 'ton', price_ton)
                                             order by recorded_at)
                              from giftsim.gift_price_history
                             where gift_id = p_gift_id and recorded_at > now() - make_interval(days => least(p_days, 90))), '[]'::jsonb),
        'change_24h', (select round((g.price_stars - h.price_stars)::numeric / h.price_stars * 100, 2)
                         from giftsim.gifts g,
                              lateral (select price_stars from giftsim.gift_price_history
                                        where gift_id = p_gift_id and recorded_at <= now() - interval '24 hours'
                                        order by recorded_at desc limit 1) h
                        where g.id = p_gift_id))
$$;

create or replace function giftsim.recent_drops(p_limit int default 20) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select coalesce(jsonb_agg(d order by (d->>'at') desc), '[]'::jsonb) from (
        select giftsim._gift_json(i.gift_id) || jsonb_build_object(
                   'user', coalesce(u.first_name, 'Игрок'), 'source', i.source, 'at', i.obtained_at) as d
          from giftsim.inventory i join giftsim.users u on u.tg_id = i.user_id
         where i.source in ('case', 'upgrade', 'contract', 'jackpot', 'battle')
         order by i.obtained_at desc
         limit least(greatest(p_limit, 1), 50)
    ) t
$$;

-- ================================================================ обновление цен (вызывает серверная функция раз в час)

create function giftsim.rarity_for_ton(p_ton numeric) returns text
language sql immutable as $$
    select case when p_ton < 10 then 'common' when p_ton < 50 then 'rare' when p_ton < 300 then 'epic'
                when p_ton < 2000 then 'legendary' else 'mythic' end
$$;

-- p_items: [{"slug": "plushpepe", "floor_ton": 7000}, ...]
create function giftsim.apply_prices(p_items jsonb, p_stars_per_ton numeric) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_updated integer;
    v_cases   integer := 0;
    v_failed  text[] := '{}';
    c         record;
begin
    if p_stars_per_ton is null or p_stars_per_ton <= 0 then raise exception 'bad_rate'; end if;
    insert into giftsim.settings (key, value) values ('stars_per_ton', to_jsonb(p_stars_per_ton))
    on conflict (key) do update set value = excluded.value, updated_at = now();

    with src as (
        select x->>'slug' as slug, (x->>'floor_ton')::numeric as ton
          from jsonb_array_elements(p_items) x
         where (x->>'floor_ton') is not null and (x->>'floor_ton')::numeric > 0
    ), upd as (
        update giftsim.gifts g
           set price_ton = src.ton, price_stars = greatest(1, round(src.ton * p_stars_per_ton))::bigint,
               rarity = giftsim.rarity_for_ton(src.ton), updated_at = now()
          from src where g.id = src.slug and g.kind = 'nft'
        returning g.id, g.price_ton, g.price_stars
    ), hist as (
        insert into giftsim.gift_price_history (gift_id, price_ton, price_stars)
        select id, price_ton, price_stars from upd
        returning 1
    ) select count(*) into v_updated from hist;

    for c in select id from giftsim.cases where odds_mode = 'auto' loop
        if giftsim.rebalance_case(c.id) then v_cases := v_cases + 1; else v_failed := v_failed || c.id; end if;
    end loop;
    delete from giftsim.gift_price_history where recorded_at < now() - interval '90 days';
    return jsonb_build_object('gifts_updated', v_updated, 'cases_rebalanced', v_cases, 'cases_failed', to_jsonb(v_failed));
end;
$$;

-- ================================================================ админка

create function giftsim.admin_upsert_case(p_tg_id bigint, p jsonb) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_id text := coalesce(nullif(p->>'id', ''), 'c' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS'));
begin
    perform giftsim._require_admin(p_tg_id);
    if v_id !~ '^[a-z0-9_-]{2,40}$' then raise exception 'bad_case_id'; end if;
    insert into giftsim.cases (id, name, price_stars, cover_gift, sort, active, category, description, badge,
                               pay_mode, price_keys, free_cooldown_h, available_until, max_opens, odds_mode, target_rtp, created_by)
    values (v_id, p->>'name', (p->>'price_stars')::bigint, nullif(p->>'cover_gift', ''),
            coalesce((p->>'sort')::int, 0), coalesce((p->>'active')::boolean, true),
            coalesce(p->>'category', 'custom'), p->>'description', nullif(p->>'badge', ''),
            coalesce(p->>'pay_mode', 'stars'), (p->>'price_keys')::int, (p->>'free_cooldown_h')::int,
            (p->>'available_until')::timestamptz, (p->>'max_opens')::int,
            coalesce(p->>'odds_mode', 'auto'), coalesce((p->>'target_rtp')::numeric, 0.9), p_tg_id)
    on conflict (id) do update set
        name = coalesce(excluded.name, giftsim.cases.name),
        price_stars = coalesce(excluded.price_stars, giftsim.cases.price_stars),
        cover_gift = coalesce(excluded.cover_gift, giftsim.cases.cover_gift),
        sort = excluded.sort, active = excluded.active, category = excluded.category,
        description = excluded.description, badge = excluded.badge, pay_mode = excluded.pay_mode,
        price_keys = excluded.price_keys, free_cooldown_h = excluded.free_cooldown_h,
        available_until = excluded.available_until, max_opens = excluded.max_opens,
        odds_mode = excluded.odds_mode, target_rtp = excluded.target_rtp;
    if (select odds_mode from giftsim.cases where id = v_id) = 'auto' then perform giftsim.rebalance_case(v_id); end if;
    return giftsim.admin_get_case(p_tg_id, v_id);
end;
$$;

-- p_items: [{"gift_id": "plushpepe", "weight": 5}, ...]; weight нужен только в ручном режиме.
create function giftsim.admin_set_case_items(p_tg_id bigint, p_case_id text, p_items jsonb) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_ok boolean := true;
begin
    perform giftsim._require_admin(p_tg_id);
    if not exists (select 1 from giftsim.cases where id = p_case_id) then raise exception 'case_not_found'; end if;
    if jsonb_array_length(p_items) < 2 then raise exception 'need_2_items'; end if;
    delete from giftsim.case_items where case_id = p_case_id;
    insert into giftsim.case_items (case_id, gift_id, weight)
    select p_case_id, x->>'gift_id', greatest(1, coalesce((x->>'weight')::int, 1))
      from jsonb_array_elements(p_items) x;
    if (select odds_mode from giftsim.cases where id = p_case_id) = 'auto' then
        v_ok := giftsim.rebalance_case(p_case_id);
    end if;
    update giftsim.cases set cover_gift = coalesce(cover_gift, (
        select ci.gift_id from giftsim.case_items ci join giftsim.gifts g on g.id = ci.gift_id
         where ci.case_id = p_case_id order by g.price_stars desc limit 1)) where id = p_case_id;
    return giftsim.admin_get_case(p_tg_id, p_case_id) || jsonb_build_object('rebalanced', v_ok);
end;
$$;

create function giftsim.admin_get_case(p_tg_id bigint, p_case_id text) returns jsonb
language plpgsql stable set search_path = giftsim, pg_temp as $$
begin
    perform giftsim._require_admin(p_tg_id);
    return (select to_jsonb(c) || jsonb_build_object(
                'rtp', giftsim.case_rtp(c.id),
                'items', giftsim.get_case(c.id) -> 'items',
                'stats', (select jsonb_build_object(
                              'opens', count(*), 'spent', coalesce(sum(o.price), 0),
                              'paid_out', coalesce(sum(i.value_at_drop), 0),
                              'real_rtp', case when sum(o.price) > 0 then round(sum(i.value_at_drop)::numeric / sum(o.price), 4) end)
                            from giftsim.case_opens o left join giftsim.inventory i on i.id = o.inventory_id
                           where o.case_id = c.id))
              from giftsim.cases c where c.id = p_case_id);
end;
$$;

create function giftsim.admin_list_cases(p_tg_id bigint) returns jsonb
language plpgsql stable set search_path = giftsim, pg_temp as $$
begin
    perform giftsim._require_admin(p_tg_id);
    return (select coalesce(jsonb_agg(jsonb_build_object(
                'id', c.id, 'name', c.name, 'category', c.category, 'price_stars', c.price_stars,
                'pay_mode', c.pay_mode, 'active', c.active, 'odds_mode', c.odds_mode, 'rtp', giftsim.case_rtp(c.id),
                'opens', c.opens_count) order by c.category, c.sort, c.price_stars), '[]'::jsonb)
              from giftsim.cases c);
end;
$$;

create function giftsim.admin_grant(p_tg_id bigint, p_target bigint, p_stars bigint, p_gift_id text default null)
returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
begin
    perform giftsim._require_admin(p_tg_id);
    if p_stars is not null and p_stars <> 0 then
        perform giftsim._move(p_target, p_stars, 'admin', 'by ' || p_tg_id);
    end if;
    if p_gift_id is not null then
        perform giftsim._give_gift(p_target, p_gift_id, 'admin', 'by ' || p_tg_id);
    end if;
    return giftsim.get_profile(p_target);
end;
$$;

create function giftsim.admin_set_setting(p_tg_id bigint, p_key text, p_value jsonb) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
begin
    perform giftsim._require_admin(p_tg_id);
    if p_key in ('admin_usernames') then raise exception 'forbidden'; end if;  -- админов меняем только миграцией
    update giftsim.settings set value = p_value, updated_at = now() where key = p_key;
    if not found then raise exception 'setting_not_found'; end if;
    return (select jsonb_object_agg(key, value) from giftsim.settings);
end;
$$;

create function giftsim.admin_upsert_task(p_tg_id bigint, p jsonb) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
begin
    perform giftsim._require_admin(p_tg_id);
    insert into giftsim.tasks (id, title, description, kind, stat_key, target, period, reward_stars, reward_keys,
                               chat_id, url, sort, active)
    values (p->>'id', p->>'title', p->>'description', p->>'kind', p->>'stat_key', coalesce((p->>'target')::bigint, 1),
            coalesce(p->>'period', 'once'), coalesce((p->>'reward_stars')::bigint, 0), coalesce((p->>'reward_keys')::int, 0),
            p->>'chat_id', p->>'url', coalesce((p->>'sort')::int, 0), coalesce((p->>'active')::boolean, true))
    on conflict (id) do update set title = excluded.title, description = excluded.description, kind = excluded.kind,
        stat_key = excluded.stat_key, target = excluded.target, period = excluded.period,
        reward_stars = excluded.reward_stars, reward_keys = excluded.reward_keys, chat_id = excluded.chat_id,
        url = excluded.url, sort = excluded.sort, active = excluded.active;
    return giftsim.list_tasks(p_tg_id);
end;
$$;

create function giftsim.admin_overview(p_tg_id bigint) returns jsonb
language plpgsql stable set search_path = giftsim, pg_temp as $$
begin
    perform giftsim._require_admin(p_tg_id);
    return jsonb_build_object(
        'users', (select count(*) from giftsim.users),
        'users_24h', (select count(*) from giftsim.users where last_seen_at > now() - interval '24 hours'),
        'cases_opened_24h', (select count(*) from giftsim.case_opens where created_at > now() - interval '24 hours'),
        'stars_in_circulation', (select coalesce(sum(balance), 0) from giftsim.users),
        'inventory_value', (select coalesce(sum(g.price_stars), 0) from giftsim.inventory i join giftsim.gifts g on g.id = i.gift_id where i.status = 'owned'),
        'last_price_update', (select max(recorded_at) from giftsim.gift_price_history),
        'settings', (select jsonb_object_agg(key, value) from giftsim.settings));
end;
$$;

-- ================================================================ права

revoke all on all functions in schema giftsim from public, anon, authenticated;
revoke all on all tables in schema giftsim from public, anon, authenticated;

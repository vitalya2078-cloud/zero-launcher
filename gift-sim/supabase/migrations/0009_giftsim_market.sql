-- FORTUM DROPS: маркет между игроками.
-- Продавец сам ставит цену (50–500% от цены Fragment), подарок на время продажи «выставлен» и не участвует в играх.
-- Покупатель платит полную цену, продавец получает 95%: 5% комиссии сгорает, чтобы звёзды не размножались.

alter table giftsim.inventory
  drop constraint inventory_status_check,
  add constraint inventory_status_check check (status = any (array['owned','sold','consumed','staked','listed'])),
  drop constraint inventory_source_check,
  add constraint inventory_source_check check (source = any (array['case','crash','daily','admin','upgrade','contract','jackpot','battle','task','market']));

alter table giftsim.transactions
  drop constraint transactions_reason_check,
  add constraint transactions_reason_check check (reason = any (array['start','daily','case_open','item_sell','crash_bet','crash_win','admin','referral_bonus','referral_reward','referral_commission','level_reward','task_reward','rescue','game_bet','game_win','battle_join','battle_refund','prize_stars','market_buy','market_sale']));

create table if not exists giftsim.market_listings (
    id           bigserial primary key,
    inventory_id bigint not null references giftsim.inventory (id),
    seller       bigint not null references giftsim.users (tg_id),
    gift_id      text   not null references giftsim.gifts (id),
    price        bigint not null check (price > 0),
    status       text   not null default 'active' check (status in ('active', 'sold', 'cancelled')),
    buyer        bigint references giftsim.users (tg_id),
    created_at   timestamptz not null default now(),
    closed_at    timestamptz
);
create unique index if not exists market_active_item on giftsim.market_listings (inventory_id) where status = 'active';
create index if not exists market_active_gift on giftsim.market_listings (gift_id, price) where status = 'active';
create index if not exists market_seller on giftsim.market_listings (seller, status);
alter table giftsim.market_listings enable row level security;

insert into giftsim.settings (key, value) values ('market_fee', '0.05'), ('market_min_k', '0.5'), ('market_max_k', '5')
on conflict (key) do nothing;

create or replace function giftsim._lot_json(l giftsim.market_listings, p_viewer bigint) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select giftsim._inv_json(l.inventory_id) || jsonb_build_object(
        'lot_id', l.id, 'price', l.price, 'status', l.status, 'listed_at', l.created_at, 'closed_at', l.closed_at,
        'mine', l.seller = p_viewer,
        'seller', (select jsonb_build_object('user', coalesce(first_name, 'Игрок'), 'id', public_id) from giftsim.users where tg_id = l.seller))
$$;

-- выставить подарок
create or replace function giftsim.market_list(p_tg_id bigint, p_inv bigint, p_price bigint) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare v_gift text; v_value bigint; v_id bigint;
begin
    select i.gift_id, g.price_stars into v_gift, v_value
      from giftsim.inventory i join giftsim.gifts g on g.id = i.gift_id
     where i.id = p_inv and i.user_id = p_tg_id and i.status = 'owned' and g.kind = 'nft'
     for update of i;
    if v_gift is null then raise exception 'item_not_found'; end if;
    if p_price < ceil(v_value * (giftsim.setting('market_min_k'))::numeric)
       or p_price > floor(v_value * (giftsim.setting('market_max_k'))::numeric) then raise exception 'price_out_of_range'; end if;
    update giftsim.inventory set status = 'listed' where id = p_inv;
    insert into giftsim.market_listings (inventory_id, seller, gift_id, price) values (p_inv, p_tg_id, v_gift, p_price)
    returning id into v_id;
    return giftsim._lot_json((select l from giftsim.market_listings l where l.id = v_id), p_tg_id);
end;
$$;

-- снять с продажи
create or replace function giftsim.market_cancel(p_tg_id bigint, p_lot bigint) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare l giftsim.market_listings;
begin
    select * into l from giftsim.market_listings where id = p_lot and seller = p_tg_id and status = 'active' for update;
    if l.id is null then raise exception 'lot_not_found'; end if;
    update giftsim.market_listings set status = 'cancelled', closed_at = now() where id = l.id;
    update giftsim.inventory set status = 'owned' where id = l.inventory_id;
    return jsonb_build_object('ok', true);
end;
$$;

-- купить
create or replace function giftsim.market_buy(p_tg_id bigint, p_lot bigint) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare l giftsim.market_listings; v_net bigint;
begin
    select * into l from giftsim.market_listings where id = p_lot for update;
    if l.id is null or l.status <> 'active' then raise exception 'lot_not_available'; end if;
    if l.seller = p_tg_id then raise exception 'own_lot'; end if;
    v_net := floor(l.price * (1 - (giftsim.setting('market_fee'))::numeric));
    perform giftsim._move(p_tg_id, -l.price, 'market_buy', 'lot' || l.id);
    perform giftsim._move(l.seller, v_net, 'market_sale', 'lot' || l.id);
    update giftsim.market_listings set status = 'sold', buyer = p_tg_id, closed_at = now() where id = l.id;
    -- тот же экземпляр (номер, фон, узор) переходит покупателю
    update giftsim.inventory set user_id = p_tg_id, status = 'owned', source = 'market', source_ref = 'lot' || l.id,
           value_at_drop = l.price, obtained_at = now()
     where id = l.inventory_id;
    return jsonb_build_object(
        'item', giftsim._inv_json(l.inventory_id), 'price', l.price, 'balance', giftsim._balance(p_tg_id),
        -- для уведомления продавцу (в клиент не уходит — API забирает и удаляет)
        'notify', jsonb_build_object('seller', l.seller, 'net', v_net,
                  'name', (select name from giftsim.gifts where id = l.gift_id),
                  'num', (select nft_num from giftsim.inventory where id = l.inventory_id),
                  'buyer', (select coalesce(first_name, 'Игрок') from giftsim.users where tg_id = p_tg_id)));
end;
$$;

-- витрина: активные лоты с фильтром по коллекции и сортировкой
create or replace function giftsim.market_lots(p_viewer bigint, p_gift text, p_sort text, p_offset int) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select jsonb_build_object(
        'lots', coalesce((select jsonb_agg(giftsim._lot_json(x.lot, p_viewer) order by x.rn) from (
            select l as lot, row_number() over (order by
                case when p_sort = 'price_desc' then -l.price end,
                case when p_sort = 'new' then -extract(epoch from l.created_at) end,
                l.price, l.id) as rn
              from giftsim.market_listings l
             where l.status = 'active' and (p_gift is null or l.gift_id = p_gift)
             order by rn offset greatest(p_offset, 0) limit 60) x), '[]'::jsonb),
        'total', (select count(*) from giftsim.market_listings where status = 'active' and (p_gift is null or gift_id = p_gift)),
        'collections', coalesce((select jsonb_agg(c order by (c->>'n')::int desc) from (
            select giftsim._gift_json(gift_id) || jsonb_build_object('n', count(*), 'floor', min(price)) as c
              from giftsim.market_listings where status = 'active' group by gift_id) t), '[]'::jsonb)
    )
$$;

-- мои лоты и продажи
create or replace function giftsim.market_my(p_tg_id bigint) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select jsonb_build_object(
        'active', coalesce((select jsonb_agg(giftsim._lot_json(l, p_tg_id) order by l.created_at desc)
                              from giftsim.market_listings l where l.seller = p_tg_id and l.status = 'active'), '[]'::jsonb),
        'sold', coalesce((select jsonb_agg(giftsim._lot_json(l, p_tg_id) order by l.closed_at desc) from (
                              select * from giftsim.market_listings where seller = p_tg_id and status = 'sold'
                              order by closed_at desc limit 30) l), '[]'::jsonb),
        'earned', coalesce((select sum(amount) from giftsim.transactions where user_id = p_tg_id and reason = 'market_sale'), 0),
        'fee', giftsim.setting('market_fee'), 'min_k', giftsim.setting('market_min_k'), 'max_k', giftsim.setting('market_max_k'))
$$;

revoke all on all functions in schema giftsim from public, anon, authenticated;
revoke all on all tables in schema giftsim from public, anon, authenticated;

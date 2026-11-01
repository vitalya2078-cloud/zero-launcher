-- FORTUM DROPS: у каждого NFT в инвентаре свой номер, как в Telegram.
-- Номер определяет картинку и анимацию (nft.fragment.com/gift/<slug>-<номер>), а через неё — модель, узор и фон.
-- Названия атрибутов и их редкость подтягиваются с t.me/nft/<slug>-<номер> по запросу и кэшируются в nft_attrs.

-- сколько номеров выпущено в каждой коллекции (t.me/nft/<slug>-1, «Quantity: X/Y issued»), данные на 2026-11-01
alter table giftsim.gifts add column if not exists issued int;
alter table giftsim.gifts add column if not exists total_supply int;
update giftsim.gifts g set issued = v.issued, total_supply = v.total
  from (values
    ('algorithmcup', 169, 188),
    ('artisanbrick', 6296, 6852),
    ('astralshard', 5706, 6196),
    ('bdaycandle', 271769, 307521),
    ('berrybox', 53500, 66580),
    ('bigyear', 78352, 101415),
    ('blingbinky', 9432, 9990),
    ('bondedring', 7845, 8130),
    ('bowtie', 56614, 65687),
    ('bunnymuffin', 54610, 66655),
    ('candycane', 230752, 320622),
    ('chillflame', 448645, 482271),
    ('cloverpin', 235163, 270970),
    ('cookieheart', 200837, 264486),
    ('crystalball', 26783, 27732),
    ('cupidcharm', 30416, 33112),
    ('deskcalendar', 262714, 289320),
    ('diamondring', 32308, 32924),
    ('durovscap', 4710, 4774),
    ('durovsglasses', 3962, 4982),
    ('easteregg', 164086, 173176),
    ('electricskull', 9236, 9407),
    ('eternalcandle', 45189, 46590),
    ('eternalrose', 32104, 37640),
    ('evileye', 74731, 85204),
    ('faithamulet', 142544, 172784),
    ('finepen', 39141, 49529),
    ('flyingbroom', 24866, 25916),
    ('freshsocks', 166557, 200509),
    ('gemsignet', 6262, 6962),
    ('genielamp', 6607, 7666),
    ('gingercookie', 152095, 188888),
    ('hangingstar', 47515, 58118),
    ('happybrownie', 227494, 264231),
    ('heartlocket', 1951, 1973),
    ('heroichelmet', 3441, 3794),
    ('hexpot', 57096, 69837),
    ('holidaydrink', 90484, 120989),
    ('homemadecake', 180664, 199482),
    ('hypnolollipop', 84406, 116639),
    ('icecream', 328968, 342255),
    ('inputkey', 135556, 159750),
    ('instantramen', 390967, 457382),
    ('intelligencecup', 139, 220),
    ('iongem', 4537, 4692),
    ('ionicdryer', 20904, 25719),
    ('jackinthebox', 96259, 97345),
    ('jellybunny', 108605, 129350),
    ('jesterhat', 144344, 190222),
    ('jinglebells', 69691, 99711),
    ('jollychimp', 118099, 132155),
    ('joyfulbundle', 85100, 114092),
    ('khabibspapakha', 28671, 29000),
    ('kissedfrog', 14091, 14278),
    ('libertyfigure', 269253, 295480),
    ('lightsword', 125341, 131222),
    ('lolpop', 435083, 468745),
    ('lootbag', 14435, 14489),
    ('lovecandle', 24650, 30296),
    ('lovepotion', 29200, 30412),
    ('lowrider', 23492, 23950),
    ('luckylocket', 34485, 66022),
    ('lunarsnake', 202191, 259346),
    ('lushbouquet', 112681, 140116),
    ('madpumpkin', 19814, 22199),
    ('magicpotion', 4871, 4871),
    ('mightyarm', 3834, 4123),
    ('minioscar', 4895, 5614),
    ('moneypot', 74730, 91779),
    ('moodpack', 184539, 198560),
    ('moonpendant', 102752, 111080),
    ('moussecake', 180488, 230505),
    ('nailbracelet', 4696, 4818),
    ('nekohelmet', 15581, 16149),
    ('partysparkler', 189931, 243771),
    ('perfumebottle', 4439, 4848),
    ('petsnake', 193203, 279106),
    ('plushpepe', 2825, 2861),
    ('poolfloat', 228653, 246862),
    ('preciouspeach', 3010, 3160),
    ('prettyposy', 133937, 181231),
    ('rarebird', 13008, 14971),
    ('recordplayer', 35443, 46888),
    ('resistancedog', 13532, 15274),
    ('restlessjar', 103580, 120184),
    ('sakuraflower', 87996, 93115),
    ('santahat', 71869, 89034),
    ('scaredcat', 19289, 19289),
    ('sharptongue', 8148, 8546),
    ('signetring', 16984, 18499),
    ('skullflower', 22077, 24126),
    ('skystilettos', 52479, 58460),
    ('sleighbell', 23103, 28000),
    ('snakebox', 189703, 273898),
    ('snoopcigar', 117675, 119573),
    ('snoopdogg', 582498, 593781),
    ('snowglobe', 55624, 72788),
    ('snowmittens', 40568, 49969),
    ('spicedwine', 109038, 146090),
    ('springbasket', 185803, 231311),
    ('spyagaric', 86932, 89438),
    ('starnotepad', 74017, 99082),
    ('stellarrocket', 138394, 156318),
    ('surgeboard', 32862, 39464),
    ('swagbag', 232326, 237970),
    ('swisswatch', 26099, 29323),
    ('tamagadget', 108664, 135097),
    ('timelessbook', 89071, 99421),
    ('tophat', 34403, 35099),
    ('toybear', 56247, 57724),
    ('trappedheart', 25142, 26407),
    ('ufcstrike', 58897, 60000),
    ('valentinebox', 35657, 41025),
    ('vicecream', 442897, 490553),
    ('victorymedal', 107371, 124608),
    ('vintagecigar', 26852, 31024),
    ('voodoodoll', 26840, 27620),
    ('westsidesign', 11514, 11992),
    ('whipcupcake', 283719, 367619),
    ('winterwreath', 78071, 100846),
    ('witchhat', 82917, 88480),
    ('xmasstocking', 231536, 334632)
  ) as v(id, issued, total)
 where g.id = v.id;

-- номер экземпляра
alter table giftsim.inventory add column if not exists nft_num int;

create or replace function giftsim._assign_nft_num() returns trigger
language plpgsql set search_path = giftsim, pg_temp as $$
begin
    if new.nft_num is null then
        select 1 + floor(random() * greatest(coalesce(issued, supply, 1), 1))::int into new.nft_num
          from giftsim.gifts where id = new.gift_id and kind = 'nft';
    end if;
    return new;
end;
$$;

drop trigger if exists inventory_nft_num on giftsim.inventory;
create trigger inventory_nft_num before insert on giftsim.inventory
    for each row execute function giftsim._assign_nft_num();

-- уже выданным подаркам — тоже свой номер
update giftsim.inventory i
   set nft_num = 1 + floor(random() * greatest(coalesce(g.issued, g.supply, 1), 1))::int
  from giftsim.gifts g
 where g.id = i.gift_id and g.kind = 'nft' and i.nft_num is null;

-- ссылки на картинку/анимацию конкретного номера
create or replace function giftsim._num_url(p_url text, p_num int) returns text
language sql immutable as $$
    select case when p_url is null or p_num is null then p_url
                else regexp_replace(p_url, '-[0-9]+\.(webp|lottie\.json)$', '-' || p_num || '.\1') end
$$;

create or replace function giftsim._item_json(p_gift text, p_num int) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select giftsim._gift_json(p_gift) || case when p_num is null or g.kind <> 'nft' then '{}'::jsonb
               else jsonb_build_object('num', p_num, 'image_url', giftsim._num_url(g.image_url, p_num),
                                       'animation_url', giftsim._num_url(g.animation_url, p_num)) end
      from giftsim.gifts g where g.id = p_gift
$$;

create or replace function giftsim._inv_json(p_inv bigint) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select giftsim._item_json(i.gift_id, i.nft_num) || jsonb_build_object('inv_id', i.id)
      from giftsim.inventory i where i.id = p_inv
$$;

-- ---------------------------------------------------------------- атрибуты номера (кэш страницы t.me)
create table if not exists giftsim.nft_attrs (
    gift_id         text not null references giftsim.gifts (id) on delete cascade,
    num             int  not null,
    model           text,
    model_rarity    numeric,
    backdrop        text,
    backdrop_rarity numeric,
    symbol          text,
    symbol_rarity   numeric,
    found           boolean not null default true,
    fetched_at      timestamptz not null default now(),
    primary key (gift_id, num)
);
alter table giftsim.nft_attrs enable row level security;

create or replace function giftsim.nft_attrs_get(p_gift text, p_num int) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select jsonb_build_object(
        'gift_id', g.id, 'num', p_num, 'issued', g.issued, 'total_supply', g.total_supply,
        'cached', a.gift_id is not null, 'found', coalesce(a.found, true),
        'model', a.model, 'model_rarity', a.model_rarity,
        'backdrop', a.backdrop, 'backdrop_rarity', a.backdrop_rarity,
        'symbol', a.symbol, 'symbol_rarity', a.symbol_rarity)
      from giftsim.gifts g
      left join giftsim.nft_attrs a on a.gift_id = g.id and a.num = p_num
     where g.id = p_gift and g.kind = 'nft' and p_num between 1 and greatest(coalesce(g.issued, g.supply, 1), 1)
$$;

create or replace function giftsim.nft_attrs_put(p_gift text, p_num int, p jsonb) returns jsonb
language sql set search_path = giftsim, pg_temp as $$
    insert into giftsim.nft_attrs (gift_id, num, model, model_rarity, backdrop, backdrop_rarity, symbol, symbol_rarity, found)
    values (p_gift, p_num, p->>'model', (p->>'model_rarity')::numeric, p->>'backdrop', (p->>'backdrop_rarity')::numeric,
            p->>'symbol', (p->>'symbol_rarity')::numeric, coalesce((p->>'found')::boolean, true))
    on conflict (gift_id, num) do update set model = excluded.model, model_rarity = excluded.model_rarity,
        backdrop = excluded.backdrop, backdrop_rarity = excluded.backdrop_rarity, symbol = excluded.symbol,
        symbol_rarity = excluded.symbol_rarity, found = excluded.found, fetched_at = now();
    select giftsim.nft_attrs_get(p_gift, p_num)
$$;

-- ---------------------------------------------------------------- функции отдают номер экземпляра
-- Точечные правки текущих определений: заменяем фрагмент и проверяем, что замена случилась.
create or replace function giftsim._patch_fn(p_sig text, p_from text, p_to text) returns void
language plpgsql set search_path = giftsim, pg_temp as $$
declare d text;
begin
    d := pg_get_functiondef(p_sig::regprocedure);
    if position(p_to in d) > 0 then return; end if;          -- уже применено
    if position(p_from in d) = 0 then raise exception 'patch_not_applicable: % / %', p_sig, p_from; end if;
    execute replace(d, p_from, p_to);
end;
$$;

-- инвентарь: картинка/анимация своего номера
create or replace function giftsim.get_inventory(p_tg_id bigint) returns jsonb
language sql stable set search_path = giftsim, pg_temp as $$
    select jsonb_build_object(
        'items', coalesce(jsonb_agg(jsonb_build_object(
            'id', i.id, 'gift_id', g.id, 'name', g.name, 'rarity', g.rarity, 'kind', g.kind,
            'value', g.price_stars, 'value_at_drop', i.value_at_drop, 'num', i.nft_num,
            'image_url', giftsim._num_url(g.image_url, i.nft_num), 'animation_url', giftsim._num_url(g.animation_url, i.nft_num),
            'source', i.source, 'obtained_at', i.obtained_at)
            order by g.price_stars desc, i.id desc), '[]'::jsonb),
        'total_value', coalesce(sum(g.price_stars), 0))
      from giftsim.inventory i join giftsim.gifts g on g.id = i.gift_id
     where i.user_id = p_tg_id and i.status = 'owned'
$$;

select giftsim._patch_fn('giftsim.open_case(bigint,text)',
    $p$'gift', giftsim._gift_json(v_gift)$p$, $p$'gift', coalesce(giftsim._inv_json(v_inv), giftsim._gift_json(v_gift))$p$);
select giftsim._patch_fn('giftsim.contract(bigint,bigint[])',
    $p$'gift', giftsim._gift_json(v_gift)$p$, $p$'gift', coalesce(giftsim._inv_json(v_inv), giftsim._gift_json(v_gift))$p$);
select giftsim._patch_fn('giftsim.upgrade(bigint,bigint[],text)',
    $p$'gift', giftsim._gift_json(p_target_gift)$p$, $p$'gift', coalesce(giftsim._inv_json(v_inv), giftsim._gift_json(p_target_gift))$p$);
select giftsim._patch_fn('giftsim.jackpot_state(bigint)',
    $p$jsonb_agg(giftsim._gift_json(i.gift_id)) from giftsim.inventory i$p$, $p$jsonb_agg(giftsim._inv_json(i.id)) from giftsim.inventory i$p$);

-- выигрыши игрока и лента: номер из инвентаря; фоновым выигрышам — случайный номер по слоту
select giftsim._patch_fn('giftsim._user_wins(bigint,integer)',
    $p$select giftsim._gift_json(o.gift_id) || jsonb_build_object('source', 'case'$p$,
    $p$select coalesce(giftsim._inv_json(o.inventory_id), giftsim._gift_json(o.gift_id)) || jsonb_build_object('source', 'case'$p$);
select giftsim._patch_fn('giftsim._user_wins(bigint,integer)',
    $p$select giftsim._gift_json(i.gift_id) || jsonb_build_object('source', i.source$p$,
    $p$select giftsim._inv_json(i.id) || jsonb_build_object('source', i.source$p$);

select giftsim._patch_fn('giftsim.recent_drops(integer)',
    $p$select giftsim._gift_json(o.gift_id) || jsonb_build_object('user'$p$,
    $p$select coalesce(giftsim._inv_json(o.inventory_id), giftsim._gift_json(o.gift_id)) || jsonb_build_object('user'$p$);
select giftsim._patch_fn('giftsim.recent_drops(integer)',
    $p$select giftsim._gift_json(i.gift_id) || jsonb_build_object('user'$p$,
    $p$select giftsim._inv_json(i.id) || jsonb_build_object('user'$p$);
select giftsim._patch_fn('giftsim.recent_drops(integer)',
    $p$select giftsim._gift_json(g.gift_id) || jsonb_build_object('user', n.a$p$,
    $p$select giftsim._item_json(g.gift_id, 1 + floor(giftsim._rnd('m' || s.k) * (select greatest(coalesce(issued, supply, 1), 1) from giftsim.gifts where id = g.gift_id))::int) || jsonb_build_object('user', n.a$p$);

select giftsim._patch_fn('giftsim.player_profile(uuid,bigint)',
    $p$select giftsim._gift_json(i.gift_id) || jsonb_build_object('inv_id', i.id) as j$p$,
    $p$select giftsim._inv_json(i.id) as j$p$);
select giftsim._patch_fn('giftsim.player_profile(uuid,bigint)',
    $p$'best', (select giftsim._gift_json(o.gift_id) from giftsim.case_opens o$p$,
    $p$'best', (select coalesce(giftsim._inv_json(o.inventory_id), giftsim._gift_json(o.gift_id)) from giftsim.case_opens o$p$);

drop function giftsim._patch_fn(text, text, text);

revoke all on all functions in schema giftsim from public, anon, authenticated;
revoke all on all tables in schema giftsim from public, anon, authenticated;

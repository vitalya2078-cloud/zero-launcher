-- FORTUM DROPS: мгновенное уведомление о взрыве в краше.
-- Серверная функция API держит запрос открытым и отвечает ровно в момент взрыва, поэтому клиент
-- больше не «перелетает» точку взрыва, пока ждёт следующего опроса.
-- Сколько ждать, знает только сервер API: эта функция в список методов для клиента не входит.
create or replace function giftsim.crash_game_wait_ms() returns int
language sql stable set search_path = giftsim, pg_temp as $$
    select case when starts_at <= clock_timestamp() and crash_at > clock_timestamp()
                then ceil(extract(epoch from crash_at - clock_timestamp()) * 1000)::int else 0 end
      from giftsim.crash_game order by id desc limit 1
$$;

revoke all on function giftsim.crash_game_wait_ms() from public, anon, authenticated;

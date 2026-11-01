-- FORTUM DROPS: открытие нескольких кейсов за раз (1–5).
-- Всё в одной транзакции: не хватило звёзд или ключей на все — не открывается ни один.
create or replace function giftsim.open_case_multi(p_tg_id bigint, p_case_id text, p_count int) returns jsonb
language plpgsql set search_path = giftsim, pg_temp as $$
declare
    v_mode text;
    v_res  jsonb := '[]'::jsonb;
    v_one  jsonb;
begin
    if p_count is null or p_count < 1 or p_count > 5 then raise exception 'bad_count'; end if;
    select pay_mode into v_mode from giftsim.cases where id = p_case_id and active;
    if v_mode is null then raise exception 'case_not_found'; end if;
    if v_mode = 'free' and p_count > 1 then raise exception 'free_case_single'; end if;
    for i in 1..p_count loop
        v_one := giftsim.open_case(p_tg_id, p_case_id);
        v_res := v_res || jsonb_build_array(v_one - 'balance' - 'referral_keys');
    end loop;
    return jsonb_build_object('results', v_res, 'balance', giftsim._balance(p_tg_id),
        'referral_keys', (select referral_keys from giftsim.users where tg_id = p_tg_id));
end;
$$;

revoke all on function giftsim.open_case_multi(bigint, text, int) from public, anon, authenticated;

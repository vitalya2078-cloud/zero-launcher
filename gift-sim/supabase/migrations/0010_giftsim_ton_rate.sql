-- FORTUM DROPS: интерфейс показывает суммы в TON — профиль отдаёт курс звёзд к TON (Fragment, обновляется с ценами).
do $$
declare d text := pg_get_functiondef('giftsim.get_profile(bigint)'::regprocedure);
begin
    if position('stars_per_ton' in d) = 0 then
        if position($p$'is_admin', giftsim.is_admin(u.tg_id)$p$ in d) = 0 then raise exception 'patch_not_applicable'; end if;
        execute replace(d, $p$'is_admin', giftsim.is_admin(u.tg_id)$p$,
            $p$'is_admin', giftsim.is_admin(u.tg_id), 'stars_per_ton', (giftsim.setting('stars_per_ton'))::numeric$p$);
    end if;
end $$;

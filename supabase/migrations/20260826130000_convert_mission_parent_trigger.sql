begin;

do $block$
begin
    if exists (select 1 from public.docs) then
        perform private.require_docs_reference_id(
            'ko.word-chain.mission',
            'migration:convert_mission_parent_trigger'
        );
        perform private.require_docs_reference_id(
            'ko.reverse-word-chain.mission',
            'migration:convert_mission_parent_trigger'
        );
        perform private.require_docs_reference_id(
            'ko.kkungkkungtta.mission',
            'migration:convert_mission_parent_trigger'
        );
    end if;
end;
$block$;

create or replace function public.sync_parent_last_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
    mission_keys text[] := array[
        'ga', 'na', 'da', 'ra', 'ma', 'ba', 'sa',
        'a', 'ja', 'cha', 'ka', 'ta', 'pa', 'ha'
    ];
    parent_code text;
    parent_id bigint;
begin
    if new.last_update is distinct from old.last_update then
        if new.reference_code like 'ko.word-chain.mission.%'
           and pg_catalog.substr(
               new.reference_code,
               pg_catalog.length('ko.word-chain.mission.') + 1
           ) = any(mission_keys) then
            parent_code := 'ko.word-chain.mission';
        elsif new.reference_code like 'ko.reverse-word-chain.mission.%'
           and pg_catalog.substr(
               new.reference_code,
               pg_catalog.length('ko.reverse-word-chain.mission.') + 1
           ) = any(mission_keys) then
            parent_code := 'ko.reverse-word-chain.mission';
        elsif new.reference_code like 'ko.kkungkkungtta.mission.%'
           and pg_catalog.substr(
               new.reference_code,
               pg_catalog.length('ko.kkungkkungtta.mission.') + 1
           ) = any(mission_keys) then
            parent_code := 'ko.kkungkkungtta.mission';
        end if;

        if parent_code is not null then
            parent_id := private.require_docs_reference_id(
                parent_code,
                'public.sync_parent_last_update:UPDATE'
            );

            update public.docs
               set last_update = pg_catalog.now()
             where id = parent_id;
        end if;
    end if;

    return new;
end;
$function$;

revoke all on function public.sync_parent_last_update()
    from public, anon, authenticated, service_role;

commit;

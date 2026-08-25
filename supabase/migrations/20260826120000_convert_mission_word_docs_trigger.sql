begin;

do $block$
declare
    mission_keys text[] := ARRAY[
        'ga', 'na', 'da', 'ra', 'ma', 'ba', 'sa',
        'a', 'ja', 'cha', 'ka', 'ta', 'pa', 'ha'
    ];
    key_index integer;
begin
    if exists (select 1 from public.docs) then
        for key_index in 1..14 loop
            perform private.require_docs_reference_id(
                'ko.word-chain.mission.' || mission_keys[key_index],
                'migration:convert_mission_word_docs_trigger'
            );
            perform private.require_docs_reference_id(
                'ko.reverse-word-chain.mission.' || mission_keys[key_index],
                'migration:convert_mission_word_docs_trigger'
            );
            perform private.require_docs_reference_id(
                'ko.kkungkkungtta.mission.' || mission_keys[key_index],
                'migration:convert_mission_word_docs_trigger'
            );
        end loop;
    end if;
end;
$block$;

create or replace function public.fn_process_word_docs_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
    mission_characters text[] := ARRAY['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];
    mission_keys text[] := ARRAY['ga', 'na', 'da', 'ra', 'ma', 'ba', 'sa', 'a', 'ja', 'cha', 'ka', 'ta', 'pa', 'ha'];
    target_ids bigint[] := ARRAY[]::bigint[];
    target_word text;
    target_user uuid;
    target_log_type public.request_type_enum;
    key_index integer;
    word_length integer;
begin
    if tg_op = 'INSERT' then
        target_word := new.word;
        target_user := new.added_by;
        word_length := new.length;
        target_log_type := 'add'::public.request_type_enum;
    elsif tg_op = 'DELETE' then
        target_word := old.word;
        target_user := old.added_by;
        word_length := old.length;
        target_log_type := 'delete'::public.request_type_enum;
    end if;

    for key_index in 1..14 loop
        if pg_catalog.strpos(target_word, mission_characters[key_index]) > 0 then
            target_ids := pg_catalog.array_append(
                target_ids,
                private.require_docs_reference_id(
                    'ko.word-chain.mission.' || mission_keys[key_index],
                    'public.fn_process_word_docs_update:' || tg_op
                )
            );
            target_ids := pg_catalog.array_append(
                target_ids,
                private.require_docs_reference_id(
                    'ko.reverse-word-chain.mission.' || mission_keys[key_index],
                    'public.fn_process_word_docs_update:' || tg_op
                )
            );

            if word_length = 3 then
                target_ids := pg_catalog.array_append(
                    target_ids,
                    private.require_docs_reference_id(
                        'ko.kkungkkungtta.mission.' || mission_keys[key_index],
                        'public.fn_process_word_docs_update:' || tg_op
                    )
                );
            end if;
        end if;
    end loop;

    update public.docs
       set last_update = (now() at time zone 'utc'::text)
     where id = any(target_ids);

    insert into public.docs_logs (docs_id, word, add_by, type, date)
    select target_id, target_word, target_user, target_log_type,
           (now() at time zone 'utc'::text)
      from pg_catalog.unnest(target_ids) with ordinality
        as target(target_id, position)
     order by target.position;

    return null;
end;
$function$;

revoke all on function public.fn_process_word_docs_update()
    from public, anon, authenticated, service_role;

commit;

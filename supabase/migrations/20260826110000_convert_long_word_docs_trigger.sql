begin;

do $block$
begin
    if exists (select 1 from public.docs) then
        perform private.require_docs_reference_id(
            'ko.word-chain.long',
            'public.words_docs_logs_trg:preflight'
        );
        perform private.require_docs_reference_id(
            'ko.reverse-word-chain.long',
            'public.words_docs_logs_trg:preflight'
        );
    end if;
end;
$block$;

create or replace function public.words_docs_logs_trg()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
    target_docs_ids bigint[];
    target_word text;
    target_user uuid;
    target_log_type public.request_type_enum;
    old_valid boolean;
    new_valid boolean;
begin
    if tg_op = 'INSERT' then
        if new.k_canuse = true and new.length >= 9 then
            target_word := new.word;
            target_user := new.added_by;
            target_log_type := 'add'::public.request_type_enum;
            target_docs_ids := array[
                private.require_docs_reference_id(
                    'ko.word-chain.long',
                    'public.words_docs_logs_trg:' || tg_op
                ),
                private.require_docs_reference_id(
                    'ko.reverse-word-chain.long',
                    'public.words_docs_logs_trg:' || tg_op
                )
            ];

            insert into public.docs_logs (docs_id, word, add_by, type)
            select target_id, target_word, target_user, target_log_type
            from pg_catalog.unnest(target_docs_ids) with ordinality
                as target(target_id, position)
            order by target.position;
        end if;
        return new;
    end if;

    if tg_op = 'DELETE' then
        if old.k_canuse = true and old.length >= 9 then
            target_word := old.word;
            target_user := old.added_by;
            target_log_type := 'delete'::public.request_type_enum;
            target_docs_ids := array[
                private.require_docs_reference_id(
                    'ko.word-chain.long',
                    'public.words_docs_logs_trg:' || tg_op
                ),
                private.require_docs_reference_id(
                    'ko.reverse-word-chain.long',
                    'public.words_docs_logs_trg:' || tg_op
                )
            ];

            insert into public.docs_logs (docs_id, word, add_by, type)
            select target_id, target_word, target_user, target_log_type
            from pg_catalog.unnest(target_docs_ids) with ordinality
                as target(target_id, position)
            order by target.position;
        end if;
        return old;
    end if;

    if tg_op = 'UPDATE' then
        old_valid := old.k_canuse = true and old.length >= 9;
        new_valid := new.k_canuse = true and new.length >= 9;

        if old_valid = new_valid then
            return new;
        end if;

        target_word := new.word;
        target_user := new.added_by;
        target_log_type := case
            when new_valid then 'add'::public.request_type_enum
            else 'delete'::public.request_type_enum
        end;
        target_docs_ids := array[
            private.require_docs_reference_id(
                'ko.word-chain.long',
                'public.words_docs_logs_trg:' || tg_op
            ),
            private.require_docs_reference_id(
                'ko.reverse-word-chain.long',
                'public.words_docs_logs_trg:' || tg_op
            )
        ];

        insert into public.docs_logs (docs_id, word, add_by, type)
        select target_id, target_word, target_user, target_log_type
        from pg_catalog.unnest(target_docs_ids) with ordinality
            as target(target_id, position)
        order by target.position;

        return new;
    end if;

    return null;
end;
$function$;

revoke all on function public.words_docs_logs_trg()
    from public, anon, authenticated, service_role;

commit;

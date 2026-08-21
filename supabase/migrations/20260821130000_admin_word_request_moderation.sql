begin;

create schema if not exists private;

create or replace function private.assert_word_request_moderation_admin()
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
    actor uuid := auth.uid();
begin
    if actor is null then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_MODERATION_UNAUTHORIZED';
    end if;

    if not exists (
        select 1
        from public.users as app_user
        where app_user.id = actor
          and app_user.role = 'admin'
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_MODERATION_FORBIDDEN';
    end if;

    return actor;
end;
$function$;

create or replace function private.is_word_request_moderation_safe_integer(
    p_value jsonb
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $function$
    select case
        when pg_catalog.jsonb_typeof(p_value) = 'number'
         and p_value::text ~ '^[0-9]+$'
        then (p_value::text)::numeric between 1 and 9007199254740991
        else false
    end;
$function$;

create or replace function private.process_word_request_moderation(
    p_selections jsonb,
    p_actor uuid,
    p_is_approval boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $function$
declare
    selection jsonb;
    change jsonb;
    request_ids bigint[] := array[]::bigint[];
    theme_word_ids bigint[] := array[]::bigint[];
    all_theme_ids bigint[] := array[]::bigint[];
    selected_theme_ids bigint[];
    request_id bigint;
    moderation_word_id bigint;
    moderation_theme_id bigint;
    selection_count integer;
    processed_word_request_count integer := 0;
    processed_theme_change_count integer := 0;
    affected_docs_ids bigint[] := array[]::bigint[];
    direct_docs_ids bigint[];
    direct_docs_id bigint;
    noin_theme_codes constant text[] := array[
        '0', '10', '20', '30', '40', '50', '60', '70', '80', '90',
        '100', '110', '120', '130', '140', '150', '160', '170',
        '180', '190', '200', '210', '220', '230', '240', '250',
        '260', '270', '280', '290', '300', '310', '320', '330',
        '340', '350', '360', '370', '380', '390', '400', '410',
        '420', '430', '440', '450', '460', '470', '480', '490',
        '500', '510', '520', '530'
    ]::text[];
    special_docs_ids constant bigint[] := array[
        201, 202,
        209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219,
        220, 221, 222, 223, 224, 225, 226, 227, 228, 229,
        230, 231, 232, 233, 234, 235, 236, 237, 238, 239,
        240, 241, 242, 243, 244, 245, 246, 247, 248, 249,
        250, 251, 252
    ]::bigint[];
    wait_row public.wait_words%rowtype;
    word_row public.words%rowtype;
    wait_theme_row public.word_themes_wait%rowtype;
    theme_row record;
    is_noin_canuse boolean;
    contributor uuid;
begin
    if p_selections is null
       or pg_catalog.jsonb_typeof(p_selections) <> 'array' then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_MODERATION_INVALID_INPUT';
    end if;

    selection_count := pg_catalog.jsonb_array_length(p_selections);
    if selection_count < 1 or selection_count > 30 then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_MODERATION_INVALID_INPUT';
    end if;

    for selection in
        select item.value
        from pg_catalog.jsonb_array_elements(p_selections) as item(value)
    loop
        if pg_catalog.jsonb_typeof(selection) <> 'object'
           or not (selection ? 'kind')
           or pg_catalog.jsonb_typeof(selection -> 'kind') <> 'string' then
            raise exception using
                errcode = 'P0001',
                message = 'WORD_REQUEST_MODERATION_INVALID_INPUT';
        end if;

        if selection ->> 'kind' = 'word-request' then
            if not (selection ? 'requestId')
               or not (selection ? 'selectedThemeIds')
               or selection - 'kind' - 'requestId' - 'selectedThemeIds'
                    <> '{}'::jsonb
               or not private.is_word_request_moderation_safe_integer(
                    selection -> 'requestId'
               )
               or pg_catalog.jsonb_typeof(
                    selection -> 'selectedThemeIds'
               ) <> 'array' then
                raise exception using
                    errcode = 'P0001',
                    message = 'WORD_REQUEST_MODERATION_INVALID_INPUT';
            end if;

            request_id := (selection ->> 'requestId')::bigint;
            if request_id = any(request_ids) then
                raise exception using
                    errcode = 'P0001',
                    message = 'WORD_REQUEST_MODERATION_INVALID_INPUT';
            end if;
            request_ids := pg_catalog.array_append(request_ids, request_id);

            if exists (
                select 1
                from pg_catalog.jsonb_array_elements(
                    selection -> 'selectedThemeIds'
                ) as selected(value)
                where not private.is_word_request_moderation_safe_integer(
                    selected.value
                )
            ) or exists (
                select 1
                from pg_catalog.jsonb_array_elements(
                    selection -> 'selectedThemeIds'
                ) as selected(value)
                group by selected.value
                having pg_catalog.count(*) > 1
            ) then
                raise exception using
                    errcode = 'P0001',
                    message = 'WORD_REQUEST_MODERATION_INVALID_INPUT';
            end if;

            select coalesce(
                pg_catalog.array_agg((selected.value #>> '{}')::bigint),
                array[]::bigint[]
            )
            into selected_theme_ids
            from pg_catalog.jsonb_array_elements(
                selection -> 'selectedThemeIds'
            ) as selected(value);
            all_theme_ids := all_theme_ids || selected_theme_ids;
            continue;
        end if;

        if selection ->> 'kind' <> 'theme-change'
           or not (selection ? 'wordId')
           or not (selection ? 'changes')
           or selection - 'kind' - 'wordId' - 'changes' <> '{}'::jsonb
           or not private.is_word_request_moderation_safe_integer(
                selection -> 'wordId'
           )
           or pg_catalog.jsonb_typeof(selection -> 'changes') <> 'array'
           or pg_catalog.jsonb_array_length(selection -> 'changes') = 0 then
            raise exception using
                errcode = 'P0001',
                message = 'WORD_REQUEST_MODERATION_INVALID_INPUT';
        end if;

        moderation_word_id := (selection ->> 'wordId')::bigint;
        if moderation_word_id = any(theme_word_ids) then
            raise exception using
                errcode = 'P0001',
                message = 'WORD_REQUEST_MODERATION_INVALID_INPUT';
        end if;
        theme_word_ids := pg_catalog.array_append(
            theme_word_ids, moderation_word_id
        );

        if exists (
            select 1
            from pg_catalog.jsonb_array_elements(
                selection -> 'changes'
            ) as requested_change(value)
            where pg_catalog.jsonb_typeof(requested_change.value) <> 'object'
               or not (requested_change.value ? 'themeId')
               or not (requested_change.value ? 'type')
               or requested_change.value - 'themeId' - 'type' <> '{}'::jsonb
               or not private.is_word_request_moderation_safe_integer(
                    requested_change.value -> 'themeId'
               )
               or pg_catalog.jsonb_typeof(
                    requested_change.value -> 'type'
               ) <> 'string'
               or requested_change.value ->> 'type' not in ('add', 'delete')
        ) or exists (
            select 1
            from pg_catalog.jsonb_array_elements(
                selection -> 'changes'
            ) as requested_change(value)
            group by requested_change.value -> 'themeId'
            having pg_catalog.count(*) > 1
        ) then
            raise exception using
                errcode = 'P0001',
                message = 'WORD_REQUEST_MODERATION_INVALID_INPUT';
        end if;

        for change in
            select requested_change.value
            from pg_catalog.jsonb_array_elements(
                selection -> 'changes'
            ) as requested_change(value)
        loop
            all_theme_ids := pg_catalog.array_append(
                all_theme_ids,
                (change ->> 'themeId')::bigint
            );
        end loop;
    end loop;

    -- All row locks follow the repository-wide order before any mutation.
    perform target_word.id
    from public.words as target_word
    where target_word.id = any(theme_word_ids)
       or target_word.id in (
            select wait_word.word_id
            from public.wait_words as wait_word
            where wait_word.id = any(request_ids)
              and wait_word.word_id is not null
       )
    order by target_word.id
    for update;

    perform wait_word.id
    from public.wait_words as wait_word
    where wait_word.id = any(request_ids)
    order by wait_word.id
    for update;

    perform wait_theme.word_id
    from public.word_themes_wait as wait_theme
    where wait_theme.word_id = any(theme_word_ids)
       or wait_theme.word_id in (
            select wait_word.word_id
            from public.wait_words as wait_word
            where wait_word.id = any(request_ids)
              and wait_word.word_id is not null
       )
    order by wait_theme.word_id, wait_theme.theme_id, wait_theme.typez
    for update of wait_theme;

    perform word_theme.word_id
    from public.word_themes as word_theme
    where word_theme.word_id = any(theme_word_ids)
       or word_theme.word_id in (
            select wait_word.word_id
            from public.wait_words as wait_word
            where wait_word.id = any(request_ids)
              and wait_word.word_id is not null
       )
    order by word_theme.word_id, word_theme.theme_id
    for update of word_theme;

    perform theme.id
    from public.themes as theme
    where theme.id = any(all_theme_ids)
       or theme.id in (
            select word_theme.theme_id
            from public.word_themes as word_theme
            where word_theme.word_id = any(theme_word_ids)
               or word_theme.word_id in (
                    select wait_word.word_id
                    from public.wait_words as wait_word
                    where wait_word.id = any(request_ids)
                      and wait_word.word_id is not null
               )
       )
    order by theme.id
    for update;

    perform wait_theme.wait_word_id
    from public.wait_word_themes as wait_theme
    where wait_theme.wait_word_id = any(request_ids)
    order by wait_theme.wait_word_id, wait_theme.theme_id
    for update;

    perform document.id
    from public.docs as document
    where document.id = any(special_docs_ids)
       or (
            document.typez = 'letter'
            and pg_catalog.btrim(document.name) in (
                select pg_catalog.right(wait_word.word, 1)
                from public.wait_words as wait_word
                where wait_word.id = any(request_ids)
            )
       )
       or (
            document.typez = 'theme'
            and document.name in (
                select theme.name
                from public.themes as theme
                where theme.id = any(all_theme_ids)
                   or theme.id in (
                        select word_theme.theme_id
                        from public.word_themes as word_theme
                        where word_theme.word_id = any(theme_word_ids)
                           or word_theme.word_id in (
                                select wait_word.word_id
                                from public.wait_words as wait_word
                                where wait_word.id = any(request_ids)
                                  and wait_word.word_id is not null
                           )
                   )
            )
       )
    order by document.id
    for update;

    perform app_user.id
    from public.users as app_user
    where app_user.id = p_actor
       or app_user.id in (
            select wait_word.requested_by
            from public.wait_words as wait_word
            where wait_word.id = any(request_ids)
              and wait_word.requested_by is not null
       )
       or app_user.id in (
            select wait_theme.req_by
            from public.word_themes_wait as wait_theme
            where wait_theme.word_id = any(theme_word_ids)
              and wait_theme.req_by is not null
       )
    order by app_user.id
    for update;

    -- Revalidate every selected queue row after the complete lock set is held.
    for selection in
        select item.value
        from pg_catalog.jsonb_array_elements(p_selections) as item(value)
        order by
            case when item.value ->> 'kind' = 'word-request' then 0 else 1 end,
            case when item.value ->> 'kind' = 'word-request'
                 then (item.value ->> 'requestId')::bigint
                 else (item.value ->> 'wordId')::bigint
            end
    loop
        if selection ->> 'kind' = 'word-request' then
            request_id := (selection ->> 'requestId')::bigint;
            select * into wait_row
            from public.wait_words as wait_word
            where wait_word.id = request_id
              and wait_word.status = 'pending';
            if not found then
                raise exception using
                    errcode = 'P0001',
                    message = 'WORD_REQUEST_MODERATION_CONFLICT';
            end if;

            select coalesce(
                pg_catalog.array_agg((selected.value #>> '{}')::bigint),
                array[]::bigint[]
            )
            into selected_theme_ids
            from pg_catalog.jsonb_array_elements(
                selection -> 'selectedThemeIds'
            ) as selected(value);

            if wait_row.request_type = 'add' then
                if pg_catalog.cardinality(selected_theme_ids) = 0
                   or wait_row.word_id is not null
                   or exists (
                        select 1 from public.words as existing_word
                        where existing_word.word = wait_row.word
                   ) then
                    raise exception using
                        errcode = 'P0001',
                        message = 'WORD_REQUEST_MODERATION_CONFLICT';
                end if;
            elsif wait_row.request_type = 'delete' then
                if pg_catalog.cardinality(selected_theme_ids) <> 0
                   or wait_row.word_id is null
                   or not exists (
                        select 1 from public.words as existing_word
                        where existing_word.id = wait_row.word_id
                          and existing_word.word = wait_row.word
                   ) then
                    raise exception using
                        errcode = 'P0001',
                        message = 'WORD_REQUEST_MODERATION_CONFLICT';
                end if;
            else
                raise exception using
                    errcode = 'P0001',
                    message = 'WORD_REQUEST_MODERATION_CONFLICT';
            end if;

            if exists (
                select selected_theme.id
                from pg_catalog.unnest(selected_theme_ids)
                    as selected_theme(id)
                where not exists (
                    select 1
                    from public.wait_word_themes as wait_theme
                    where wait_theme.wait_word_id = request_id
                      and wait_theme.theme_id = selected_theme.id
                )
                   or not exists (
                    select 1 from public.themes as theme
                    where theme.id = selected_theme.id
                )
            ) then
                raise exception using
                    errcode = 'P0001',
                    message = 'WORD_REQUEST_MODERATION_CONFLICT';
            end if;
            continue;
        end if;

        moderation_word_id := (selection ->> 'wordId')::bigint;
        if not exists (
            select 1 from public.words as existing_word
            where existing_word.id = moderation_word_id
        ) then
            raise exception using
                errcode = 'P0001',
                message = 'WORD_REQUEST_MODERATION_CONFLICT';
        end if;

        for change in
            select requested_change.value
            from pg_catalog.jsonb_array_elements(
                selection -> 'changes'
            ) as requested_change(value)
            order by (requested_change.value ->> 'themeId')::bigint,
                     requested_change.value ->> 'type'
        loop
            moderation_theme_id := (change ->> 'themeId')::bigint;
            if not exists (
                select 1
                from public.word_themes_wait as wait_theme
                where wait_theme.word_id = moderation_word_id
                  and wait_theme.theme_id = moderation_theme_id
                  and wait_theme.typez::text = change ->> 'type'
            ) or not exists (
                select 1 from public.themes as theme
                where theme.id = moderation_theme_id
            ) or (
                change ->> 'type' = 'add'
                and exists (
                    select 1 from public.word_themes as word_theme
                    where word_theme.word_id = moderation_word_id
                      and word_theme.theme_id = moderation_theme_id
                )
            ) or (
                change ->> 'type' = 'delete'
                and not exists (
                    select 1 from public.word_themes as word_theme
                    where word_theme.word_id = moderation_word_id
                      and word_theme.theme_id = moderation_theme_id
                )
            ) then
                raise exception using
                    errcode = 'P0001',
                    message = 'WORD_REQUEST_MODERATION_CONFLICT';
            end if;
        end loop;
    end loop;

    if exists (
        select 1
        from public.wait_words as wait_word
        where wait_word.id = any(request_ids)
          and wait_word.request_type = 'delete'
          and wait_word.word_id = any(theme_word_ids)
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_MODERATION_CONFLICT';
    end if;

    for selection in
        select item.value
        from pg_catalog.jsonb_array_elements(p_selections) as item(value)
        order by
            case when item.value ->> 'kind' = 'word-request' then 0 else 1 end,
            case when item.value ->> 'kind' = 'word-request'
                 then (item.value ->> 'requestId')::bigint
                 else (item.value ->> 'wordId')::bigint
            end
    loop
        if selection ->> 'kind' = 'word-request' then
            request_id := (selection ->> 'requestId')::bigint;
            select * into wait_row
            from public.wait_words as wait_word
            where wait_word.id = request_id;
            contributor := coalesce(wait_row.requested_by, p_actor);

            if not p_is_approval then
                insert into public.logs (
                    word, processed_by, make_by, r_type, state
                ) values (
                    wait_row.word, p_actor, wait_row.requested_by,
                    wait_row.request_type, 'rejected'
                );
                delete from public.wait_words as wait_word
                where wait_word.id = request_id;
                processed_word_request_count :=
                    processed_word_request_count + 1;
                continue;
            end if;

            if wait_row.request_type = 'add' then
                select coalesce(
                    pg_catalog.array_agg((selected.value #>> '{}')::bigint),
                    array[]::bigint[]
                )
                into selected_theme_ids
                from pg_catalog.jsonb_array_elements(
                    selection -> 'selectedThemeIds'
                ) as selected(value);

                select exists (
                    select 1
                    from public.themes as theme
                    where theme.id = any(selected_theme_ids)
                      and theme.code = any(noin_theme_codes)
                ) into is_noin_canuse;

                insert into public.words (
                    word, k_canuse, noin_canuse, added_by
                ) values (
                    wait_row.word, true, is_noin_canuse, contributor
                ) returning * into word_row;

                insert into public.logs (
                    word, processed_by, make_by, r_type, state
                ) values (
                    wait_row.word, p_actor, wait_row.requested_by,
                    'add', 'approved'
                );

                insert into public.word_themes (word_id, theme_id)
                select word_row.id, selected_theme.id
                from pg_catalog.unnest(selected_theme_ids)
                    as selected_theme(id)
                order by selected_theme.id;

                direct_docs_ids := array[]::bigint[];
                select coalesce(
                    pg_catalog.array_agg(document.id order by document.id),
                    array[]::bigint[]
                ) into direct_docs_ids
                from public.docs as document
                where (
                    document.typez = 'letter'
                    and pg_catalog.btrim(document.name) =
                        pg_catalog.right(wait_row.word, 1)
                ) or (
                    document.typez = 'theme'
                    and document.name in (
                        select theme.name
                        from public.themes as theme
                        where theme.id = any(selected_theme_ids)
                    )
                );

                insert into public.docs_logs (docs_id, word, add_by, type)
                select document.id, wait_row.word, contributor, 'add'
                from public.docs as document
                where document.id = any(direct_docs_ids)
                order by document.id;
                affected_docs_ids := affected_docs_ids || direct_docs_ids;

                delete from public.wait_words as wait_word
                where wait_word.id = request_id;
            else
                select * into word_row
                from public.words as existing_word
                where existing_word.id = wait_row.word_id;

                insert into public.logs (
                    word, processed_by, make_by, r_type, state
                ) values (
                    word_row.word, p_actor, wait_row.requested_by,
                    'delete', 'approved'
                );

                direct_docs_ids := array[]::bigint[];
                select coalesce(
                    pg_catalog.array_agg(document.id order by document.id),
                    array[]::bigint[]
                ) into direct_docs_ids
                from public.docs as document
                where (
                    document.typez = 'letter'
                    and pg_catalog.btrim(document.name) =
                        pg_catalog.right(word_row.word, 1)
                ) or (
                    document.typez = 'theme'
                    and document.name in (
                        select theme.name
                        from public.word_themes as word_theme
                        join public.themes as theme
                          on theme.id = word_theme.theme_id
                        where word_theme.word_id = word_row.id
                    )
                );

                insert into public.docs_logs (docs_id, word, add_by, type)
                select document.id, word_row.word, contributor, 'delete'
                from public.docs as document
                where document.id = any(direct_docs_ids)
                order by document.id;
                affected_docs_ids := affected_docs_ids || direct_docs_ids;

                delete from public.wait_words as wait_word
                where wait_word.id = request_id;
                delete from public.words as existing_word
                where existing_word.id = word_row.id;
            end if;

            perform public.increment_contribution(
                target_id => contributor,
                inc_amount => 1
            );
            processed_word_request_count :=
                processed_word_request_count + 1;
            continue;
        end if;

        moderation_word_id := (selection ->> 'wordId')::bigint;
        for change in
            select requested_change.value
            from pg_catalog.jsonb_array_elements(
                selection -> 'changes'
            ) as requested_change(value)
            order by (requested_change.value ->> 'themeId')::bigint,
                     requested_change.value ->> 'type'
        loop
            moderation_theme_id := (change ->> 'themeId')::bigint;
            select * into wait_theme_row
            from public.word_themes_wait as wait_theme
            where wait_theme.word_id = moderation_word_id
              and wait_theme.theme_id = moderation_theme_id
              and wait_theme.typez::text = change ->> 'type';

            if not p_is_approval then
                delete from public.word_themes_wait as wait_theme
                where wait_theme.word_id = moderation_word_id
                  and wait_theme.theme_id = moderation_theme_id
                  and wait_theme.typez::text = change ->> 'type';
                processed_theme_change_count :=
                    processed_theme_change_count + 1;
                continue;
            end if;

            contributor := coalesce(wait_theme_row.req_by, p_actor);
            if change ->> 'type' = 'add' then
                insert into public.word_themes (word_id, theme_id)
                values (moderation_word_id, moderation_theme_id);
            end if;

            direct_docs_id := null;
            insert into public.docs_logs (docs_id, word, add_by, type)
            select document.id, existing_word.word, contributor,
                   (change ->> 'type')::public.request_type_enum
            from public.docs as document
            cross join public.words as existing_word
            join public.themes as theme
              on theme.id = moderation_theme_id
            where existing_word.id = moderation_word_id
              and document.typez = 'theme'
              and document.name = theme.name
            returning docs_id into direct_docs_id;
            if direct_docs_id is not null then
                affected_docs_ids := pg_catalog.array_append(
                    affected_docs_ids, direct_docs_id
                );
            end if;

            if change ->> 'type' = 'delete' then
                delete from public.word_themes as word_theme
                where word_theme.word_id = moderation_word_id
                  and word_theme.theme_id = moderation_theme_id;
            end if;
            delete from public.word_themes_wait as wait_theme
            where wait_theme.word_id = moderation_word_id
              and wait_theme.theme_id = moderation_theme_id
              and wait_theme.typez::text = change ->> 'type';

            update public.words as existing_word
            set noin_canuse = exists (
                select 1
                from public.word_themes as word_theme
                join public.themes as theme
                  on theme.id = word_theme.theme_id
                where word_theme.word_id = moderation_word_id
                  and theme.code = any(noin_theme_codes)
            )
            where existing_word.id = moderation_word_id;

            perform public.increment_contribution(
                target_id => contributor,
                inc_amount => 1
            );
            processed_theme_change_count :=
                processed_theme_change_count + 1;
        end loop;
    end loop;

    select coalesce(
        pg_catalog.array_agg(distinct affected.id order by affected.id),
        array[]::bigint[]
    )
    into affected_docs_ids
    from pg_catalog.unnest(affected_docs_ids) as affected(id);

    if p_is_approval and pg_catalog.cardinality(affected_docs_ids) > 0 then
        perform public.update_last_updates(docs_ids => affected_docs_ids);
    end if;

    return pg_catalog.jsonb_build_object(
        'processedWordRequestCount', processed_word_request_count,
        'processedThemeChangeCount', processed_theme_change_count,
        'affectedDocsIds', pg_catalog.to_jsonb(affected_docs_ids)
    );
end;
$function$;

create or replace function public.approve_word_requests(p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
    actor uuid;
begin
    actor := private.assert_word_request_moderation_admin();
    return private.process_word_request_moderation(
        p_selections, actor, true
    );
exception
    when raise_exception then
        if sqlerrm in (
            'WORD_REQUEST_MODERATION_UNAUTHORIZED',
            'WORD_REQUEST_MODERATION_FORBIDDEN',
            'WORD_REQUEST_MODERATION_INVALID_INPUT',
            'WORD_REQUEST_MODERATION_CONFLICT',
            'WORD_REQUEST_MODERATION_INTERNAL_ERROR'
        ) then
            raise;
        end if;
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_MODERATION_INTERNAL_ERROR';
    when others then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_MODERATION_INTERNAL_ERROR';
end;
$function$;

create or replace function public.reject_word_requests(p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
    actor uuid;
begin
    actor := private.assert_word_request_moderation_admin();
    return private.process_word_request_moderation(
        p_selections, actor, false
    );
exception
    when raise_exception then
        if sqlerrm in (
            'WORD_REQUEST_MODERATION_UNAUTHORIZED',
            'WORD_REQUEST_MODERATION_FORBIDDEN',
            'WORD_REQUEST_MODERATION_INVALID_INPUT',
            'WORD_REQUEST_MODERATION_CONFLICT',
            'WORD_REQUEST_MODERATION_INTERNAL_ERROR'
        ) then
            raise;
        end if;
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_MODERATION_INTERNAL_ERROR';
    when others then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_MODERATION_INTERNAL_ERROR';
end;
$function$;

revoke all on function private.assert_word_request_moderation_admin()
    from public, anon, authenticated, service_role;
revoke all on function private.is_word_request_moderation_safe_integer(jsonb)
    from public, anon, authenticated, service_role;
revoke all on function private.process_word_request_moderation(jsonb,uuid,boolean)
    from public, anon, authenticated, service_role;
revoke all on function public.approve_word_requests(jsonb) from public, anon;
revoke all on function public.reject_word_requests(jsonb) from public, anon;
grant execute on function public.approve_word_requests(jsonb)
    to authenticated, service_role;
grant execute on function public.reject_word_requests(jsonb)
    to authenticated, service_role;

commit;

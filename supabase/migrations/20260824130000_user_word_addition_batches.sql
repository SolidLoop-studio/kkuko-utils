begin;

create or replace function public.request_word_additions(p_entries jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    actor uuid := auth.uid();
    entry_count integer;
    created_word_request_count integer := 0;
    updated_word_request_count integer := 0;
    changed_registered_word_count integer := 0;
    created_theme_change_request_count integer := 0;
    unchanged_word_count integer := 0;
    inserted_count integer;
    registered_word_id bigint;
    pending_request_id bigint;
    requested_entry record;
begin
    if actor is null then
        raise exception using errcode = 'P0001', message = 'WORD_ADDITION_BATCH_UNAUTHORIZED';
    end if;
    if p_entries is null or pg_catalog.jsonb_typeof(p_entries) is distinct from 'array' then
        raise exception using errcode = 'P0001', message = 'WORD_ADDITION_BATCH_INVALID_INPUT';
    end if;

    entry_count := pg_catalog.jsonb_array_length(p_entries);
    if entry_count < 1 or entry_count > 300 then
        raise exception using errcode = 'P0001', message = 'WORD_ADDITION_BATCH_INVALID_INPUT';
    end if;
    if exists (
        select 1 from pg_catalog.jsonb_array_elements(p_entries) as requested(entry)
        where pg_catalog.jsonb_typeof(requested.entry) is distinct from 'object'
    ) then
        raise exception using errcode = 'P0001', message = 'WORD_ADDITION_BATCH_INVALID_INPUT';
    end if;
    if exists (
        select 1 from pg_catalog.jsonb_array_elements(p_entries) as requested(entry)
        where not requested.entry ? 'word'
           or not requested.entry ? 'themeCodes'
           or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(requested.entry)) <> 2
           or pg_catalog.jsonb_typeof(requested.entry -> 'word') is distinct from 'string'
           or pg_catalog.jsonb_typeof(requested.entry -> 'themeCodes') is distinct from 'array'
    ) then
        raise exception using errcode = 'P0001', message = 'WORD_ADDITION_BATCH_INVALID_INPUT';
    end if;
    if exists (
        select 1 from pg_catalog.jsonb_array_elements(p_entries) as requested(entry)
        where pg_catalog.btrim(requested.entry ->> 'word') = ''
           or pg_catalog.jsonb_array_length(requested.entry -> 'themeCodes') > 100
    ) then
        raise exception using errcode = 'P0001', message = 'WORD_ADDITION_BATCH_INVALID_INPUT';
    end if;
    if exists (
        select 1
        from pg_catalog.jsonb_array_elements(p_entries) as requested(entry)
        cross join lateral pg_catalog.jsonb_array_elements(requested.entry -> 'themeCodes') as theme(code)
        where pg_catalog.jsonb_typeof(theme.code) is distinct from 'string'
           or theme.code #>> '{}' = ''
           or theme.code #>> '{}' ~ '(^[[:space:]])|([[:space:]]$)'
    ) then
        raise exception using errcode = 'P0001', message = 'WORD_ADDITION_BATCH_INVALID_INPUT';
    end if;
    if exists (
        select 1
        from pg_catalog.jsonb_array_elements(p_entries) with ordinality as requested(entry, entry_index)
        cross join lateral pg_catalog.jsonb_array_elements_text(requested.entry -> 'themeCodes') as theme(code)
        group by requested.entry_index, theme.code
        having pg_catalog.count(*) > 1
    ) or exists (
        select 1
        from pg_catalog.jsonb_array_elements(p_entries) as requested(entry)
        group by pg_catalog.btrim(requested.entry ->> 'word')
        having pg_catalog.count(*) > 1
    ) then
        raise exception using errcode = 'P0001', message = 'WORD_ADDITION_BATCH_INVALID_INPUT';
    end if;

    perform theme.id
    from public.themes as theme
    where theme.code in (
        select requested_theme.code
        from pg_catalog.jsonb_array_elements(p_entries) as requested(entry)
        cross join lateral pg_catalog.jsonb_array_elements_text(requested.entry -> 'themeCodes') as requested_theme(code)
    )
    order by theme.id
    for update;
    if exists (
        select 1
        from (
            select distinct requested_theme.code
            from pg_catalog.jsonb_array_elements(p_entries) as requested(entry)
            cross join lateral pg_catalog.jsonb_array_elements_text(requested.entry -> 'themeCodes') as requested_theme(code)
        ) as requested_theme
        left join public.themes as theme on theme.code = requested_theme.code
        where theme.id is null
    ) then
        raise exception using errcode = 'P0001', message = 'WORD_ADDITION_BATCH_INVALID_THEME';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('word-addition-request:' || requested.word, 0)
    )
    from (
        select pg_catalog.btrim(entry ->> 'word') as word
        from pg_catalog.jsonb_array_elements(p_entries) as batch(entry)
        order by pg_catalog.btrim(entry ->> 'word')
    ) as requested;

    for requested_entry in
        select pg_catalog.btrim(entry ->> 'word') as word,
               entry -> 'themeCodes' as theme_codes
        from pg_catalog.jsonb_array_elements(p_entries) as batch(entry)
        order by pg_catalog.btrim(entry ->> 'word')
    loop
        registered_word_id := null;
        pending_request_id := null;

        select word.id into registered_word_id
        from public.words as word
        where word.word = requested_entry.word
        for update;

        if registered_word_id is not null then
            insert into public.word_themes_wait (word_id, theme_id, typez, req_by)
            select registered_word_id, theme.id, 'add', actor
            from public.themes as theme
            where theme.code in (
                select requested_theme.code
                from pg_catalog.jsonb_array_elements_text(requested_entry.theme_codes) as requested_theme(code)
            )
              and not exists (
                  select 1 from public.word_themes as word_theme
                  where word_theme.word_id = registered_word_id
                    and word_theme.theme_id = theme.id
              )
            order by theme.id
            on conflict (word_id, theme_id) do nothing;
            get diagnostics inserted_count = row_count;
            if inserted_count > 0 then
                changed_registered_word_count := changed_registered_word_count + 1;
                created_theme_change_request_count := created_theme_change_request_count + inserted_count;
            else
                unchanged_word_count := unchanged_word_count + 1;
            end if;
            continue;
        end if;

        select request.id into pending_request_id
        from public.wait_words as request
        where request.word = requested_entry.word
          and request.request_type = 'add'
        for update;

        if pending_request_id is not null then
            insert into public.wait_word_themes (wait_word_id, theme_id)
            select pending_request_id, theme.id
            from public.themes as theme
            where theme.code in (
                select requested_theme.code
                from pg_catalog.jsonb_array_elements_text(requested_entry.theme_codes) as requested_theme(code)
            )
            order by theme.id
            on conflict (wait_word_id, theme_id) do nothing;
            get diagnostics inserted_count = row_count;
            if inserted_count > 0 then
                updated_word_request_count := updated_word_request_count + 1;
            else
                unchanged_word_count := unchanged_word_count + 1;
            end if;
            continue;
        end if;

        insert into public.wait_words (word, requested_by, request_type)
        values (requested_entry.word, actor, 'add')
        returning id into pending_request_id;
        insert into public.wait_word_themes (wait_word_id, theme_id)
        select pending_request_id, theme.id
        from public.themes as theme
        where theme.code in (
            select requested_theme.code
            from pg_catalog.jsonb_array_elements_text(requested_entry.theme_codes) as requested_theme(code)
        )
        order by theme.id;
        created_word_request_count := created_word_request_count + 1;
    end loop;

    return pg_catalog.jsonb_build_object(
        'requestedWordCount', entry_count,
        'createdWordRequestCount', created_word_request_count,
        'updatedWordRequestCount', updated_word_request_count,
        'changedRegisteredWordCount', changed_registered_word_count,
        'createdThemeChangeRequestCount', created_theme_change_request_count,
        'unchangedWordCount', unchanged_word_count
    );
exception
    when unique_violation then
        raise exception using errcode = 'P0001', message = 'WORD_ADDITION_BATCH_CONFLICT';
    when others then
        if sqlstate = 'P0001' and sqlerrm = any(array[
            'WORD_ADDITION_BATCH_UNAUTHORIZED',
            'WORD_ADDITION_BATCH_INVALID_INPUT',
            'WORD_ADDITION_BATCH_INVALID_THEME',
            'WORD_ADDITION_BATCH_CONFLICT'
        ]) then
            raise;
        end if;
        raise exception using errcode = 'P0001', message = 'WORD_ADDITION_BATCH_INTERNAL_ERROR';
end;
$function$;

comment on function public.request_word_additions(jsonb)
    is 'Applies an idempotent atomic batch of user word addition and theme requests.';

revoke all on function public.request_word_additions(jsonb) from public, anon;
grant execute on function public.request_word_additions(jsonb) to authenticated;

commit;

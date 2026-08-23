begin;

create or replace function public.request_word_theme_changes(
    p_word text,
    p_changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    actor uuid := auth.uid();
    normalized_word text := pg_catalog.btrim(p_word);
    change_count integer;
    word_match_count integer := 0;
    locked_theme_count integer := 0;
    resolved_changes jsonb := '[]'::jsonb;
    inserted_count integer;
    violation_constraint text;
    word_row public.words%rowtype;
    candidate_word public.words%rowtype;
    resolved_theme record;
    relation_theme_id bigint;
begin
    if actor is null then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_THEME_REQUEST_UNAUTHORIZED';
    end if;

    if normalized_word is null or normalized_word = '' then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_THEME_REQUEST_INVALID_INPUT';
    end if;

    if p_changes is null
       or pg_catalog.jsonb_typeof(p_changes) is distinct from 'array' then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_THEME_REQUEST_INVALID_INPUT';
    end if;

    change_count := pg_catalog.jsonb_array_length(p_changes);
    if change_count < 1 or change_count > 100 then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_THEME_REQUEST_INVALID_INPUT';
    end if;

    if exists (
        select 1
        from pg_catalog.jsonb_array_elements(p_changes) as change(entry)
        where pg_catalog.jsonb_typeof(change.entry) is distinct from 'object'
           or not change.entry ? 'themeCode'
           or not change.entry ? 'type'
           or (
                select pg_catalog.count(*)
                from pg_catalog.jsonb_object_keys(change.entry)
              ) <> 2
           or pg_catalog.jsonb_typeof(change.entry -> 'themeCode')
                is distinct from 'string'
           or pg_catalog.jsonb_typeof(change.entry -> 'type')
                is distinct from 'string'
           or change.entry ->> 'themeCode' = ''
           or change.entry ->> 'themeCode'
                ~ '(^[[:space:]])|([[:space:]]$)'
           or change.entry ->> 'type' not in ('add', 'delete')
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_THEME_REQUEST_INVALID_INPUT';
    end if;

    if exists (
        select 1
        from pg_catalog.jsonb_array_elements(p_changes) as change(entry)
        group by change.entry ->> 'themeCode'
        having pg_catalog.count(*) > 1
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_THEME_REQUEST_INVALID_INPUT';
    end if;

    for candidate_word in
        select registered_word.*
        from public.words as registered_word
        where registered_word.word = normalized_word
        order by registered_word.id
        for update
    loop
        word_match_count := word_match_count + 1;
        word_row := candidate_word;
    end loop;

    if word_match_count <> 1 then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_THEME_REQUEST_NOT_FOUND';
    end if;

    for resolved_theme in
        select theme.id as theme_id,
               theme.code as theme_code,
               theme.name as theme_name,
               requested_theme.request_type
        from public.themes as theme
        join (
            select change.entry ->> 'themeCode' as code,
                   change.entry ->> 'type' as request_type
            from pg_catalog.jsonb_array_elements(p_changes) as change(entry)
        ) as requested_theme
          on requested_theme.code = theme.code
        order by theme.id
        for update of theme
    loop
        locked_theme_count := locked_theme_count + 1;
        resolved_changes := resolved_changes || pg_catalog.jsonb_build_array(
            pg_catalog.jsonb_build_object(
                'themeId', resolved_theme.theme_id,
                'themeCode', resolved_theme.theme_code,
                'themeName', resolved_theme.theme_name,
                'type', resolved_theme.request_type
            )
        );
    end loop;

    if locked_theme_count <> change_count or exists (
        select 1
        from (
            select change.entry ->> 'themeCode' as code
            from pg_catalog.jsonb_array_elements(p_changes) as change(entry)
        ) as requested_theme
        left join pg_catalog.jsonb_array_elements(
            resolved_changes
        ) as locked_theme(entry)
          on locked_theme.entry ->> 'themeCode' = requested_theme.code
        group by requested_theme.code
        having pg_catalog.count(locked_theme.entry) <> 1
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_THEME_REQUEST_NOT_FOUND';
    end if;

    for relation_theme_id in
        select word_theme.theme_id
        from public.word_themes as word_theme
        join pg_catalog.jsonb_array_elements(
            resolved_changes
        ) as resolved_change(entry)
          on (resolved_change.entry ->> 'themeId')::bigint =
             word_theme.theme_id
        where word_theme.word_id = word_row.id
        order by word_theme.theme_id
        for update of word_theme
    loop
        null;
    end loop;

    for relation_theme_id in
        select pending_request.theme_id
        from public.word_themes_wait as pending_request
        join pg_catalog.jsonb_array_elements(
            resolved_changes
        ) as resolved_change(entry)
          on (resolved_change.entry ->> 'themeId')::bigint =
             pending_request.theme_id
        where pending_request.word_id = word_row.id
        order by pending_request.theme_id
        for update of pending_request
    loop
        null;
    end loop;

    if exists (
        select 1
        from public.word_themes_wait as pending_request
        join pg_catalog.jsonb_array_elements(
            resolved_changes
        ) as resolved_change(entry)
          on (resolved_change.entry ->> 'themeId')::bigint =
             pending_request.theme_id
        where pending_request.word_id = word_row.id
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_THEME_REQUEST_CONFLICT';
    end if;

    if exists (
        select 1
        from pg_catalog.jsonb_array_elements(
            resolved_changes
        ) as resolved_change(entry)
        left join public.word_themes as word_theme
          on word_theme.word_id = word_row.id
         and word_theme.theme_id =
             (resolved_change.entry ->> 'themeId')::bigint
        where (resolved_change.entry ->> 'type' = 'add'
               and word_theme.word_id is not null)
           or (resolved_change.entry ->> 'type' = 'delete'
               and word_theme.word_id is null)
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_THEME_REQUEST_CONFLICT';
    end if;

    begin
        insert into public.word_themes_wait (
            word_id, theme_id, typez, req_by
        )
        select word_row.id,
               (resolved_change.entry ->> 'themeId')::bigint,
               (resolved_change.entry ->> 'type')::public.request_type_enum,
               actor
        from pg_catalog.jsonb_array_elements(
            resolved_changes
        ) as resolved_change(entry)
        order by (resolved_change.entry ->> 'themeId')::bigint;

        get diagnostics inserted_count = row_count;
        if inserted_count <> change_count then
            raise exception using
                errcode = 'P0001',
                message = 'WORD_THEME_REQUEST_INTERNAL_ERROR';
        end if;
    exception
        when unique_violation then
            get stacked diagnostics
                violation_constraint = constraint_name;
            if violation_constraint =
               'word_themes_wait_word_theme_unique' then
                raise exception using
                    errcode = 'P0001',
                    message = 'WORD_THEME_REQUEST_CONFLICT';
            end if;
            raise exception using
                errcode = 'P0001',
                message = 'WORD_THEME_REQUEST_INTERNAL_ERROR';
        when others then
            raise exception using
                errcode = 'P0001',
                message = 'WORD_THEME_REQUEST_INTERNAL_ERROR';
    end;

    return pg_catalog.jsonb_build_object(
        'word', normalized_word,
        'changes', (
            select pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                    'themeCode', resolved_change.entry ->> 'themeCode',
                    'themeName', resolved_change.entry ->> 'themeName',
                    'type', resolved_change.entry ->> 'type'
                )
                order by resolved_change.entry ->> 'themeCode',
                         resolved_change.entry ->> 'type'
            )
            from pg_catalog.jsonb_array_elements(
                resolved_changes
            ) as resolved_change(entry)
        )
    );
end;
$function$;

revoke all on function public.request_word_theme_changes(text, jsonb)
    from public, anon;
grant execute on function public.request_word_theme_changes(text, jsonb)
    to authenticated;

commit;

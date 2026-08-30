begin;

create or replace function public.request_word_addition(
    p_word text,
    p_theme_codes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    actor uuid := auth.uid();
    normalized_word text := pg_catalog.btrim(p_word);
    requested_theme_count integer;
    resolved_theme_count integer;
    request_row public.wait_words%rowtype;
    resolved_themes jsonb := '[]'::jsonb;
begin
    if actor is null then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_UNAUTHORIZED';
    end if;
    if normalized_word is null or normalized_word = '' then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_INVALID_INPUT';
    end if;
    if p_theme_codes is null then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_INVALID_INPUT';
    end if;

    requested_theme_count := pg_catalog.cardinality(p_theme_codes);
    if requested_theme_count > 100
       or exists (
            select 1
            from pg_catalog.unnest(p_theme_codes) as requested_theme(code)
            where requested_theme.code is null
               or requested_theme.code = ''
               or requested_theme.code <> pg_catalog.btrim(requested_theme.code)
       )
       or (
            select pg_catalog.count(*)
            from (
                select requested_theme.code
                from pg_catalog.unnest(p_theme_codes) as requested_theme(code)
                group by requested_theme.code
            ) as distinct_theme
       ) <> requested_theme_count then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_INVALID_INPUT';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            'word-addition-request:' || normalized_word,
            0
        )
    );

    if exists (
        select 1
        from public.words as registered_word
        where registered_word.word = normalized_word
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_ALREADY_REGISTERED';
    end if;

    perform theme.id
    from public.themes as theme
    where theme.code = any(p_theme_codes)
    order by theme.id
    for update;

    select pg_catalog.count(*)::integer,
           coalesce(
               pg_catalog.jsonb_agg(
                   pg_catalog.jsonb_build_object(
                       'themeCode', theme.code,
                       'themeName', theme.name
                   ) order by theme.code
               ),
               '[]'::jsonb
           )
    into resolved_theme_count, resolved_themes
    from public.themes as theme
    where theme.code = any(p_theme_codes);

    if resolved_theme_count <> requested_theme_count then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_INVALID_THEME';
    end if;

    insert into public.wait_words (
        word,
        requested_by,
        request_type
    ) values (
        normalized_word,
        actor,
        'add'
    )
    returning * into request_row;

    insert into public.wait_word_themes (wait_word_id, theme_id)
    select request_row.id, theme.id
    from public.themes as theme
    where theme.code = any(p_theme_codes)
    order by theme.code;

    return pg_catalog.jsonb_build_object(
        'requestId', request_row.id,
        'word', request_row.word,
        'requestType', request_row.request_type,
        'themes', resolved_themes
    );
exception
    when unique_violation then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_CONFLICT';
    when others then
        if sqlstate = 'P0001' and sqlerrm = any(array[
            'WORD_REQUEST_UNAUTHORIZED',
            'WORD_REQUEST_INVALID_INPUT',
            'WORD_REQUEST_ALREADY_REGISTERED',
            'WORD_REQUEST_INVALID_THEME',
            'WORD_REQUEST_CONFLICT'
        ]) then
            raise;
        end if;
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_INTERNAL_ERROR';
end;
$function$;

comment on function public.request_word_addition(text, text[])
    is 'Atomically creates an authenticated user word addition request and its theme relations.';

revoke all on function public.request_word_addition(text, text[])
    from public, anon;
grant execute on function public.request_word_addition(text, text[])
    to authenticated;

commit;

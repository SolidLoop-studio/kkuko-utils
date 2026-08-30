begin;

revoke create on schema public from public, anon, authenticated, service_role;

do $security_invariant$
begin
    if exists (
        select 1
        from pg_catalog.pg_namespace as namespace
        cross join lateral pg_catalog.aclexplode(
            coalesce(
                namespace.nspacl,
                pg_catalog.acldefault('n', namespace.nspowner)
            )
        ) as schema_acl
        where namespace.nspname = 'public'
          and schema_acl.grantee = 0
          and schema_acl.privilege_type = 'CREATE'
    )
       or pg_catalog.has_schema_privilege('anon', 'public', 'create')
       or pg_catalog.has_schema_privilege('authenticated', 'public', 'create')
       or pg_catalog.has_schema_privilege('service_role', 'public', 'create') then
        raise exception 'DIRECT_WORD_ADDITION_SECURITY_INVARIANT';
    end if;
end;
$security_invariant$;

create or replace function public.add_word_directly(
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
    actor_role public.role_level;
    normalized_word text := pg_catalog.btrim(p_word);
    requested_theme_count integer;
    resolved_theme_count integer;
    selected_theme_ids bigint[] := array[]::bigint[];
    affected_docs_ids bigint[] := array[]::bigint[];
    inserted_word public.words%rowtype;
    noin_can_use boolean := false;
    violated_constraint text;
begin
    if actor is null then
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_ADDITION_UNAUTHORIZED';
    end if;

    select app_user.role into actor_role
    from public.users as app_user
    where app_user.id = actor
    for share;
    if not found or actor_role not in ('admin', 'r4') then
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_ADDITION_FORBIDDEN';
    end if;

    if normalized_word is null
       or normalized_word = ''
       or pg_catalog.char_length(normalized_word) > 100
       or pg_catalog.octet_length(normalized_word) > 300
       or p_theme_codes is null then
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_ADDITION_INVALID_INPUT';
    end if;
    requested_theme_count := pg_catalog.cardinality(p_theme_codes);
    if requested_theme_count > 100
       or exists (
            select 1
            from pg_catalog.unnest(p_theme_codes) as requested_theme(code)
            where requested_theme.code is null
               or requested_theme.code = ''
               or requested_theme.code <> pg_catalog.btrim(requested_theme.code)
               or pg_catalog.char_length(requested_theme.code) > 64
               or pg_catalog.octet_length(requested_theme.code) > 192
       )
       or (
            select pg_catalog.count(*)
            from (
                select requested_theme.code
                from pg_catalog.unnest(p_theme_codes) as requested_theme(code)
                group by requested_theme.code
            ) as distinct_theme
       ) <> requested_theme_count then
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_ADDITION_INVALID_INPUT';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('direct-word-addition:' || normalized_word, 0)
    );
    if exists (
        select 1 from public.words as registered_word
        where registered_word.word = normalized_word
    ) then
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_ADDITION_DUPLICATE';
    end if;

    perform theme.id
    from public.themes as theme
    where theme.code = any(p_theme_codes)
    order by theme.id
    for share;
    select pg_catalog.count(*)::integer,
           coalesce(pg_catalog.array_agg(theme.id order by theme.id), array[]::bigint[])
    into resolved_theme_count, selected_theme_ids
    from public.themes as theme
    where theme.code = any(p_theme_codes);
    if resolved_theme_count <> requested_theme_count then
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_ADDITION_INVALID_THEME';
    end if;

    select exists (
        select 1
        from public.themes as theme
        join pg_catalog.generate_series(0, 53) as noinjung(value)
          on theme.code = pg_catalog.concat(noinjung.value * 10)
        where theme.id = any(selected_theme_ids)
    ) into noin_can_use;

    -- Legacy word-side triggers resolve helper functions from public. Keep the
    -- RPC's persisted search_path empty, expose pg_catalog first, and scope the
    -- compatibility path to this transaction only.
    perform pg_catalog.set_config('search_path', 'pg_catalog, public, pg_temp', true);

    insert into public.words (word, added_by, noin_canuse)
    values (normalized_word, actor, noin_can_use)
    returning * into inserted_word;

    perform pg_catalog.set_config('search_path', '', true);

    insert into public.word_themes (word_id, theme_id)
    select inserted_word.id, selected_theme.id
    from pg_catalog.unnest(selected_theme_ids) as selected_theme(id)
    order by selected_theme.id;

    perform document.id
    from public.docs as document
    where (document.typez = 'letter'
           and pg_catalog.btrim(document.name) = pg_catalog.right(normalized_word, 1))
       or (document.typez = 'theme' and exists (
            select 1
            from public.themes as theme
            where theme.id = any(selected_theme_ids)
              and theme.name = document.name
       ))
    order by document.id
    for update;
    select coalesce(
        pg_catalog.array_agg(document.id order by document.id),
        array[]::bigint[]
    ) into affected_docs_ids
    from public.docs as document
    where (document.typez = 'letter'
           and pg_catalog.btrim(document.name) = pg_catalog.right(normalized_word, 1))
       or (document.typez = 'theme' and exists (
            select 1
            from public.themes as theme
            where theme.id = any(selected_theme_ids)
              and theme.name = document.name
       ));

    insert into public.logs (word, make_by, processed_by, r_type, state)
    values (normalized_word, actor, actor, 'add', 'approved');

    insert into public.docs_logs (docs_id, word, add_by, type)
    select affected_doc.id, normalized_word, actor, 'add'
    from pg_catalog.unnest(affected_docs_ids) as affected_doc(id)
    order by affected_doc.id;
    if pg_catalog.cardinality(affected_docs_ids) > 0 then
        perform public.update_last_updates(docs_ids => affected_docs_ids);
    end if;

    return pg_catalog.jsonb_build_object(
        'wordId', inserted_word.id,
        'word', inserted_word.word,
        'noinCanUse', inserted_word.noin_canuse,
        'themeIds', pg_catalog.to_jsonb(selected_theme_ids),
        'affectedDocsIds', pg_catalog.to_jsonb(affected_docs_ids)
    );
exception
    when unique_violation then
        get stacked diagnostics violated_constraint = constraint_name;
        if violated_constraint = 'unique_word' then
            raise exception using errcode = 'P0001',
                message = 'DIRECT_WORD_ADDITION_DUPLICATE';
        end if;
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_ADDITION_INTERNAL_ERROR';
    when raise_exception then
        if sqlerrm = any(array[
            'DIRECT_WORD_ADDITION_UNAUTHORIZED',
            'DIRECT_WORD_ADDITION_FORBIDDEN',
            'DIRECT_WORD_ADDITION_INVALID_INPUT',
            'DIRECT_WORD_ADDITION_INVALID_THEME',
            'DIRECT_WORD_ADDITION_DUPLICATE',
            'DIRECT_WORD_ADDITION_INTERNAL_ERROR'
        ]) then
            raise;
        end if;
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_ADDITION_INTERNAL_ERROR';
    when others then
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_ADDITION_INTERNAL_ERROR';
end;
$function$;

alter function public.add_word_directly(text, text[]) owner to postgres;

comment on function public.add_word_directly(text, text[])
    is 'Atomically adds one administrator-approved word and all related effects using auth.uid().';

revoke all on function public.add_word_directly(text, text[])
    from public, anon;
grant execute on function public.add_word_directly(text, text[])
    to authenticated, service_role;

commit;

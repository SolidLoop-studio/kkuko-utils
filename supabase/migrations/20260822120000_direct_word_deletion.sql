begin;

create or replace function public.delete_word_directly(p_word_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
    actor uuid;
    word_row public.words%rowtype;
    affected_docs_ids bigint[] := array[]::bigint[];
    direct_docs_ids bigint[] := array[]::bigint[];
    deleted_count integer;
    special_docs_ids constant bigint[] := array[
        201, 202,
        209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219,
        220, 221, 222, 223, 224, 225, 226, 227, 228, 229,
        230, 231, 232, 233, 234, 235, 236, 237, 238, 239,
        240, 241, 242, 243, 244, 245, 246, 247, 248, 249,
        250, 251, 252
    ]::bigint[];
begin
    actor := auth.uid();
    if actor is null then
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_DELETION_UNAUTHORIZED';
    end if;
    if p_word_id is null or p_word_id <= 0 then
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_DELETION_INVALID_INPUT';
    end if;
    if not exists (
        select 1 from public.users as app_user
        where app_user.id = actor and app_user.role = 'admin'
    ) then
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_DELETION_FORBIDDEN';
    end if;

    select * into word_row
    from public.words as target
    where target.id = p_word_id
    for update;
    if not found then
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_DELETION_CONFLICT';
    end if;

    perform word_theme.word_id
    from public.word_themes as word_theme
    where word_theme.word_id = word_row.id
    order by word_theme.word_id, word_theme.theme_id
    for update of word_theme;

    perform wait_word.id
    from public.wait_words as wait_word
    where wait_word.word_id = word_row.id
    order by wait_word.id
    for update;

    perform wait_theme.word_id
    from public.word_themes_wait as wait_theme
    where wait_theme.word_id = word_row.id
    order by wait_theme.word_id, wait_theme.theme_id, wait_theme.typez
    for update of wait_theme;

    select coalesce(
        pg_catalog.array_agg(document.id order by document.id),
        array[]::bigint[]
    ) into direct_docs_ids
    from public.docs as document
    where document.id <> all(special_docs_ids)
      and (
        (
            document.typez = 'letter'
            and pg_catalog.btrim(document.name) =
                pg_catalog.right(word_row.word, 1)
        )
        or (
            document.typez = 'theme'
            and exists (
                select 1
                from public.word_themes as word_theme
                join public.themes as theme
                  on theme.id = word_theme.theme_id
                where word_theme.word_id = word_row.id
                  and theme.name = document.name
            )
        )
      );

    perform document.id
    from public.docs as document
    where document.id = any(direct_docs_ids)
       or document.id = any(special_docs_ids)
    order by document.id
    for update;

    perform app_user.id
    from public.users as app_user
    where app_user.id = actor
    for update;

    insert into public.logs (
        word, make_by, processed_by, r_type, state
    ) values (
        word_row.word, actor, actor, 'delete', 'approved'
    );

    insert into public.docs_logs (docs_id, word, add_by, type)
    select direct_doc.id, word_row.word, actor, 'delete'
    from pg_catalog.unnest(direct_docs_ids) as direct_doc(id)
    order by direct_doc.id;

    if pg_catalog.cardinality(direct_docs_ids) > 0 then
        perform public.update_last_updates(docs_ids => direct_docs_ids);
    end if;
    perform public.increment_contribution(
        target_id => actor,
        inc_amount => 1
    );

    delete from public.words as target
    where target.id = word_row.id;
    get diagnostics deleted_count = row_count;
    if deleted_count <> 1 then
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_DELETION_INTERNAL_ERROR';
    end if;

    affected_docs_ids := direct_docs_ids;

    return pg_catalog.jsonb_build_object(
        'deletedWordCount', 1,
        'affectedDocsIds', pg_catalog.to_jsonb(affected_docs_ids)
    );
exception
    when raise_exception then
        if sqlerrm in (
            'DIRECT_WORD_DELETION_UNAUTHORIZED',
            'DIRECT_WORD_DELETION_FORBIDDEN',
            'DIRECT_WORD_DELETION_INVALID_INPUT',
            'DIRECT_WORD_DELETION_CONFLICT',
            'DIRECT_WORD_DELETION_INTERNAL_ERROR'
        ) then
            raise;
        end if;
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_DELETION_INTERNAL_ERROR';
    when others then
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_DELETION_INTERNAL_ERROR';
end;
$function$;

revoke all on function public.delete_word_directly(bigint) from public, anon;
grant execute on function public.delete_word_directly(bigint)
    to authenticated, service_role;

commit;

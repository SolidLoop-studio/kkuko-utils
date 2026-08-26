begin;

create or replace function public.set_docs_favorite(
    p_docs_id bigint,
    p_is_starred boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
    actor uuid := auth.uid();
begin
    if actor is null then
        raise exception using
            errcode = 'P0001',
            message = 'DOCS_FAVORITE_UNAUTHORIZED';
    end if;

    if not exists (
        select 1
        from public.docs as target_docs
        where target_docs.id = p_docs_id
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'DOCS_FAVORITE_NOT_FOUND';
    end if;

    if p_is_starred is true then
        insert into public.user_star_docs (user_id, docs_id)
        values (actor, p_docs_id)
        on conflict (user_id, docs_id) do nothing;
    elsif p_is_starred is false then
        delete from public.user_star_docs as favorite
        where favorite.user_id = actor
          and favorite.docs_id = p_docs_id;
    else
        raise exception using
            errcode = 'P0001',
            message = 'DOCS_FAVORITE_INTERNAL_ERROR';
    end if;
exception
    when raise_exception then
        if sqlerrm = any(array[
            'DOCS_FAVORITE_UNAUTHORIZED',
            'DOCS_FAVORITE_NOT_FOUND'
        ]) then
            raise;
        end if;
        raise exception using
            errcode = 'P0001',
            message = 'DOCS_FAVORITE_INTERNAL_ERROR';
    when others then
        raise exception using
            errcode = 'P0001',
            message = 'DOCS_FAVORITE_INTERNAL_ERROR';
end;
$function$;

revoke all on function public.set_docs_favorite(bigint, boolean)
    from public, anon, authenticated;
grant execute on function public.set_docs_favorite(bigint, boolean)
    to authenticated;

revoke insert, delete on table public.user_star_docs
    from anon, authenticated;

commit;

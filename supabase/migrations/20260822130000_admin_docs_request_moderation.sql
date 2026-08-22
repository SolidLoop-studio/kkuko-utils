begin;

create schema if not exists private;

create or replace function private.assert_docs_request_moderation_admin()
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
            message = 'DOCS_REQUEST_MODERATION_UNAUTHORIZED';
    end if;

    if not exists (
        select 1
        from public.users as app_user
        where app_user.id = actor
          and app_user.role = 'admin'
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'DOCS_REQUEST_MODERATION_FORBIDDEN';
    end if;

    return actor;
end;
$function$;

create or replace function private.is_docs_request_moderation_safe_integer(
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
        then (p_value::text)::numeric =
                 pg_catalog.trunc((p_value::text)::numeric)
             and (p_value::text)::numeric
                 between 1 and 9007199254740991
        else false
    end;
$function$;

create or replace function public.approve_docs_requests(p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    selection jsonb;
    request_ids bigint[] := array[]::bigint[];
    request_id bigint;
    selection_count integer;
    locked_count integer;
begin
    perform private.assert_docs_request_moderation_admin();

    if p_selections is null
       or pg_catalog.jsonb_typeof(p_selections) <> 'array' then
        raise exception using
            errcode = 'P0001',
            message = 'DOCS_REQUEST_MODERATION_INVALID_INPUT';
    end if;

    selection_count := pg_catalog.jsonb_array_length(p_selections);
    if selection_count < 1 or selection_count > 30 then
        raise exception using
            errcode = 'P0001',
            message = 'DOCS_REQUEST_MODERATION_INVALID_INPUT';
    end if;

    for selection in
        select item.value
        from pg_catalog.jsonb_array_elements(p_selections) as item(value)
    loop
        if pg_catalog.jsonb_typeof(selection) <> 'object'
           or not (selection ? 'requestId')
           or not (selection ? 'duem')
           or selection - 'requestId' - 'duem' <> '{}'::jsonb
           or not private.is_docs_request_moderation_safe_integer(
                selection -> 'requestId'
           )
           or pg_catalog.jsonb_typeof(selection -> 'duem') <> 'boolean' then
            raise exception using
                errcode = 'P0001',
                message = 'DOCS_REQUEST_MODERATION_INVALID_INPUT';
        end if;

        request_id := (selection ->> 'requestId')::bigint;
        if request_id = any(request_ids) then
            raise exception using
                errcode = 'P0001',
                message = 'DOCS_REQUEST_MODERATION_INVALID_INPUT';
        end if;
        request_ids := pg_catalog.array_append(request_ids, request_id);
    end loop;

    select pg_catalog.array_agg(request.id order by request.id)
    into request_ids
    from pg_catalog.unnest(request_ids) as request(id);

    select pg_catalog.count(*)::integer
    into locked_count
    from (
        select wait_request.id
        from public.docs_wait as wait_request
        where wait_request.id = any(request_ids)
        order by wait_request.id
        FOR UPDATE
    ) as locked_request;

    if locked_count <> selection_count then
        raise exception using
            errcode = 'P0001',
            message = 'DOCS_REQUEST_MODERATION_CONFLICT';
    end if;

    insert into public.docs (name, maker, typez, duem)
    select
        wait_request.docs_name,
        wait_request.req_by,
        'letter'::public.document_type,
        (selection_item.value ->> 'duem')::boolean
    from public.docs_wait as wait_request
    join pg_catalog.jsonb_array_elements(p_selections)
        as selection_item(value)
      on (selection_item.value ->> 'requestId')::bigint = wait_request.id
    where wait_request.id = any(request_ids)
    order by wait_request.id;

    delete from public.docs_wait as wait_request
    where wait_request.id = any(request_ids);

    return pg_catalog.jsonb_build_object(
        'processedRequestIds', pg_catalog.to_jsonb(request_ids),
        'processedRequestCount', selection_count
    );
exception
    when raise_exception then
        if sqlerrm in (
            'DOCS_REQUEST_MODERATION_UNAUTHORIZED',
            'DOCS_REQUEST_MODERATION_FORBIDDEN',
            'DOCS_REQUEST_MODERATION_INVALID_INPUT',
            'DOCS_REQUEST_MODERATION_CONFLICT',
            'DOCS_REQUEST_MODERATION_INTERNAL_ERROR'
        ) then
            raise;
        end if;
        raise exception using
            errcode = 'P0001',
            message = 'DOCS_REQUEST_MODERATION_INTERNAL_ERROR';
    when others then
        raise exception using
            errcode = 'P0001',
            message = 'DOCS_REQUEST_MODERATION_INTERNAL_ERROR';
end;
$function$;

create or replace function public.reject_docs_requests(p_request_ids jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    request_value jsonb;
    request_ids bigint[] := array[]::bigint[];
    request_id bigint;
    request_count integer;
    locked_count integer;
begin
    perform private.assert_docs_request_moderation_admin();

    if p_request_ids is null
       or pg_catalog.jsonb_typeof(p_request_ids) <> 'array' then
        raise exception using
            errcode = 'P0001',
            message = 'DOCS_REQUEST_MODERATION_INVALID_INPUT';
    end if;

    request_count := pg_catalog.jsonb_array_length(p_request_ids);
    if request_count < 1 or request_count > 30 then
        raise exception using
            errcode = 'P0001',
            message = 'DOCS_REQUEST_MODERATION_INVALID_INPUT';
    end if;

    for request_value in
        select item.value
        from pg_catalog.jsonb_array_elements(p_request_ids) as item(value)
    loop
        if not private.is_docs_request_moderation_safe_integer(request_value)
        then
            raise exception using
                errcode = 'P0001',
                message = 'DOCS_REQUEST_MODERATION_INVALID_INPUT';
        end if;

        request_id := (request_value #>> '{}')::bigint;
        if request_id = any(request_ids) then
            raise exception using
                errcode = 'P0001',
                message = 'DOCS_REQUEST_MODERATION_INVALID_INPUT';
        end if;
        request_ids := pg_catalog.array_append(request_ids, request_id);
    end loop;

    select pg_catalog.array_agg(request.id order by request.id)
    into request_ids
    from pg_catalog.unnest(request_ids) as request(id);

    select pg_catalog.count(*)::integer
    into locked_count
    from (
        select wait_request.id
        from public.docs_wait as wait_request
        where wait_request.id = any(request_ids)
        order by wait_request.id
        FOR UPDATE
    ) as locked_request;

    if locked_count <> request_count then
        raise exception using
            errcode = 'P0001',
            message = 'DOCS_REQUEST_MODERATION_CONFLICT';
    end if;

    delete from public.docs_wait as wait_request
    where wait_request.id = any(request_ids);

    return pg_catalog.jsonb_build_object(
        'processedRequestIds', pg_catalog.to_jsonb(request_ids),
        'processedRequestCount', request_count
    );
exception
    when raise_exception then
        if sqlerrm in (
            'DOCS_REQUEST_MODERATION_UNAUTHORIZED',
            'DOCS_REQUEST_MODERATION_FORBIDDEN',
            'DOCS_REQUEST_MODERATION_INVALID_INPUT',
            'DOCS_REQUEST_MODERATION_CONFLICT',
            'DOCS_REQUEST_MODERATION_INTERNAL_ERROR'
        ) then
            raise;
        end if;
        raise exception using
            errcode = 'P0001',
            message = 'DOCS_REQUEST_MODERATION_INTERNAL_ERROR';
    when others then
        raise exception using
            errcode = 'P0001',
            message = 'DOCS_REQUEST_MODERATION_INTERNAL_ERROR';
end;
$function$;

revoke all on function private.assert_docs_request_moderation_admin()
    from public, anon, authenticated, service_role;
revoke all on function private.is_docs_request_moderation_safe_integer(jsonb)
    from public, anon, authenticated, service_role;
revoke all on function public.approve_docs_requests(jsonb) from public, anon;
revoke all on function public.reject_docs_requests(jsonb) from public, anon;
grant execute on function public.approve_docs_requests(jsonb)
    to authenticated;
grant execute on function public.reject_docs_requests(jsonb)
    to authenticated;

commit;

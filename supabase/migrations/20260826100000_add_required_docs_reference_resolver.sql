begin;

create or replace function private.require_docs_reference_id(
    p_reference_code text,
    p_context text
)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
    resolved_id bigint;
begin
    select document.id
      into resolved_id
      from public.docs as document
     where document.reference_code = p_reference_code;

    if resolved_id is null then
        raise log using
            message = 'DOCS_REQUIRED_REFERENCE_MISSING',
            detail = pg_catalog.format(
                'reference_code=%L context=%L session_user=%s current_user=%s',
                p_reference_code,
                p_context,
                session_user,
                current_user
            );
        raise exception using
            errcode = 'P0001',
            message = 'DOCS_REQUIRED_REFERENCE_MISSING';
    end if;

    return resolved_id;
end;
$function$;

revoke all on function private.require_docs_reference_id(text, text)
    from public, anon, authenticated, service_role;

commit;

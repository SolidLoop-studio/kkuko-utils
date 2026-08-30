begin;

do $$
begin
    if pg_catalog.has_schema_privilege('anon', 'public', 'CREATE')
       or pg_catalog.has_schema_privilege('authenticated', 'public', 'CREATE')
       or pg_catalog.has_schema_privilege('service_role', 'public', 'CREATE') then
        raise exception using
            errcode = '42501',
            message = 'WORD_APPROVAL_UNTRUSTED_PUBLIC_SCHEMA';
    end if;
end;
$$;

alter function public.apply_word_approval_batch(uuid, integer, integer, text, jsonb)
    set search_path to pg_catalog, public, pg_temp;

comment on function public.apply_word_approval_batch(uuid, integer, integer, text, jsonb)
    is 'Atomically applies one sequential, idempotent word approval batch with a trusted legacy-trigger search path and pg_temp explicitly last.';

commit;

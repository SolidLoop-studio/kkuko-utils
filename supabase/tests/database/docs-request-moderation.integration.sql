begin;

create or replace function pg_temp.set_docs_moderation_actor(actor_id uuid)
returns void
language plpgsql
as $function$
begin
    perform pg_catalog.set_config(
        'request.jwt.claim.sub', coalesce(actor_id::text, ''), true
    );
    perform pg_catalog.set_config(
        'request.jwt.claims',
        case when actor_id is null then '{}'
             else pg_catalog.jsonb_build_object(
                 'sub', actor_id::text, 'role', 'authenticated'
             )::text
        end,
        true
    );
end;
$function$;

delete from public.docs
where name like 'docs-request-moderation-test-%';
delete from public.docs_wait where id between 910001 and 910010;
delete from public.users where id in (
    '43000000-0000-4000-8000-000000000001',
    '43000000-0000-4000-8000-000000000002',
    '43000000-0000-4000-8000-000000000003'
);
delete from auth.users where id in (
    '43000000-0000-4000-8000-000000000001',
    '43000000-0000-4000-8000-000000000002',
    '43000000-0000-4000-8000-000000000003'
);

insert into auth.users (id) values
    ('43000000-0000-4000-8000-000000000001'),
    ('43000000-0000-4000-8000-000000000002'),
    ('43000000-0000-4000-8000-000000000003');
insert into public.users (id, nickname, role) values
    ('43000000-0000-4000-8000-000000000001',
     'docs-moderation-admin', 'admin'),
    ('43000000-0000-4000-8000-000000000002',
     'docs-moderation-user', 'r1'),
    ('43000000-0000-4000-8000-000000000003',
     'docs-moderation-requester', 'r1');

insert into public.docs_wait (id, docs_name, req_by) values
    (910001, 'docs-request-moderation-test-a',
     '43000000-0000-4000-8000-000000000003'),
    (910002, 'docs-request-moderation-test-b',
     '43000000-0000-4000-8000-000000000003'),
    (910003, 'docs-request-moderation-test-rollback-clean',
     '43000000-0000-4000-8000-000000000003'),
    (910004, 'docs-request-moderation-test-conflict',
     '43000000-0000-4000-8000-000000000003'),
    (910005, 'docs-request-moderation-test-reject-a',
     '43000000-0000-4000-8000-000000000003'),
    (910006, 'docs-request-moderation-test-reject-b',
     '43000000-0000-4000-8000-000000000003');
insert into public.docs (name, maker, typez)
values (
    'docs-request-moderation-test-conflict',
    '43000000-0000-4000-8000-000000000003',
    'letter'
);

select no_plan();

select pg_temp.set_docs_moderation_actor(null);
select throws_ok(
    $$ select public.approve_docs_requests('[{"requestId": 1, "duem": false}]'::jsonb) $$,
    'P0001',
    'DOCS_REQUEST_MODERATION_UNAUTHORIZED'
);

select pg_temp.set_docs_moderation_actor(
    '43000000-0000-4000-8000-000000000002'
);
set local role authenticated;
select throws_ok(
    $$ select public.reject_docs_requests('[910002]'::jsonb) $$,
    'P0001',
    'DOCS_REQUEST_MODERATION_FORBIDDEN',
    'non-admin authenticated users cannot reject docs requests'
);
reset role;

select ok(
    not pg_catalog.has_function_privilege(
        'anon', 'public.approve_docs_requests(jsonb)', 'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
        'anon', 'public.reject_docs_requests(jsonb)', 'EXECUTE'
    ),
    'anon has no execute privilege on either docs moderation RPC'
);
select ok(
    pg_catalog.has_function_privilege(
        'authenticated', 'public.approve_docs_requests(jsonb)', 'EXECUTE'
    )
    and pg_catalog.has_function_privilege(
        'authenticated', 'public.reject_docs_requests(jsonb)', 'EXECUTE'
    ),
    'authenticated users can execute both docs moderation RPCs'
);
select is(
    (
        select pg_catalog.array_to_string(routine.proconfig, ',')
        from pg_catalog.pg_proc as routine
        where routine.oid =
            'public.approve_docs_requests(jsonb)'::pg_catalog.regprocedure
    ),
    'search_path=""',
    'approval uses an empty search path'
);
select is(
    (
        select pg_catalog.array_to_string(routine.proconfig, ',')
        from pg_catalog.pg_proc as routine
        where routine.oid =
            'public.reject_docs_requests(jsonb)'::pg_catalog.regprocedure
    ),
    'search_path=""',
    'rejection uses an empty search path'
);

select pg_temp.set_docs_moderation_actor(
    '43000000-0000-4000-8000-000000000001'
);

set local role authenticated;
select throws_ok(
    $$ select public.approve_docs_requests('[]'::jsonb) $$,
    'P0001', 'DOCS_REQUEST_MODERATION_INVALID_INPUT',
    'approval rejects an empty array'
);
select throws_ok(
    $$ select public.reject_docs_requests('[]'::jsonb) $$,
    'P0001', 'DOCS_REQUEST_MODERATION_INVALID_INPUT',
    'rejection rejects an empty array'
);
select throws_ok(
    $$ select public.approve_docs_requests(
        (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'requestId', item, 'duem', false
        )) from pg_catalog.generate_series(1, 31) as item)
    ) $$,
    'P0001', 'DOCS_REQUEST_MODERATION_INVALID_INPUT',
    'approval rejects more than 30 selections'
);
select throws_ok(
    $$ select public.reject_docs_requests(
        (select pg_catalog.jsonb_agg(item)
         from pg_catalog.generate_series(1, 31) as item)
    ) $$,
    'P0001', 'DOCS_REQUEST_MODERATION_INVALID_INPUT',
    'rejection rejects more than 30 request IDs'
);
select throws_ok(
    $$ select public.approve_docs_requests(
        '[{"requestId":910001,"duem":true},
          {"requestId":910001,"duem":false}]'::jsonb
    ) $$,
    'P0001', 'DOCS_REQUEST_MODERATION_INVALID_INPUT',
    'approval rejects duplicate request IDs'
);
select throws_ok(
    $$ select public.reject_docs_requests('[910002,910002]'::jsonb) $$,
    'P0001', 'DOCS_REQUEST_MODERATION_INVALID_INPUT',
    'rejection rejects duplicate request IDs'
);
select throws_ok(
    $$ select public.approve_docs_requests(
        '[{"requestId":9007199254740992,"duem":false}]'::jsonb
    ) $$,
    'P0001', 'DOCS_REQUEST_MODERATION_INVALID_INPUT',
    'approval rejects an ID above the JavaScript safe-integer range'
);
select throws_ok(
    $$ select public.reject_docs_requests('[0]'::jsonb) $$,
    'P0001', 'DOCS_REQUEST_MODERATION_INVALID_INPUT',
    'rejection rejects an ID below the allowed range'
);
select throws_ok(
    $$ select public.approve_docs_requests(
        '[{"requestId":910001,"duem":"true"}]'::jsonb
    ) $$,
    'P0001', 'DOCS_REQUEST_MODERATION_INVALID_INPUT',
    'approval rejects a malformed selection'
);
select throws_ok(
    $$ select public.approve_docs_requests(
        '[{"requestId":910001,"duem":true,"extra":1}]'::jsonb
    ) $$,
    'P0001', 'DOCS_REQUEST_MODERATION_INVALID_INPUT',
    'approval rejects unknown selection fields'
);
select throws_ok(
    $$ select public.reject_docs_requests('["910002"]'::jsonb) $$,
    'P0001', 'DOCS_REQUEST_MODERATION_INVALID_INPUT',
    'rejection rejects a malformed request ID'
);
select throws_ok(
    $$ select public.reject_docs_requests('{}'::jsonb) $$,
    'P0001', 'DOCS_REQUEST_MODERATION_INVALID_INPUT',
    'rejection rejects a non-array payload'
);
select throws_ok(
    $$ select public.approve_docs_requests(
        '[{"requestId":919999,"duem":false}]'::jsonb
    ) $$,
    'P0001', 'DOCS_REQUEST_MODERATION_CONFLICT',
    'approval conflicts when a selected request is missing'
);
select throws_ok(
    $$ select public.reject_docs_requests('[919999]'::jsonb) $$,
    'P0001', 'DOCS_REQUEST_MODERATION_CONFLICT',
    'rejection conflicts when a selected request is missing'
);
reset role;

set local role authenticated;
create temporary table docs_moderation_approval_result (result jsonb not null);
insert into docs_moderation_approval_result (result)
select public.approve_docs_requests(
    '[{"requestId": 910001, "duem": true}]'::jsonb
);
reset role;

select is(
    (select result ->> 'processedRequestCount'
     from docs_moderation_approval_result),
    '1'
);
select is(
    (select result -> 'processedRequestIds'
     from docs_moderation_approval_result),
    '[910001]'::jsonb,
    'approval returns sorted processed request IDs'
);
select ok(
    exists (
        select 1 from public.docs
        where name = 'docs-request-moderation-test-a'
          and duem is true
          and typez = 'letter'
    ),
    'approval creates the requested docs row'
);
select is(
    (select maker from public.docs
     where name = 'docs-request-moderation-test-a'),
    '43000000-0000-4000-8000-000000000003'::uuid,
    'approval trusts the requester stored on the locked wait row'
);
select ok(
    not exists (select 1 from public.docs_wait where id = 910001),
    'approval removes the wait row in the same transaction'
);

set local role authenticated;
create temporary table docs_moderation_rejection_result (result jsonb not null);
insert into docs_moderation_rejection_result (result)
select public.reject_docs_requests('[910006,910005]'::jsonb);
reset role;

select is(
    (select result from docs_moderation_rejection_result),
    '{"processedRequestIds":[910005,910006],"processedRequestCount":2}'::jsonb,
    'rejection returns sorted IDs and the literal processed count'
);
select ok(
    not exists (
        select 1 from public.docs_wait where id in (910005, 910006)
    )
    and not exists (
        select 1 from public.docs
        where name in (
            'docs-request-moderation-test-reject-a',
            'docs-request-moderation-test-reject-b'
        )
    ),
    'rejection removes only the selected wait rows'
);

set local role authenticated;
select throws_ok(
    $$ select public.approve_docs_requests(
        '[{"requestId":910004,"duem":false},
          {"requestId":910003,"duem":true}]'::jsonb
    ) $$,
    'P0001', 'DOCS_REQUEST_MODERATION_INTERNAL_ERROR',
    'a unique docs-name failure maps to the stable internal error'
);
reset role;
select ok(
    exists (select 1 from public.docs_wait where id = 910003)
    and exists (select 1 from public.docs_wait where id = 910004)
    and not exists (
        select 1 from public.docs
        where name = 'docs-request-moderation-test-rollback-clean'
    ),
    'later approval failure rolls back the earlier insert and both wait rows'
);

delete from public.docs
where name like 'docs-request-moderation-test-%';
delete from public.docs_wait where id between 910001 and 910010;
delete from public.users where id in (
    '43000000-0000-4000-8000-000000000001',
    '43000000-0000-4000-8000-000000000002',
    '43000000-0000-4000-8000-000000000003'
);
delete from auth.users where id in (
    '43000000-0000-4000-8000-000000000001',
    '43000000-0000-4000-8000-000000000002',
    '43000000-0000-4000-8000-000000000003'
);

select * from finish();
rollback;

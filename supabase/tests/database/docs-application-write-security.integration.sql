begin;

create or replace function pg_temp.set_docs_write_actor(actor_id uuid)
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

insert into auth.users (id) values
    ('47000000-0000-4000-8000-000000000001'),
    ('47000000-0000-4000-8000-000000000002'),
    ('47000000-0000-4000-8000-000000000003');

insert into public.users (id, nickname, role) values
    ('47000000-0000-4000-8000-000000000001',
     'docs-write-authorized', 'r4'),
    ('47000000-0000-4000-8000-000000000002',
     'docs-write-other', 'r1'),
    ('47000000-0000-4000-8000-000000000003',
     'docs-write-admin', 'admin');

select no_plan();

select pg_temp.set_docs_write_actor(
    '47000000-0000-4000-8000-000000000001'
);
set local role authenticated;

insert into public.docs (name, typez)
values ('docs-write-ordinary', 'ect');

select is(
    (select reference_code from public.docs
      where name = 'docs-write-ordinary'),
    null,
    'an authorized app user can create an ordinary docs row with a null semantic reference'
);

select throws_ok(
    $$ insert into public.docs (name, typez, reference_code)
       values ('docs-write-semantic-spoof', 'ect', 'test.app.spoof') $$,
    '42501',
    null,
    'an app user cannot supply a non-null docs semantic reference'
);

select is(
    (select count(*)::integer from public.docs
      where name = 'docs-write-semantic-spoof'),
    0,
    'the rejected semantic-reference insert leaves no docs row'
);

insert into public.docs_wait (docs_name, req_by) values (
    '가', '47000000-0000-4000-8000-000000000001'
);

select is(
    (select req_by from public.docs_wait where docs_name = '가'),
    '47000000-0000-4000-8000-000000000001'::uuid,
    'a docs creation request can identify the authenticated requester'
);

select throws_ok(
    $$ insert into public.docs_wait (docs_name, req_by) values (
           '나', '47000000-0000-4000-8000-000000000002'
       ) $$,
    '42501',
    null,
    'a docs creation request cannot spoof another requester UUID'
);

select is(
    (select count(*)::integer from public.docs_wait
      where docs_name = '나'),
    0,
    'the rejected cross-user request leaves no docs_wait row'
);

reset role;

select pg_temp.set_docs_write_actor(
    '47000000-0000-4000-8000-000000000003'
);
set local role authenticated;

select lives_ok(
    $$ insert into public.docs (name, typez)
       values ('docs-write-admin-ordinary', 'ect') $$,
    'an authenticated admin can insert an ordinary docs row'
);

select is(
    (select reference_code from public.docs
      where name = 'docs-write-admin-ordinary'),
    null,
    'an authenticated admin can create an ordinary docs row with a null semantic reference'
);

select throws_ok(
    $$ insert into public.docs (name, typez, reference_code)
       values ('docs-write-admin-semantic-spoof', 'ect', 'test.admin.spoof') $$,
    '42501',
    null,
    'an authenticated admin cannot supply a non-null docs semantic reference'
);

select is(
    (select count(*)::integer from public.docs
      where name = 'docs-write-admin-semantic-spoof'),
    0,
    'the rejected admin semantic-reference insert leaves no docs row'
);

reset role;

select pg_temp.set_docs_write_actor(
    '47000000-0000-4000-8000-000000000002'
);
set local role authenticated;

select throws_ok(
    $$ insert into public.docs (name, typez)
       values ('docs-write-r1-ordinary', 'ect') $$,
    '42501',
    null,
    'an authenticated r1 user cannot create an ordinary docs row'
);

select is(
    (select count(*)::integer from public.docs
      where name = 'docs-write-r1-ordinary'),
    0,
    'the rejected r1 insert leaves no docs row'
);

reset role;

select * from finish();
rollback;

begin;

create or replace function pg_temp.set_docs_favorite_actor(actor_id uuid)
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
    ('48000000-0000-4000-8000-000000000001'),
    ('48000000-0000-4000-8000-000000000002');

insert into public.users (id, nickname, role) values
    ('48000000-0000-4000-8000-000000000001', 'docs-favorite-owner', 'r1'),
    ('48000000-0000-4000-8000-000000000002', 'docs-favorite-other', 'r1');

insert into public.docs (name, typez) values
    ('docs-favorite-existing', 'ect'),
    ('docs-favorite-failure', 'ect');

select no_plan();

select ok(
    (
        select routine.prosecdef
        from pg_catalog.pg_proc as routine
        where routine.oid =
            'public.set_docs_favorite(bigint,boolean)'::pg_catalog.regprocedure
    ),
    'the docs favorite RPC is a security definer function'
);
select is(
    (
        select pg_catalog.array_to_string(routine.proconfig, ',')
        from pg_catalog.pg_proc as routine
        where routine.oid =
            'public.set_docs_favorite(bigint,boolean)'::pg_catalog.regprocedure
    ),
    'search_path=""',
    'the docs favorite RPC uses an empty search path'
);
select ok(
    pg_catalog.has_function_privilege(
        'authenticated',
        'public.set_docs_favorite(bigint,boolean)',
        'EXECUTE'
    ),
    'authenticated users can execute the docs favorite RPC'
);
select ok(
    pg_catalog.has_function_privilege(
        'anon', 'public.set_docs_favorite(bigint,boolean)', 'EXECUTE'
    ),
    'anonymous browser callers can reach the RPC authentication check'
);
select ok(
    not exists (
        select 1
        from pg_catalog.pg_proc as routine
        cross join lateral pg_catalog.aclexplode(
            coalesce(
                routine.proacl,
                pg_catalog.acldefault('f', routine.proowner)
            )
        ) as privilege
        where routine.oid =
            'public.set_docs_favorite(bigint,boolean)'::pg_catalog.regprocedure
          and privilege.grantee = 0
          and privilege.privilege_type = 'EXECUTE'
    ),
    'public does not receive docs favorite RPC execution'
);
select ok(
    pg_catalog.has_table_privilege('anon', 'public.user_star_docs', 'SELECT')
    and not pg_catalog.has_table_privilege('anon', 'public.user_star_docs', 'INSERT')
    and not pg_catalog.has_table_privilege('anon', 'public.user_star_docs', 'UPDATE')
    and not pg_catalog.has_table_privilege('anon', 'public.user_star_docs', 'DELETE')
    and not pg_catalog.has_table_privilege('anon', 'public.user_star_docs', 'TRUNCATE')
    and not pg_catalog.has_table_privilege('anon', 'public.user_star_docs', 'REFERENCES')
    and not pg_catalog.has_table_privilege('anon', 'public.user_star_docs', 'TRIGGER'),
    'anon retains only required SELECT access on user_star_docs'
);
select ok(
    pg_catalog.has_table_privilege('authenticated', 'public.user_star_docs', 'SELECT')
    and not pg_catalog.has_table_privilege('authenticated', 'public.user_star_docs', 'INSERT')
    and not pg_catalog.has_table_privilege('authenticated', 'public.user_star_docs', 'UPDATE')
    and not pg_catalog.has_table_privilege('authenticated', 'public.user_star_docs', 'DELETE')
    and not pg_catalog.has_table_privilege('authenticated', 'public.user_star_docs', 'TRUNCATE')
    and not pg_catalog.has_table_privilege('authenticated', 'public.user_star_docs', 'REFERENCES')
    and not pg_catalog.has_table_privilege('authenticated', 'public.user_star_docs', 'TRIGGER'),
    'authenticated retains only required SELECT access on user_star_docs'
);
select ok(
    not pg_catalog.has_sequence_privilege('anon', 'public.user_start_docs_id_seq', 'USAGE')
    and not pg_catalog.has_sequence_privilege('anon', 'public.user_start_docs_id_seq', 'SELECT')
    and not pg_catalog.has_sequence_privilege('anon', 'public.user_start_docs_id_seq', 'UPDATE')
    and not pg_catalog.has_sequence_privilege('authenticated', 'public.user_start_docs_id_seq', 'USAGE')
    and not pg_catalog.has_sequence_privilege('authenticated', 'public.user_start_docs_id_seq', 'SELECT')
    and not pg_catalog.has_sequence_privilege('authenticated', 'public.user_start_docs_id_seq', 'UPDATE'),
    'browser roles have no privilege on the user_star_docs identity sequence'
);

select pg_temp.set_docs_favorite_actor(null);
set local role anon;
select throws_ok(
    $$select public.set_docs_favorite(
        (select id from public.docs where name = 'docs-favorite-existing'),
        true
    )$$,
    'P0001', 'DOCS_FAVORITE_UNAUTHORIZED',
    'the anon RPC call reaches and fails the authentication check'
);
reset role;
select is(
    (
        select count(*)::integer
        from public.user_star_docs
        where docs_id = (
            select id from public.docs where name = 'docs-favorite-existing'
        )
    ),
    0,
    'the rejected anon RPC call creates no favorite row'
);

select pg_temp.set_docs_favorite_actor(
    '48000000-0000-4000-8000-000000000001'
);
set local role authenticated;

select lives_ok(
    $$select public.set_docs_favorite(
        (select id from public.docs where name = 'docs-favorite-existing'),
        true
    )$$,
    'the owner can set an existing docs as starred'
);
select lives_ok(
    $$select public.set_docs_favorite(
        (select id from public.docs where name = 'docs-favorite-existing'),
        true
    )$$,
    'repeating desired starred state succeeds idempotently'
);
select is(
    (
        select count(*)::integer
        from public.user_star_docs
        where docs_id = (
            select id from public.docs where name = 'docs-favorite-existing'
        )
          and user_id = '48000000-0000-4000-8000-000000000001'::uuid
    ),
    1,
    'repeated true creates exactly one caller-owned favorite row'
);

select throws_ok(
    $$select public.set_docs_favorite(9223372036854775807, true)$$,
    'P0001', 'DOCS_FAVORITE_NOT_FOUND',
    'starring a missing docs returns the public not-found code'
);
select throws_ok(
    $$select public.set_docs_favorite(9223372036854775807, false)$$,
    'P0001', 'DOCS_FAVORITE_NOT_FOUND',
    'unstarring a missing docs returns the same public not-found code'
);
reset role;

select pg_temp.set_docs_favorite_actor(
    '48000000-0000-4000-8000-000000000002'
);
set local role authenticated;
select public.set_docs_favorite(
    (select id from public.docs where name = 'docs-favorite-existing'),
    true
);
reset role;

select pg_temp.set_docs_favorite_actor(
    '48000000-0000-4000-8000-000000000001'
);
set local role authenticated;
select lives_ok(
    $$select public.set_docs_favorite(
        (select id from public.docs where name = 'docs-favorite-existing'),
        false
    )$$,
    'the owner can set an existing docs as unstarred'
);
select lives_ok(
    $$select public.set_docs_favorite(
        (select id from public.docs where name = 'docs-favorite-existing'),
        false
    )$$,
    'repeating desired unstarred state succeeds idempotently'
);
select is(
    (
        select count(*)::integer
        from public.user_star_docs
        where docs_id = (
            select id from public.docs where name = 'docs-favorite-existing'
        )
          and user_id = '48000000-0000-4000-8000-000000000001'::uuid
    ),
    0,
    'repeated false leaves no caller-owned favorite row'
);
select is(
    (
        select count(*)::integer
        from public.user_star_docs
        where docs_id = (
            select id from public.docs where name = 'docs-favorite-existing'
        )
          and user_id = '48000000-0000-4000-8000-000000000002'::uuid
    ),
    1,
    'unstarring deletes only the authenticated caller row'
);

reset role;

create function pg_temp.fail_docs_favorite_insert()
returns trigger
language plpgsql
as $function$
begin
    if new.docs_id = (
        select id from public.docs where name = 'docs-favorite-failure'
    ) then
        raise exception 'PRIVATE_DOCS_FAVORITE_FAILURE';
    end if;
    return new;
end;
$function$;
create trigger docs_favorite_test_fail_insert
before insert on public.user_star_docs
for each row execute function pg_temp.fail_docs_favorite_insert();

select pg_temp.set_docs_favorite_actor(
    '48000000-0000-4000-8000-000000000001'
);
set local role authenticated;
select throws_ok(
    $$select public.set_docs_favorite(
        (select id from public.docs where name = 'docs-favorite-failure'),
        true
    )$$,
    'P0001', 'DOCS_FAVORITE_INTERNAL_ERROR',
    'unexpected database failures map to a stable public infrastructure code'
);
reset role;

select * from finish();
rollback;

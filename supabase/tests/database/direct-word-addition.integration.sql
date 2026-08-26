begin;

create function pg_temp.set_direct_addition_actor(actor_id uuid)
returns void
language plpgsql
as $function$
begin
    perform pg_catalog.set_config('request.jwt.claim.sub', coalesce(actor_id::text, ''), true);
    perform pg_catalog.set_config(
        'request.jwt.claims',
        case when actor_id is null then '{}'
             else pg_catalog.jsonb_build_object('sub', actor_id::text, 'role', 'authenticated')::text
        end,
        true
    );
end;
$function$;

insert into auth.users (id) values
    ('4a000000-0000-4000-8000-000000000001'),
    ('4a000000-0000-4000-8000-000000000002'),
    ('4a000000-0000-4000-8000-000000000003');
insert into public.users (id, nickname, role) values
    ('4a000000-0000-4000-8000-000000000001', 'direct-add-admin', 'admin'),
    ('4a000000-0000-4000-8000-000000000002', 'direct-add-r4', 'r4'),
    ('4a000000-0000-4000-8000-000000000003', 'direct-add-user', 'r1');

insert into public.themes (code, name) values
    ('direct-add-theme-a', 'direct-add-theme-a'),
    ('direct-add-theme-b', 'direct-add-theme-b'),
    ('0', 'direct-add-noinjung')
on conflict (code) do nothing;
insert into public.docs (id, name, typez, last_update) values
    (946001, 'direct-add-theme-a', 'theme', '2000-01-01'),
    (946002, 'Ω', 'letter', '2000-01-01'),
    (946003, 'direct-add-unrelated', 'theme', '2000-01-01');

select no_plan();

select pg_temp.set_direct_addition_actor(null);
select throws_ok(
    $$select public.add_word_directly('anonymousΩ', array[]::text[])$$,
    'P0001', 'DIRECT_WORD_ADDITION_UNAUTHORIZED',
    'anonymous callers are rejected'
);
select ok(
    not pg_catalog.has_function_privilege(
        'anon', 'public.add_word_directly(text,text[])', 'EXECUTE'
    ),
    'anon cannot execute direct addition'
);
select ok(
    pg_catalog.has_function_privilege(
        'authenticated', 'public.add_word_directly(text,text[])', 'EXECUTE'
    ) and pg_catalog.has_function_privilege(
        'service_role', 'public.add_word_directly(text,text[])', 'EXECUTE'
    ),
    'authenticated and service roles have the intentional execute privilege'
);
select is(
    (select pg_catalog.array_to_string(routine.proconfig, ',')
     from pg_catalog.pg_proc as routine
     where routine.oid = 'public.add_word_directly(text,text[])'::pg_catalog.regprocedure),
    'search_path=""',
    'the security definer RPC uses an empty search path'
);

select pg_temp.set_direct_addition_actor('4a000000-0000-4000-8000-000000000003');
set local role authenticated;
select throws_ok(
    $$select public.add_word_directly('regularΩ', array[]::text[])$$,
    'P0001', 'DIRECT_WORD_ADDITION_FORBIDDEN',
    'regular authenticated users cannot add directly'
);
reset role;

select pg_temp.set_direct_addition_actor('4a000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok(
    $$select public.add_word_directly(' ', array[]::text[])$$,
    'P0001', 'DIRECT_WORD_ADDITION_INVALID_INPUT',
    'blank words are rejected'
);
select throws_ok(
    $$select public.add_word_directly('invalid-themeΩ', array['missing-theme'])$$,
    'P0001', 'DIRECT_WORD_ADDITION_INVALID_THEME',
    'unknown themes are rejected'
);
reset role;
select ok(
    not exists (select 1 from public.words where word = 'invalid-themeΩ')
    and not exists (select 1 from public.logs where word = 'invalid-themeΩ')
    and not exists (select 1 from public.docs_logs where word = 'invalid-themeΩ'),
    'invalid themes roll back every addition effect'
);

set local role authenticated;
create temporary table direct_add_admin_result as
select public.add_word_directly(
    ' atomicΩ ', array['direct-add-theme-a', '0']
) as result;
reset role;
select is((select result ->> 'word' from direct_add_admin_result), 'atomicΩ',
    'the RPC trims and returns the normalized word');
select is((select (result ->> 'noinCanUse')::boolean from direct_add_admin_result), true,
    'the database derives noin_canuse from the selected theme codes');
select is((select pg_catalog.jsonb_array_length(result -> 'themeIds') from direct_add_admin_result), 2,
    'the RPC returns both resolved theme IDs');
select is((select result -> 'affectedDocsIds' from direct_add_admin_result), '[946001, 946002]'::jsonb,
    'the RPC returns unique sorted ordinary docs effects');
select is((select pg_catalog.count(*)::integer from public.words where word = 'atomicΩ'), 1,
    'the word is inserted exactly once');
select is((select pg_catalog.count(*)::integer
    from public.word_themes as relation
    join public.words as word_row on word_row.id = relation.word_id
    where word_row.word = 'atomicΩ'), 2,
    'all selected theme relations are inserted');
select is((select pg_catalog.count(*)::integer from public.logs
    where word = 'atomicΩ'
      and make_by = '4a000000-0000-4000-8000-000000000001'
      and processed_by = '4a000000-0000-4000-8000-000000000001'
      and r_type = 'add' and state = 'approved'), 1,
    'one authoritative approved word log uses the database actor');
select ok(
    (select pg_catalog.count(*) = 2
       and pg_catalog.count(distinct docs_id) = 2
     from public.docs_logs
     where word = 'atomicΩ' and type = 'add' and docs_id in (946001, 946002)),
    'one direct docs log is written for each unique ordinary docs effect'
);
select is((select pg_catalog.count(*)::integer from public.docs_logs
    where word = 'atomicΩ' and docs_id = 946003), 0,
    'unrelated docs receive no log');
select ok((select pg_catalog.bool_and(last_update > '2000-01-01')
    from public.docs where id in (946001, 946002)),
    'every directly affected docs timestamp changes');

set local role authenticated;
select throws_ok(
    $$select public.add_word_directly('atomicΩ', array['direct-add-theme-b'])$$,
    'P0001', 'DIRECT_WORD_ADDITION_DUPLICATE',
    'an existing normalized word returns the stable duplicate code'
);
reset role;
select is((select pg_catalog.count(*)::integer from public.words where word = 'atomicΩ'), 1,
    'duplicate failure leaves the original word unchanged');
select is((select pg_catalog.count(*)::integer from public.logs where word = 'atomicΩ'), 1,
    'duplicate failure writes no additional word log');

select pg_temp.set_direct_addition_actor('4a000000-0000-4000-8000-000000000002');
set local role authenticated;
select lives_ok(
    $$select public.add_word_directly('r4-word', array['direct-add-theme-b'])$$,
    'r4 users are authorized by the database role lookup'
);
reset role;
select is((select added_by from public.words where word = 'r4-word'),
    '4a000000-0000-4000-8000-000000000002'::uuid,
    'the r4 addition actor comes from auth.uid()');

create function pg_temp.fail_direct_addition_log()
returns trigger
language plpgsql
as $function$
begin
    if new.word = 'rollbackΩ' then
        raise exception 'SENSITIVE_FORCED_FAILURE';
    end if;
    return new;
end;
$function$;
create trigger direct_addition_test_fail_log
before insert on public.logs
for each row execute function pg_temp.fail_direct_addition_log();
select pg_temp.set_direct_addition_actor('4a000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok(
    $$select public.add_word_directly('rollbackΩ', array['direct-add-theme-a'])$$,
    'P0001', 'DIRECT_WORD_ADDITION_INTERNAL_ERROR',
    'unexpected database failures map to the stable internal code'
);
reset role;
drop trigger direct_addition_test_fail_log on public.logs;
select ok(
    not exists (select 1 from public.words where word = 'rollbackΩ')
    and not exists (select 1 from public.logs where word = 'rollbackΩ')
    and not exists (select 1 from public.docs_logs where word = 'rollbackΩ'),
    'unexpected failures roll back the word, relations, and all logs'
);

select * from finish();
rollback;

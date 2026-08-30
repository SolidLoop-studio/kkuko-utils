begin;

create or replace function pg_temp.set_direct_deletion_actor(actor_id uuid)
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
    ('43000000-0000-4000-8000-000000000001'),
    ('43000000-0000-4000-8000-000000000002'),
    ('43000000-0000-4000-8000-000000000003');

insert into public.users (id, nickname, role) values
    ('43000000-0000-4000-8000-000000000001',
     'direct-deletion-admin', 'admin'),
    ('43000000-0000-4000-8000-000000000002',
     'direct-deletion-r4', 'r4'),
    ('43000000-0000-4000-8000-000000000003',
     'direct-deletion-user', 'r1');

insert into public.themes (code, name) values
    ('direct-delete-theme', 'direct-delete-theme'),
    ('direct-delete-reference', 'direct-delete-reference'),
    ('direct-delete-rollback', 'direct-delete-rollback');

insert into public.docs (id, name, typez, last_update) values
    (942001, 'direct-delete-theme', 'theme', '2000-01-01'),
    (942002, 'e', 'letter', '2000-01-01'),
    (942003, 'direct-delete-reference', 'theme', '2000-01-01'),
    (942004, 'x', 'letter', '2000-01-01'),
    (942005, 'direct-delete-rollback', 'theme', '2000-01-01'),
    (942006, 'q', 'letter', '2000-01-01');

insert into public.docs (id, name, typez, last_update) values
    (201, 'direct-delete-special-201', 'ect', '2000-01-01'),
    (202, 'direct-delete-special-202', 'ect', '2000-01-01'),
    (209, 'direct-delete-special-209', 'ect', '2000-01-01'),
    (252, 'direct-delete-special-252', 'ect', '2000-01-01')
on conflict (id) do nothing;
update public.docs
set last_update = '2000-01-01'
where id in (201, 202, 209, 252);

insert into public.words (word, k_canuse, noin_canuse, added_by) values
    ('direct-delete-fixture', true, true,
     '43000000-0000-4000-8000-000000000003'),
    ('direct-delete-rollback-x', true, false,
     '43000000-0000-4000-8000-000000000003');

create temporary table direct_deletion_fixture_ids (
    fixture text primary key,
    word_id bigint not null
);
insert into direct_deletion_fixture_ids (fixture, word_id)
select word_row.word, word_row.id
from public.words as word_row
where word_row.word in (
    'direct-delete-fixture', 'direct-delete-rollback-x'
);
grant select on direct_deletion_fixture_ids to authenticated;

insert into public.word_themes (word_id, theme_id)
select word_row.id, theme.id
from public.words as word_row
join public.themes as theme on
    (word_row.word = 'direct-delete-fixture'
     and theme.code = 'direct-delete-theme')
    or (word_row.word = 'direct-delete-rollback-x'
        and theme.code = 'direct-delete-rollback');

insert into public.wait_words (
    word, word_id, requested_by, request_type
)
select word_row.word, word_row.id,
       '43000000-0000-4000-8000-000000000003', 'delete'
from public.words as word_row
where word_row.word in (
    'direct-delete-fixture', 'direct-delete-rollback-x'
);

insert into public.wait_word_themes (wait_word_id, theme_id)
select wait_word.id, theme.id
from public.wait_words as wait_word
join public.themes as theme on
    (wait_word.word = 'direct-delete-fixture'
     and theme.code = 'direct-delete-theme')
    or (wait_word.word = 'direct-delete-rollback-x'
        and theme.code = 'direct-delete-rollback');

insert into public.word_themes_wait (word_id, theme_id, req_by, typez)
select word_row.id, theme.id,
       '43000000-0000-4000-8000-000000000003', 'add'
from public.words as word_row
join public.themes as theme
  on theme.code = 'direct-delete-reference'
where word_row.word in (
    'direct-delete-fixture', 'direct-delete-rollback-x'
);

select no_plan();

select pg_temp.set_direct_deletion_actor(null);
select throws_ok(
    $$select public.delete_word_directly(1)$$,
    'P0001',
    'DIRECT_WORD_DELETION_UNAUTHORIZED',
    'anonymous direct deletion is rejected'
);

select ok(
    not pg_catalog.has_function_privilege(
        'anon', 'public.delete_word_directly(bigint)', 'EXECUTE'
    ),
    'anon cannot execute direct deletion'
);
select ok(
    pg_catalog.has_function_privilege(
        'authenticated', 'public.delete_word_directly(bigint)', 'EXECUTE'
    )
    and pg_catalog.has_function_privilege(
        'service_role', 'public.delete_word_directly(bigint)', 'EXECUTE'
    ),
    'authenticated and service_role can execute direct deletion'
);
select is(
    (
        select pg_catalog.array_to_string(routine.proconfig, ',')
        from pg_catalog.pg_proc as routine
        where routine.oid =
            'public.delete_word_directly(bigint)'::pg_catalog.regprocedure
    ),
    'search_path=pg_catalog, public, pg_temp',
    'direct deletion uses the trusted search path'
);

select pg_temp.set_direct_deletion_actor(
    '43000000-0000-4000-8000-000000000003'
);
set local role authenticated;
select throws_ok(
    $$select public.delete_word_directly(
        (select id from public.words
         where word = 'direct-delete-fixture')
    )$$,
    'P0001',
    'DIRECT_WORD_DELETION_FORBIDDEN',
    'regular users cannot directly delete words'
);
reset role;

select pg_temp.set_direct_deletion_actor(
    '43000000-0000-4000-8000-000000000002'
);
set local role authenticated;
select throws_ok(
    $$select public.delete_word_directly(
        (select id from public.words
         where word = 'direct-delete-fixture')
    )$$,
    'P0001',
    'DIRECT_WORD_DELETION_FORBIDDEN',
    'r4 users cannot directly delete words'
);
reset role;

select pg_temp.set_direct_deletion_actor(
    '43000000-0000-4000-8000-000000000001'
);
set local role authenticated;
select throws_ok(
    $$select public.delete_word_directly(null)$$,
    'P0001',
    'DIRECT_WORD_DELETION_INVALID_INPUT',
    'null word IDs are rejected'
);
select throws_ok(
    $$select public.delete_word_directly(0)$$,
    'P0001',
    'DIRECT_WORD_DELETION_INVALID_INPUT',
    'non-positive word IDs are rejected'
);
reset role;

set local role authenticated;
select is(
    public.delete_word_directly(
        (select id from public.words where word = 'direct-delete-fixture')
    ),
    '{"affectedDocsIds":[942001,942002],"deletedWordCount":1}'::jsonb,
    'admin direct deletion returns authoritative sorted docs IDs'
);
reset role;

select is(
    (select pg_catalog.count(*)::integer
     from public.logs
     where word = 'direct-delete-fixture'
       and make_by = '43000000-0000-4000-8000-000000000001'
       and processed_by = '43000000-0000-4000-8000-000000000001'
       and r_type = 'delete'
       and state = 'approved'),
    1,
    'direct deletion preserves one authoritative approved word log'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.logs
     where word = 'direct-delete-fixture'),
    1,
    'direct deletion produces no extra word logs'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.docs_logs
     where word = 'direct-delete-fixture'
       and docs_id = 942001
       and add_by = '43000000-0000-4000-8000-000000000001'
       and type = 'delete'),
    1,
    'direct deletion writes exactly one theme docs log per affected docs ID'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.docs_logs
     where word = 'direct-delete-fixture'
       and docs_id = 942002
       and add_by = '43000000-0000-4000-8000-000000000001'
       and type = 'delete'),
    1,
    'direct deletion writes exactly one letter docs log per affected docs ID'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.docs_logs
     where word = 'direct-delete-fixture'
       and docs_id = 942003
       and type = 'delete'),
    0,
    'direct deletion does not log unrelated reference docs'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.docs_logs
     where word = 'direct-delete-fixture'
       and docs_id in (201, 202)
       and add_by = '43000000-0000-4000-8000-000000000003'
       and type = 'delete'),
    2,
    'the word trigger owns one delete log for each special length doc'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.docs_logs
     where word = 'direct-delete-fixture'
       and docs_id in (209, 252)
       and type = 'delete'),
    0,
    'the RPC does not manually duplicate trigger-owned special docs logs'
);
select ok(
    (select pg_catalog.bool_and(document.last_update > '2000-01-01')
     from public.docs as document
     where document.id in (942001, 942002)),
    'direct deletion updates every directly affected docs timestamp'
);
select is(
    (select contribution from public.users
     where id = '43000000-0000-4000-8000-000000000001'),
    1,
    'direct deletion increments administrator lifetime contribution once'
);
select is(
    (select month_contribution from public.users
     where id = '43000000-0000-4000-8000-000000000001'),
    1,
    'direct deletion increments administrator monthly contribution once'
);
select is(
    (select contribution from public.users
     where id = '43000000-0000-4000-8000-000000000003'),
    0,
    'direct deletion does not credit the original word owner'
);
select ok(
    not exists (select 1 from public.words
                where word = 'direct-delete-fixture')
    and not exists (
        select 1 from public.word_themes as word_theme
        where word_theme.word_id = (
            select word_id from direct_deletion_fixture_ids
            where fixture = 'direct-delete-fixture'
        )
    )
    and not exists (
        select 1 from public.wait_words as wait_word
        where wait_word.word_id = (
            select word_id from direct_deletion_fixture_ids
            where fixture = 'direct-delete-fixture'
        )
    )
    and not exists (
        select 1 from public.wait_word_themes as wait_theme
        join public.wait_words as wait_word
          on wait_word.id = wait_theme.wait_word_id
        where wait_word.word = 'direct-delete-fixture'
    )
    and not exists (
        select 1 from public.word_themes_wait as wait_theme
        where wait_theme.word_id = (
            select word_id from direct_deletion_fixture_ids
            where fixture = 'direct-delete-fixture'
        )
    ),
    'word deletion cascades all word, theme, and request rows'
);

set local role authenticated;
select throws_ok(
    pg_catalog.format(
        'select public.delete_word_directly(%s)', fixture.word_id
    ),
    'P0001',
    'DIRECT_WORD_DELETION_CONFLICT',
    'a stale word ID returns conflict'
)
from direct_deletion_fixture_ids as fixture
where fixture.fixture = 'direct-delete-fixture';
reset role;

create temporary table direct_deletion_rollback_baseline as
select
    (select contribution from public.users
     where id = '43000000-0000-4000-8000-000000000001')
        as contribution,
    (select month_contribution from public.users
     where id = '43000000-0000-4000-8000-000000000001')
        as month_contribution,
    (select last_update from public.docs where id = 942004)
        as letter_last_update,
    (select last_update from public.docs where id = 942005)
        as theme_last_update;

create function pg_temp.fail_direct_deletion_log()
returns trigger
language plpgsql
as $function$
begin
    if new.word = 'direct-delete-rollback-x' then
        raise exception 'DIRECT_DELETION_TEST_FORCED_FAILURE';
    end if;
    return new;
end;
$function$;
create trigger direct_deletion_test_fail_log
before insert on public.logs
for each row execute function pg_temp.fail_direct_deletion_log();

set local role authenticated;
select throws_ok(
    pg_catalog.format(
        'select public.delete_word_directly(%s)', fixture.word_id
    ),
    'P0001',
    'DIRECT_WORD_DELETION_INTERNAL_ERROR',
    'unexpected log trigger failures map to the stable internal error'
)
from direct_deletion_fixture_ids as fixture
where fixture.fixture = 'direct-delete-rollback-x';
reset role;
drop trigger direct_deletion_test_fail_log on public.logs;

select ok(
    exists (select 1 from public.words
            where word = 'direct-delete-rollback-x')
    and exists (
        select 1 from public.word_themes as word_theme
        where word_theme.word_id = (
            select word_id from direct_deletion_fixture_ids
            where fixture = 'direct-delete-rollback-x'
        )
    ),
    'forced log failure preserves the word and its theme relation'
);
select ok(
    exists (select 1 from public.wait_words
            where word = 'direct-delete-rollback-x')
    and exists (
        select 1 from public.word_themes_wait as wait_theme
        where wait_theme.word_id = (
            select word_id from direct_deletion_fixture_ids
            where fixture = 'direct-delete-rollback-x'
        )
    ),
    'forced log failure preserves pending word and theme requests'
);
select ok(
    not exists (select 1 from public.logs
                where word = 'direct-delete-rollback-x')
    and not exists (select 1 from public.docs_logs
                    where word = 'direct-delete-rollback-x'
                      and type = 'delete'),
    'forced log failure leaves no word or docs deletion logs'
);
select ok(
    (select contribution from direct_deletion_rollback_baseline)
        = (select contribution from public.users
           where id = '43000000-0000-4000-8000-000000000001')
    and (select month_contribution from direct_deletion_rollback_baseline)
        = (select month_contribution from public.users
           where id = '43000000-0000-4000-8000-000000000001'),
    'forced log failure leaves administrator contribution unchanged'
);
select ok(
    (select letter_last_update from direct_deletion_rollback_baseline)
        = (select last_update from public.docs where id = 942004)
    and (select theme_last_update from direct_deletion_rollback_baseline)
        = (select last_update from public.docs where id = 942005),
    'forced log failure leaves affected docs timestamps unchanged'
);

select * from finish();
rollback;

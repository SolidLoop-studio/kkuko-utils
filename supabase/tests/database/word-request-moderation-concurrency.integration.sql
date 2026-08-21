create schema if not exists extensions;
create extension if not exists dblink with schema extensions;

create function pg_temp.moderation_connection_string()
returns text
language sql
stable
as $function$
    select pg_catalog.format(
        'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres',
        pg_catalog.current_database()
    );
$function$;

create function pg_temp.moderation_connect_authenticated(
    connection_name text,
    actor_id uuid
)
returns void
language plpgsql
as $function$
begin
    perform extensions.dblink_connect(
        connection_name, pg_temp.moderation_connection_string()
    );
    perform extensions.dblink_exec(connection_name, 'set role authenticated');
    perform extensions.dblink_exec(
        connection_name,
        pg_catalog.format('set request.jwt.claim.sub = %L', actor_id::text)
    );
    perform extensions.dblink_exec(
        connection_name,
        pg_catalog.format(
            'set request.jwt.claims = %L',
            pg_catalog.jsonb_build_object(
                'sub', actor_id::text, 'role', 'authenticated'
            )::text
        )
    );
end;
$function$;

select extensions.dblink_connect(
    'moderation_setup', pg_temp.moderation_connection_string()
);
select extensions.dblink_exec(
    'moderation_setup',
    $setup$
    begin;
    drop trigger if exists moderation_concurrency_pause_log on public.logs;
    drop function if exists public.moderation_concurrency_pause();
    drop function if exists public.moderation_concurrency_call(jsonb);
    delete from public.wait_word_themes where wait_word_id in (
        select id from public.wait_words
        where word = 'moderation-concurrency-fixture-c'
    );
    delete from public.wait_words
    where word = 'moderation-concurrency-fixture-c';
    delete from public.word_themes where word_id in (
        select id from public.words
        where word = 'moderation-concurrency-fixture-c'
    );
    delete from public.words
    where word = 'moderation-concurrency-fixture-c';
    delete from public.logs
    where word = 'moderation-concurrency-fixture-c';
    delete from public.docs_logs
    where word = 'moderation-concurrency-fixture-c';
    delete from public.docs
    where id in (942001, 942002)
      and name in ('moderation-concurrency-theme', 'c');
    delete from public.themes
    where code = 'moderation-concurrency-theme';
    delete from public.user_month_contributions where user_id in (
        '42000000-0000-4000-8000-000000000001',
        '42000000-0000-4000-8000-000000000002',
        '42000000-0000-4000-8000-000000000003'
    );
    delete from public.users where id in (
        '42000000-0000-4000-8000-000000000001',
        '42000000-0000-4000-8000-000000000002',
        '42000000-0000-4000-8000-000000000003'
    );
    delete from auth.users where id in (
        '42000000-0000-4000-8000-000000000001',
        '42000000-0000-4000-8000-000000000002',
        '42000000-0000-4000-8000-000000000003'
    );
    insert into auth.users (id) values
        ('42000000-0000-4000-8000-000000000001'),
        ('42000000-0000-4000-8000-000000000002'),
        ('42000000-0000-4000-8000-000000000003');
    insert into public.users (id, nickname, role) values
        ('42000000-0000-4000-8000-000000000001', 'moderation-concurrency-admin-a', 'admin'),
        ('42000000-0000-4000-8000-000000000002', 'moderation-concurrency-admin-b', 'admin'),
        ('42000000-0000-4000-8000-000000000003', 'moderation-concurrency-requester', 'r1');
    insert into public.themes (code, name)
    values ('moderation-concurrency-theme', 'moderation-concurrency-theme');
    insert into public.docs (id, name, typez, last_update) values
        (942001, 'moderation-concurrency-theme', 'theme', '2000-01-01'),
        (942002, 'c', 'letter', '2000-01-01');
    insert into public.wait_words (word, requested_by, request_type)
    values (
        'moderation-concurrency-fixture-c',
        '42000000-0000-4000-8000-000000000003', 'add'
    );
    insert into public.wait_word_themes (wait_word_id, theme_id)
    select wait_word.id, theme.id
    from public.wait_words as wait_word
    cross join public.themes as theme
    where wait_word.word = 'moderation-concurrency-fixture-c'
      and theme.code = 'moderation-concurrency-theme';

    create or replace function public.moderation_concurrency_call(
        p_selections jsonb
    )
    returns jsonb
    language plpgsql
    security invoker
    set search_path = pg_catalog, public, pg_temp
    as $function$
    begin
        return pg_catalog.jsonb_build_object(
            'status', 'success',
            'result', public.approve_word_requests(p_selections)
        );
    exception when others then
        return pg_catalog.jsonb_build_object(
            'status', 'error', 'message', sqlerrm
        );
    end;
    $function$;

    create or replace function public.moderation_concurrency_pause()
    returns trigger
    language plpgsql
    as $function$
    begin
        if new.word = 'moderation-concurrency-fixture-c' then
            perform pg_catalog.pg_advisory_xact_lock(942021, 1);
        end if;
        return new;
    end;
    $function$;
    create trigger moderation_concurrency_pause_log
    before insert on public.logs
    for each row execute function public.moderation_concurrency_pause();
    commit;
    $setup$
);

select pg_temp.moderation_connect_authenticated(
    'moderation_apply_a', '42000000-0000-4000-8000-000000000001'
);
select pg_temp.moderation_connect_authenticated(
    'moderation_apply_b', '42000000-0000-4000-8000-000000000002'
);
create temporary table moderation_connection_pids (pid integer primary key);
insert into moderation_connection_pids (pid)
select response.pid
from extensions.dblink(
    'moderation_apply_a', 'select pg_catalog.pg_backend_pid()'
) as response(pid integer);
insert into moderation_connection_pids (pid)
select response.pid
from extensions.dblink(
    'moderation_apply_b', 'select pg_catalog.pg_backend_pid()'
) as response(pid integer);
select extensions.dblink_exec(
    'moderation_setup',
    'do $lock$ begin perform pg_catalog.pg_advisory_lock(942021, 1); end $lock$;'
);

do $send$
declare
    selections jsonb;
begin
    select pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
            'kind', 'word-request',
            'requestId', wait_word.id,
            'selectedThemeIds', pg_catalog.jsonb_build_array(theme.id)
        )
    )
    into selections
    from public.wait_words as wait_word
    cross join public.themes as theme
    where wait_word.word = 'moderation-concurrency-fixture-c'
      and theme.code = 'moderation-concurrency-theme';
    perform extensions.dblink_send_query(
        'moderation_apply_a',
        pg_catalog.format(
            'select public.moderation_concurrency_call(%L::jsonb)',
            selections::text
        )
    );
    perform extensions.dblink_send_query(
        'moderation_apply_b',
        pg_catalog.format(
            'select public.moderation_concurrency_call(%L::jsonb)',
            selections::text
        )
    );
end;
$send$;

create temporary table moderation_overlap_observation (
    observed boolean not null
);
do $synchronize$
declare
    lock_wait_count integer := 0;
begin
    for attempt in 1..100 loop
        select pg_catalog.count(*)::integer into lock_wait_count
        from pg_catalog.pg_locks as held_lock
        where held_lock.pid in (
            select connection.pid from moderation_connection_pids as connection
        )
          and not held_lock.granted;
        exit when lock_wait_count = 2;
        perform pg_catalog.pg_sleep(0.05);
    end loop;
    insert into moderation_overlap_observation
    values (lock_wait_count = 2);
    perform extensions.dblink_exec(
        'moderation_setup',
        'do $unlock$ begin perform pg_catalog.pg_advisory_unlock(942021, 1); end $unlock$;'
    );
end;
$synchronize$;

select no_plan();

select ok(
    (select observed from moderation_overlap_observation),
    'two committed authenticated sessions overlap at real lock contention'
);

create temporary table moderation_concurrent_results (result jsonb not null);
insert into moderation_concurrent_results (result)
select response.result
from extensions.dblink_get_result('moderation_apply_a', false)
    as response(result jsonb);
insert into moderation_concurrent_results (result)
select response.result
from extensions.dblink_get_result('moderation_apply_b', false)
    as response(result jsonb);
select response.result
from extensions.dblink_get_result('moderation_apply_a', false)
    as response(result jsonb);
select response.result
from extensions.dblink_get_result('moderation_apply_b', false)
    as response(result jsonb);

select is(
    (select pg_catalog.count(*)::integer
     from moderation_concurrent_results
     where result ->> 'status' = 'success'),
    1,
    'exactly one concurrent moderation transaction succeeds'
);
select is(
    (select pg_catalog.count(*)::integer
     from moderation_concurrent_results
     where result ->> 'status' = 'error'
       and result ->> 'message' = 'WORD_REQUEST_MODERATION_CONFLICT'),
    1,
    'the losing concurrent moderation transaction returns conflict'
);
select is(
    (select pg_catalog.count(*)::integer from public.words
     where word = 'moderation-concurrency-fixture-c'),
    1,
    'concurrent approval inserts the word exactly once'
);
select is(
    (select pg_catalog.count(*)::integer from public.logs
     where word = 'moderation-concurrency-fixture-c'
       and state = 'approved'),
    1,
    'concurrent approval writes exactly one moderation log'
);
select is(
    (select pg_catalog.count(*)::integer from public.docs_logs
     where word = 'moderation-concurrency-fixture-c'
       and docs_id in (942001, 942002)),
    2,
    'concurrent approval writes one set of direct docs logs'
);
select is(
    (select contribution from public.users
     where id = '42000000-0000-4000-8000-000000000003'),
    1,
    'concurrent approval increments the requester exactly once'
);

do $disconnect$
begin
    perform extensions.dblink_disconnect('moderation_apply_a');
    perform extensions.dblink_disconnect('moderation_apply_b');
end;
$disconnect$;

select extensions.dblink_exec(
    'moderation_setup',
    $cleanup$
    begin;
    drop trigger moderation_concurrency_pause_log on public.logs;
    drop function public.moderation_concurrency_pause();
    drop function public.moderation_concurrency_call(jsonb);
    delete from public.wait_word_themes where wait_word_id in (
        select id from public.wait_words
        where word = 'moderation-concurrency-fixture-c'
    );
    delete from public.wait_words
    where word = 'moderation-concurrency-fixture-c';
    delete from public.word_themes where word_id in (
        select id from public.words
        where word = 'moderation-concurrency-fixture-c'
    );
    delete from public.words
    where word = 'moderation-concurrency-fixture-c';
    delete from public.logs
    where word = 'moderation-concurrency-fixture-c';
    delete from public.docs_logs
    where word = 'moderation-concurrency-fixture-c';
    delete from public.docs
    where id in (942001, 942002)
      and name in ('moderation-concurrency-theme', 'c');
    delete from public.themes
    where code = 'moderation-concurrency-theme';
    delete from public.user_month_contributions where user_id in (
        '42000000-0000-4000-8000-000000000001',
        '42000000-0000-4000-8000-000000000002',
        '42000000-0000-4000-8000-000000000003'
    );
    delete from public.users where id in (
        '42000000-0000-4000-8000-000000000001',
        '42000000-0000-4000-8000-000000000002',
        '42000000-0000-4000-8000-000000000003'
    );
    delete from auth.users where id in (
        '42000000-0000-4000-8000-000000000001',
        '42000000-0000-4000-8000-000000000002',
        '42000000-0000-4000-8000-000000000003'
    );
    commit;
    $cleanup$
);
select extensions.dblink_disconnect('moderation_setup');

select ok(
    not exists (select 1 from public.words
                where word = 'moderation-concurrency-fixture-c')
    and not exists (select 1 from public.logs
                    where word = 'moderation-concurrency-fixture-c')
    and not exists (select 1 from public.docs_logs
                    where word = 'moderation-concurrency-fixture-c')
    and pg_catalog.to_regprocedure(
        'public.moderation_concurrency_call(jsonb)'
    ) is null
    and not exists (
        select 1 from pg_catalog.pg_trigger
        where tgname = 'moderation_concurrency_pause_log'
          and not tgisinternal
    ),
    'concurrency cleanup leaves no fixtures or synchronization objects'
);

select * from finish();

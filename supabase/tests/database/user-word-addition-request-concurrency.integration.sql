create schema if not exists extensions;
create extension if not exists dblink with schema extensions;

create function pg_temp.word_addition_connection_string()
returns text
language sql
stable
as $function$
    select pg_catalog.format(
        'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres',
        pg_catalog.current_database()
    );
$function$;

create function pg_temp.connect_word_addition_actor(
    connection_name text,
    actor_id uuid
)
returns void
language plpgsql
as $function$
begin
    perform extensions.dblink_connect(
        connection_name,
        pg_temp.word_addition_connection_string()
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
                'sub', actor_id::text,
                'role', 'authenticated'
            )::text
        )
    );
end;
$function$;

select extensions.dblink_connect(
    'word_addition_setup',
    pg_temp.word_addition_connection_string()
);
select extensions.dblink_exec(
    'word_addition_setup',
    $setup$
    begin;
    delete from public.wait_words where word = 'addition-concurrency';
    delete from public.words where word = 'addition-concurrency';
    delete from public.themes where code in (
        'addition-concurrency-a', 'addition-concurrency-b'
    );
    delete from public.user_month_contributions where user_id in (
        '48000000-0000-4000-8000-000000000001',
        '48000000-0000-4000-8000-000000000002'
    );
    delete from public.users where id in (
        '48000000-0000-4000-8000-000000000001',
        '48000000-0000-4000-8000-000000000002'
    );
    delete from auth.users where id in (
        '48000000-0000-4000-8000-000000000001',
        '48000000-0000-4000-8000-000000000002'
    );
    insert into auth.users (id) values
        ('48000000-0000-4000-8000-000000000001'),
        ('48000000-0000-4000-8000-000000000002');
    insert into public.users (id, nickname, role) values
        ('48000000-0000-4000-8000-000000000001', 'addition-concurrency-a', 'r1'),
        ('48000000-0000-4000-8000-000000000002', 'addition-concurrency-b', 'r1');
    insert into public.themes (name, code) values
        ('동시 추가 주제 A', 'addition-concurrency-a'),
        ('동시 추가 주제 B', 'addition-concurrency-b');

    create or replace function public.word_addition_concurrency_call(p_word text)
    returns jsonb
    language plpgsql
    security invoker
    set search_path = ''
    as $function$
    begin
        return pg_catalog.jsonb_build_object(
            'status', 'success',
            'result', public.request_word_addition(
                p_word,
                array['addition-concurrency-b', 'addition-concurrency-a']
            )
        );
    exception when others then
        return pg_catalog.jsonb_build_object(
            'status', 'error',
            'message', sqlerrm
        );
    end;
    $function$;

    create or replace function public.word_addition_concurrency_pause()
    returns trigger
    language plpgsql
    set search_path = ''
    as $function$
    begin
        if new.word = 'addition-concurrency' then
            perform pg_catalog.pg_advisory_xact_lock(948024, 1);
        end if;
        return new;
    end;
    $function$;
    create trigger word_addition_concurrency_pause_insert
    before insert on public.wait_words
    for each row execute function public.word_addition_concurrency_pause();
    commit;
    $setup$
);

select pg_temp.connect_word_addition_actor(
    'word_addition_a', '48000000-0000-4000-8000-000000000001'
);
select pg_temp.connect_word_addition_actor(
    'word_addition_b', '48000000-0000-4000-8000-000000000002'
);

create temporary table word_addition_connection_pids (
    connection_name text primary key,
    pid integer not null
);
insert into word_addition_connection_pids
select 'word_addition_a', response.pid
from extensions.dblink(
    'word_addition_a', 'select pg_catalog.pg_backend_pid()'
) as response(pid integer);
insert into word_addition_connection_pids
select 'word_addition_b', response.pid
from extensions.dblink(
    'word_addition_b', 'select pg_catalog.pg_backend_pid()'
) as response(pid integer);

select extensions.dblink_exec(
    'word_addition_setup',
    'do $lock$ begin perform pg_catalog.pg_advisory_lock(948024, 1); end $lock$;'
);
select extensions.dblink_send_query(
    'word_addition_a',
    $$select public.word_addition_concurrency_call('addition-concurrency')$$
);

create temporary table word_addition_overlap (
    first_session_paused boolean not null,
    second_session_blocked boolean not null
);
do $synchronize$
declare
    first_wait_count integer := 0;
    second_wait_count integer := 0;
begin
    for attempt in 1..100 loop
        select pg_catalog.count(*)::integer into first_wait_count
        from pg_catalog.pg_locks
        where pid = (
            select pid from word_addition_connection_pids
            where connection_name = 'word_addition_a'
        ) and not granted;
        exit when first_wait_count > 0;
        perform pg_catalog.pg_sleep(0.05);
    end loop;

    perform extensions.dblink_send_query(
        'word_addition_b',
        $$select public.word_addition_concurrency_call('addition-concurrency')$$
    );
    for attempt in 1..100 loop
        select pg_catalog.count(*)::integer into second_wait_count
        from pg_catalog.pg_locks
        where pid = (
            select pid from word_addition_connection_pids
            where connection_name = 'word_addition_b'
        ) and not granted;
        exit when second_wait_count > 0;
        perform pg_catalog.pg_sleep(0.05);
    end loop;

    insert into word_addition_overlap
    values (first_wait_count > 0, second_wait_count > 0);
    perform extensions.dblink_exec(
        'word_addition_setup',
        'do $unlock$ begin perform pg_catalog.pg_advisory_unlock(948024, 1); end $unlock$;'
    );
end;
$synchronize$;

select no_plan();
select ok(
    (select first_session_paused and second_session_blocked from word_addition_overlap),
    'overlapping additions serialize on the same word'
);

create temporary table word_addition_concurrent_results (result jsonb not null);
insert into word_addition_concurrent_results
select response.result
from extensions.dblink_get_result('word_addition_a', false)
    as response(result jsonb);
insert into word_addition_concurrent_results
select response.result
from extensions.dblink_get_result('word_addition_b', false)
    as response(result jsonb);
select response.result
from extensions.dblink_get_result('word_addition_a', false)
    as response(result jsonb);
select response.result
from extensions.dblink_get_result('word_addition_b', false)
    as response(result jsonb);

select is(
    (
        select pg_catalog.count(*)::integer
        from word_addition_concurrent_results
        where result ->> 'status' = 'success'
    ),
    1,
    'exactly one overlapping addition succeeds'
);
select is(
    (
        select pg_catalog.count(*)::integer
        from word_addition_concurrent_results
        where result ->> 'status' = 'error'
          and result ->> 'message' = 'WORD_REQUEST_CONFLICT'
    ),
    1,
    'exactly one overlapping addition returns conflict'
);
select is(
    (
        select pg_catalog.count(*)::integer
        from public.wait_words where word = 'addition-concurrency'
    ),
    1,
    'concurrent requests create exactly one wait word row'
);
select is(
    (
        select pg_catalog.count(*)::integer
        from public.wait_word_themes as wait_theme
        join public.wait_words as wait_word
          on wait_word.id = wait_theme.wait_word_id
        where wait_word.word = 'addition-concurrency'
    ),
    2,
    'the winning request creates each theme relation exactly once'
);

do $disconnect$
begin
    perform extensions.dblink_disconnect('word_addition_a');
    perform extensions.dblink_disconnect('word_addition_b');
end;
$disconnect$;

select extensions.dblink_exec(
    'word_addition_setup',
    $cleanup$
    begin;
    drop trigger word_addition_concurrency_pause_insert on public.wait_words;
    drop function public.word_addition_concurrency_pause();
    drop function public.word_addition_concurrency_call(text);
    delete from public.wait_words where word = 'addition-concurrency';
    delete from public.themes where code in (
        'addition-concurrency-a', 'addition-concurrency-b'
    );
    delete from public.user_month_contributions where user_id in (
        '48000000-0000-4000-8000-000000000001',
        '48000000-0000-4000-8000-000000000002'
    );
    delete from public.users where id in (
        '48000000-0000-4000-8000-000000000001',
        '48000000-0000-4000-8000-000000000002'
    );
    delete from auth.users where id in (
        '48000000-0000-4000-8000-000000000001',
        '48000000-0000-4000-8000-000000000002'
    );
    commit;
    $cleanup$
);
select extensions.dblink_disconnect('word_addition_setup');

select * from finish();

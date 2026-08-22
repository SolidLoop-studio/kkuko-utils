create schema if not exists extensions;
create extension if not exists dblink with schema extensions;

create function pg_temp.user_word_request_connection_string()
returns text
language sql
stable
as $function$
    select pg_catalog.format(
        'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres',
        pg_catalog.current_database()
    );
$function$;

create function pg_temp.user_word_request_connect_authenticated(
    connection_name text,
    actor_id uuid
)
returns void
language plpgsql
as $function$
begin
    perform extensions.dblink_connect(
        connection_name, pg_temp.user_word_request_connection_string()
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
    'user_word_request_setup',
    pg_temp.user_word_request_connection_string()
);
select extensions.dblink_exec(
    'user_word_request_setup',
    $setup$
    begin;
    drop trigger if exists user_word_request_concurrency_pause_insert
        on public.wait_words;
    drop function if exists public.user_word_request_concurrency_pause();
    drop function if exists public.user_word_request_concurrency_call(text);
    delete from public.wait_words
    where word = 'user-request-concurrency-fixture';
    delete from public.words
    where word = 'user-request-concurrency-fixture';
    delete from public.docs_logs
    where word = 'user-request-concurrency-fixture';
    delete from public.docs
    where id in (201, 202)
      and name in (
          'user-word-request-concurrency-special-201',
          'user-word-request-concurrency-special-202'
      );
    delete from public.user_month_contributions where user_id in (
        '46000000-0000-4000-8000-000000000001',
        '46000000-0000-4000-8000-000000000002'
    );
    delete from public.users where id in (
        '46000000-0000-4000-8000-000000000001',
        '46000000-0000-4000-8000-000000000002'
    );
    delete from auth.users where id in (
        '46000000-0000-4000-8000-000000000001',
        '46000000-0000-4000-8000-000000000002'
    );
    insert into auth.users (id) values
        ('46000000-0000-4000-8000-000000000001'),
        ('46000000-0000-4000-8000-000000000002');
    insert into public.users (id, nickname, role) values
        ('46000000-0000-4000-8000-000000000001',
         'user-word-request-concurrency-a', 'r1'),
        ('46000000-0000-4000-8000-000000000002',
         'user-word-request-concurrency-b', 'r1');
    insert into public.docs (id, name, typez) values
        (201, 'user-word-request-concurrency-special-201', 'ect'),
        (202, 'user-word-request-concurrency-special-202', 'ect')
    on conflict (id) do nothing;
    insert into public.words (word, k_canuse, noin_canuse, added_by)
    values (
        'user-request-concurrency-fixture', true, true,
        '46000000-0000-4000-8000-000000000001'
    );

    create or replace function public.user_word_request_concurrency_call(
        p_word text
    )
    returns jsonb
    language plpgsql
    security invoker
    set search_path = ''
    as $function$
    begin
        return pg_catalog.jsonb_build_object(
            'status', 'success',
            'actor', auth.uid(),
            'result', public.request_word_deletion(p_word)
        );
    exception when others then
        return pg_catalog.jsonb_build_object(
            'status', 'error',
            'actor', auth.uid(),
            'message', sqlerrm
        );
    end;
    $function$;

    create or replace function public.user_word_request_concurrency_pause()
    returns trigger
    language plpgsql
    set search_path = ''
    as $function$
    begin
        if new.word = 'user-request-concurrency-fixture' then
            perform pg_catalog.pg_advisory_xact_lock(946021, 1);
        end if;
        return new;
    end;
    $function$;
    create trigger user_word_request_concurrency_pause_insert
    before insert on public.wait_words
    for each row
    execute function public.user_word_request_concurrency_pause();
    commit;
    $setup$
);

select pg_temp.user_word_request_connect_authenticated(
    'user_word_request_apply_a',
    '46000000-0000-4000-8000-000000000001'
);
select pg_temp.user_word_request_connect_authenticated(
    'user_word_request_apply_b',
    '46000000-0000-4000-8000-000000000002'
);

create temporary table user_word_request_connection_pids (
    connection_name text primary key,
    pid integer not null
);
insert into user_word_request_connection_pids (connection_name, pid)
select 'user_word_request_apply_a', response.pid
from extensions.dblink(
    'user_word_request_apply_a', 'select pg_catalog.pg_backend_pid()'
) as response(pid integer);
insert into user_word_request_connection_pids (connection_name, pid)
select 'user_word_request_apply_b', response.pid
from extensions.dblink(
    'user_word_request_apply_b', 'select pg_catalog.pg_backend_pid()'
) as response(pid integer);

select extensions.dblink_exec(
    'user_word_request_setup',
    'do $lock$ begin perform pg_catalog.pg_advisory_lock(946021, 1); end $lock$;'
);

select extensions.dblink_send_query(
    'user_word_request_apply_a',
    $$select public.user_word_request_concurrency_call(
        'user-request-concurrency-fixture'
    )$$
);

create temporary table user_word_request_overlap_observation (
    first_session_locked boolean not null,
    second_session_blocked boolean not null
);
do $synchronize$
declare
    first_wait_count integer := 0;
    second_wait_count integer := 0;
begin
    for attempt in 1..100 loop
        select pg_catalog.count(*)::integer into first_wait_count
        from pg_catalog.pg_locks as held_lock
        where held_lock.pid = (
            select connection.pid
            from user_word_request_connection_pids as connection
            where connection.connection_name = 'user_word_request_apply_a'
        )
          and not held_lock.granted;
        exit when first_wait_count > 0;
        perform pg_catalog.pg_sleep(0.05);
    end loop;

    perform extensions.dblink_send_query(
        'user_word_request_apply_b',
        $$select public.user_word_request_concurrency_call(
            'user-request-concurrency-fixture'
        )$$
    );

    for attempt in 1..100 loop
        select pg_catalog.count(*)::integer into second_wait_count
        from pg_catalog.pg_locks as held_lock
        where held_lock.pid = (
            select connection.pid
            from user_word_request_connection_pids as connection
            where connection.connection_name = 'user_word_request_apply_b'
        )
          and not held_lock.granted;
        exit when second_wait_count > 0;
        perform pg_catalog.pg_sleep(0.05);
    end loop;

    insert into user_word_request_overlap_observation
    values (first_wait_count > 0, second_wait_count > 0);
    perform extensions.dblink_exec(
        'user_word_request_setup',
        'do $unlock$ begin perform pg_catalog.pg_advisory_unlock(946021, 1); end $unlock$;'
    );
end;
$synchronize$;

select no_plan();

select ok(
    (select first_session_locked and second_session_blocked
     from user_word_request_overlap_observation),
    'the first insert is paused while the second request waits on the word'
);

create temporary table user_word_request_concurrent_results (
    result jsonb not null
);
insert into user_word_request_concurrent_results (result)
select response.result
from extensions.dblink_get_result('user_word_request_apply_a', false)
    as response(result jsonb);
insert into user_word_request_concurrent_results (result)
select response.result
from extensions.dblink_get_result('user_word_request_apply_b', false)
    as response(result jsonb);
select response.result
from extensions.dblink_get_result('user_word_request_apply_a', false)
    as response(result jsonb);
select response.result
from extensions.dblink_get_result('user_word_request_apply_b', false)
    as response(result jsonb);

select is(
    (
        select pg_catalog.count(*)::integer
        from user_word_request_concurrent_results
        where result ->> 'status' = 'success'
          and result -> 'result' = pg_catalog.jsonb_build_object(
              'requestId', (
                  select id from public.wait_words
                  where word = 'user-request-concurrency-fixture'
              ),
              'word', 'user-request-concurrency-fixture',
              'requestType', 'delete'
          )
    ),
    1,
    'exactly one concurrent request returns the success contract'
);
select is(
    (
        select pg_catalog.count(*)::integer
        from user_word_request_concurrent_results
        where result ->> 'status' = 'error'
          and result ->> 'message' = 'WORD_REQUEST_CONFLICT'
    ),
    1,
    'exactly one concurrent request returns conflict'
);
select is(
    (
        select pg_catalog.count(*)::integer
        from public.wait_words
        where word = 'user-request-concurrency-fixture'
    ),
    1,
    'concurrent requests create exactly one wait_words row'
);
select is(
    (
        select wait_word.requested_by
        from public.wait_words as wait_word
        where wait_word.word = 'user-request-concurrency-fixture'
    ),
    (
        select (result ->> 'actor')::uuid
        from user_word_request_concurrent_results
        where result ->> 'status' = 'success'
    ),
    'the stored requester is the winning authenticated session'
);

do $disconnect$
begin
    perform extensions.dblink_disconnect('user_word_request_apply_a');
    perform extensions.dblink_disconnect('user_word_request_apply_b');
end;
$disconnect$;

select extensions.dblink_exec(
    'user_word_request_setup',
    $cleanup$
    begin;
    drop trigger user_word_request_concurrency_pause_insert
        on public.wait_words;
    drop function public.user_word_request_concurrency_pause();
    drop function public.user_word_request_concurrency_call(text);
    delete from public.wait_words
    where word = 'user-request-concurrency-fixture';
    delete from public.words
    where word = 'user-request-concurrency-fixture';
    delete from public.docs_logs
    where word = 'user-request-concurrency-fixture';
    delete from public.docs
    where id in (201, 202)
      and name in (
          'user-word-request-concurrency-special-201',
          'user-word-request-concurrency-special-202'
      );
    delete from public.user_month_contributions where user_id in (
        '46000000-0000-4000-8000-000000000001',
        '46000000-0000-4000-8000-000000000002'
    );
    delete from public.users where id in (
        '46000000-0000-4000-8000-000000000001',
        '46000000-0000-4000-8000-000000000002'
    );
    delete from auth.users where id in (
        '46000000-0000-4000-8000-000000000001',
        '46000000-0000-4000-8000-000000000002'
    );
    commit;
    $cleanup$
);
select extensions.dblink_disconnect('user_word_request_setup');

select ok(
    not exists (
        select 1 from public.wait_words
        where word = 'user-request-concurrency-fixture'
    ) and not exists (
        select 1 from public.words
        where word = 'user-request-concurrency-fixture'
    ) and not exists (
        select 1 from public.docs_logs
        where word = 'user-request-concurrency-fixture'
    ) and pg_catalog.to_regprocedure(
        'public.user_word_request_concurrency_call(text)'
    ) is null and pg_catalog.to_regprocedure(
        'public.user_word_request_concurrency_pause()'
    ) is null and not exists (
        select 1 from pg_catalog.pg_trigger
        where tgname = 'user_word_request_concurrency_pause_insert'
          and not tgisinternal
    ),
    'concurrency cleanup leaves no fixtures or synchronization objects'
);

select * from finish();

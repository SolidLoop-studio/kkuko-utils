create schema if not exists extensions;
create extension if not exists dblink with schema extensions;

create function pg_temp.user_word_theme_request_connection_string()
returns text
language sql
stable
as $function$
    select pg_catalog.format(
        'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres',
        pg_catalog.current_database()
    );
$function$;

create function pg_temp.user_word_theme_request_connect_authenticated(
    connection_name text,
    actor_id uuid
)
returns void
language plpgsql
as $function$
begin
    perform extensions.dblink_connect(
        connection_name,
        pg_temp.user_word_theme_request_connection_string()
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
    'user_word_theme_request_setup',
    pg_temp.user_word_theme_request_connection_string()
);
select extensions.dblink_exec(
    'user_word_theme_request_setup',
    $setup$
    begin;
    drop trigger if exists user_word_theme_request_concurrency_pause_insert
        on public.word_themes_wait;
    drop function if exists public.user_word_theme_request_concurrency_pause();
    drop function if exists public.user_word_theme_request_concurrency_call(
        text, jsonb
    );
    delete from public.word_themes_wait
    where word_id in (
        select id from public.words
        where word in (
            'theme-request-concurrency-fixture',
            'theme-request-resolution-race'
        )
    );
    delete from public.word_themes
    where word_id in (
        select id from public.words
        where word in (
            'theme-request-concurrency-fixture',
            'theme-request-resolution-race'
        )
    );
    delete from public.words
    where word in (
        'theme-request-concurrency-fixture',
        'theme-request-resolution-race'
    );
    delete from public.themes
    where code in (
        'tr-concurrency',
        'tr-resolution-race',
        'tr-resolution-race-renamed'
    );
    delete from public.docs_logs
    where word in (
        'theme-request-concurrency-fixture',
        'theme-request-resolution-race'
    );
    delete from public.docs
    where id in (201, 202)
      and name in (
          'user-word-theme-request-concurrency-special-201',
          'user-word-theme-request-concurrency-special-202'
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
        ('48000000-0000-4000-8000-000000000001',
         'user-word-theme-request-concurrency-a', 'r1'),
        ('48000000-0000-4000-8000-000000000002',
         'user-word-theme-request-concurrency-b', 'r1');
    insert into public.docs (id, name, typez) values
        (201, 'user-word-theme-request-concurrency-special-201', 'ect'),
        (202, 'user-word-theme-request-concurrency-special-202', 'ect')
    on conflict (id) do nothing;
    insert into public.words (word, k_canuse, noin_canuse, added_by) values
        ('theme-request-concurrency-fixture', true, true,
         '48000000-0000-4000-8000-000000000001'),
        ('theme-request-resolution-race', true, true,
         '48000000-0000-4000-8000-000000000001');
    insert into public.themes (name, code) values
        ('Theme Request Concurrency', 'tr-concurrency'),
        ('Theme Request Resolution Race', 'tr-resolution-race');

    create or replace function public.user_word_theme_request_concurrency_call(
        p_word text,
        p_changes jsonb
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
            'result', public.request_word_theme_changes(p_word, p_changes)
        );
    exception when others then
        return pg_catalog.jsonb_build_object(
            'status', 'error',
            'actor', auth.uid(),
            'message', sqlerrm
        );
    end;
    $function$;

    create or replace function public.user_word_theme_request_concurrency_pause()
    returns trigger
    language plpgsql
    set search_path = ''
    as $function$
    begin
        if new.word_id = (
            select registered_word.id
            from public.words as registered_word
            where registered_word.word = 'theme-request-concurrency-fixture'
        ) then
            perform pg_catalog.pg_advisory_xact_lock(946023, 1);
        end if;
        return new;
    end;
    $function$;
    create trigger user_word_theme_request_concurrency_pause_insert
    before insert on public.word_themes_wait
    for each row
    execute function public.user_word_theme_request_concurrency_pause();
    commit;
    $setup$
);

select pg_temp.user_word_theme_request_connect_authenticated(
    'user_word_theme_request_apply_a',
    '48000000-0000-4000-8000-000000000001'
);
select pg_temp.user_word_theme_request_connect_authenticated(
    'user_word_theme_request_apply_b',
    '48000000-0000-4000-8000-000000000002'
);

create temporary table user_word_theme_request_connection_pids (
    connection_name text primary key,
    pid integer not null
);
insert into user_word_theme_request_connection_pids (connection_name, pid)
select 'user_word_theme_request_apply_a', response.pid
from extensions.dblink(
    'user_word_theme_request_apply_a', 'select pg_catalog.pg_backend_pid()'
) as response(pid integer);
insert into user_word_theme_request_connection_pids (connection_name, pid)
select 'user_word_theme_request_apply_b', response.pid
from extensions.dblink(
    'user_word_theme_request_apply_b', 'select pg_catalog.pg_backend_pid()'
) as response(pid integer);

select extensions.dblink_exec(
    'user_word_theme_request_setup',
    'do $lock$ begin perform pg_catalog.pg_advisory_lock(946023, 1); end $lock$;'
);

select extensions.dblink_send_query(
    'user_word_theme_request_apply_a',
    $$select public.user_word_theme_request_concurrency_call(
        'theme-request-concurrency-fixture',
        '[{"themeCode":"tr-concurrency","type":"add"}]'
    )$$
);

create temporary table user_word_theme_request_overlap_observation (
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
            from user_word_theme_request_connection_pids as connection
            where connection.connection_name =
                'user_word_theme_request_apply_a'
        )
          and not held_lock.granted;
        exit when first_wait_count > 0;
        perform pg_catalog.pg_sleep(0.05);
    end loop;

    perform extensions.dblink_send_query(
        'user_word_theme_request_apply_b',
        $$select public.user_word_theme_request_concurrency_call(
            'theme-request-concurrency-fixture',
            '[{"themeCode":"tr-concurrency","type":"add"}]'
        )$$
    );

    for attempt in 1..100 loop
        select pg_catalog.count(*)::integer into second_wait_count
        from pg_catalog.pg_locks as held_lock
        where held_lock.pid = (
            select connection.pid
            from user_word_theme_request_connection_pids as connection
            where connection.connection_name =
                'user_word_theme_request_apply_b'
        )
          and not held_lock.granted;
        exit when second_wait_count > 0;
        perform pg_catalog.pg_sleep(0.05);
    end loop;

    insert into user_word_theme_request_overlap_observation
    values (first_wait_count > 0, second_wait_count > 0);
    perform extensions.dblink_exec(
        'user_word_theme_request_setup',
        'do $unlock$ begin perform pg_catalog.pg_advisory_unlock(946023, 1); end $unlock$;'
    );
end;
$synchronize$;

select no_plan();

select ok(
    (select first_session_locked and second_session_blocked
     from user_word_theme_request_overlap_observation),
    'the first insert is paused while the second request waits on the word'
);

create temporary table user_word_theme_request_concurrent_results (
    result jsonb not null
);
insert into user_word_theme_request_concurrent_results (result)
select response.result
from extensions.dblink_get_result(
    'user_word_theme_request_apply_a', false
) as response(result jsonb);
insert into user_word_theme_request_concurrent_results (result)
select response.result
from extensions.dblink_get_result(
    'user_word_theme_request_apply_b', false
) as response(result jsonb);
select response.result
from extensions.dblink_get_result(
    'user_word_theme_request_apply_a', false
) as response(result jsonb);
select response.result
from extensions.dblink_get_result(
    'user_word_theme_request_apply_b', false
) as response(result jsonb);

select is(
    (
        select pg_catalog.count(*)::integer
        from user_word_theme_request_concurrent_results
        where result ->> 'status' = 'success'
          and result -> 'result' =
              '{"word":"theme-request-concurrency-fixture","changes":[
                 {"themeCode":"tr-concurrency","themeName":"Theme Request Concurrency","type":"add"}
               ]}'::jsonb
    ),
    1,
    'exactly one concurrent request returns the stable success contract'
);
select is(
    (
        select pg_catalog.count(*)::integer
        from user_word_theme_request_concurrent_results
        where result ->> 'status' = 'error'
          and result ->> 'message' = 'WORD_THEME_REQUEST_CONFLICT'
    ),
    1,
    'exactly one concurrent request returns the stable conflict error'
);
select is(
    (
        select pg_catalog.count(*)::integer
        from public.word_themes_wait as pending_request
        join public.words as registered_word
          on registered_word.id = pending_request.word_id
        join public.themes as theme
          on theme.id = pending_request.theme_id
        where registered_word.word = 'theme-request-concurrency-fixture'
          and theme.code = 'tr-concurrency'
    ),
    1,
    'concurrent requests create exactly one pending row'
);
select is(
    (
        select pending_request.req_by
        from public.word_themes_wait as pending_request
        join public.words as registered_word
          on registered_word.id = pending_request.word_id
        join public.themes as theme
          on theme.id = pending_request.theme_id
        where registered_word.word = 'theme-request-concurrency-fixture'
          and theme.code = 'tr-concurrency'
    ),
    (
        select (result ->> 'actor')::uuid
        from user_word_theme_request_concurrent_results
        where result ->> 'status' = 'success'
    ),
    'the stored requester is the winning authenticated session'
);

select extensions.dblink_exec(
    'user_word_theme_request_setup',
    $race_update$
    begin;
    update public.themes
    set code = 'tr-resolution-race-renamed'
    where code = 'tr-resolution-race';
    $race_update$
);
select extensions.dblink_send_query(
    'user_word_theme_request_apply_a',
    $$select public.user_word_theme_request_concurrency_call(
        'theme-request-resolution-race',
        '[{"themeCode":"tr-resolution-race","type":"add"}]'
    )$$
);

create temporary table user_word_theme_request_resolution_observation (
    request_blocked_on_theme boolean not null
);
do $synchronize_resolution$
declare
    request_wait_count integer := 0;
begin
    for attempt in 1..100 loop
        select pg_catalog.count(*)::integer into request_wait_count
        from pg_catalog.pg_locks as held_lock
        where held_lock.pid = (
            select connection.pid
            from user_word_theme_request_connection_pids as connection
            where connection.connection_name =
                'user_word_theme_request_apply_a'
        )
          and not held_lock.granted;
        exit when request_wait_count > 0;
        perform pg_catalog.pg_sleep(0.05);
    end loop;

    insert into user_word_theme_request_resolution_observation
    values (request_wait_count > 0);
    perform extensions.dblink_exec(
        'user_word_theme_request_setup', 'commit'
    );
end;
$synchronize_resolution$;

select ok(
    (select request_blocked_on_theme
     from user_word_theme_request_resolution_observation),
    'the request overlaps a concurrent theme rename before locking it'
);

create temporary table user_word_theme_request_resolution_results (
    result jsonb not null
);
insert into user_word_theme_request_resolution_results (result)
select response.result
from extensions.dblink_get_result(
    'user_word_theme_request_apply_a', false
) as response(result jsonb);
select response.result
from extensions.dblink_get_result(
    'user_word_theme_request_apply_a', false
) as response(result jsonb);

select is(
    (
        select result ->> 'message'
        from user_word_theme_request_resolution_results
        where result ->> 'status' = 'error'
    ),
    'WORD_THEME_REQUEST_NOT_FOUND',
    'a theme renamed before lock acquisition returns stable not found'
);
select is(
    (
        select pg_catalog.count(*)::integer
        from public.word_themes_wait as pending_request
        join public.words as registered_word
          on registered_word.id = pending_request.word_id
        where registered_word.word = 'theme-request-resolution-race'
    ),
    0,
    'the theme resolution race inserts no pending row'
);

do $disconnect$
begin
    perform extensions.dblink_disconnect('user_word_theme_request_apply_a');
    perform extensions.dblink_disconnect('user_word_theme_request_apply_b');
end;
$disconnect$;

select extensions.dblink_exec(
    'user_word_theme_request_setup',
    $cleanup$
    begin;
    drop trigger user_word_theme_request_concurrency_pause_insert
        on public.word_themes_wait;
    drop function public.user_word_theme_request_concurrency_pause();
    drop function public.user_word_theme_request_concurrency_call(text, jsonb);
    delete from public.word_themes_wait
    where word_id in (
        select id from public.words
        where word in (
            'theme-request-concurrency-fixture',
            'theme-request-resolution-race'
        )
    );
    delete from public.word_themes
    where word_id in (
        select id from public.words
        where word in (
            'theme-request-concurrency-fixture',
            'theme-request-resolution-race'
        )
    );
    delete from public.words
    where word in (
        'theme-request-concurrency-fixture',
        'theme-request-resolution-race'
    );
    delete from public.themes
    where code in (
        'tr-concurrency',
        'tr-resolution-race',
        'tr-resolution-race-renamed'
    );
    delete from public.docs_logs
    where word in (
        'theme-request-concurrency-fixture',
        'theme-request-resolution-race'
    );
    delete from public.docs
    where id in (201, 202)
      and name in (
          'user-word-theme-request-concurrency-special-201',
          'user-word-theme-request-concurrency-special-202'
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
select extensions.dblink_disconnect('user_word_theme_request_setup');

select ok(
    not exists (
        select 1 from public.words
        where word in (
            'theme-request-concurrency-fixture',
            'theme-request-resolution-race'
        )
    ) and not exists (
        select 1 from public.themes
        where code in (
            'tr-concurrency',
            'tr-resolution-race',
            'tr-resolution-race-renamed'
        )
    ) and not exists (
        select 1 from public.docs_logs
        where word in (
            'theme-request-concurrency-fixture',
            'theme-request-resolution-race'
        )
    ) and pg_catalog.to_regprocedure(
        'public.user_word_theme_request_concurrency_call(text,jsonb)'
    ) is null and pg_catalog.to_regprocedure(
        'public.user_word_theme_request_concurrency_pause()'
    ) is null and not exists (
        select 1 from pg_catalog.pg_trigger
        where tgname = 'user_word_theme_request_concurrency_pause_insert'
          and not tgisinternal
    ),
    'concurrency cleanup leaves no fixtures or synchronization objects'
);

select * from finish();

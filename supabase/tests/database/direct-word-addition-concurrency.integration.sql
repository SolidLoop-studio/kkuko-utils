create schema if not exists extensions;
create extension if not exists dblink with schema extensions;

create function pg_temp.direct_addition_connection_string()
returns text language sql stable
as $function$
    select pg_catalog.format(
        'host=host.docker.internal port=55322 dbname=%s user=postgres password=postgres',
        pg_catalog.current_database()
    );
$function$;

create function pg_temp.connect_direct_addition_actor(connection_name text, actor_id uuid)
returns void language plpgsql
as $function$
begin
    perform extensions.dblink_connect(connection_name, pg_temp.direct_addition_connection_string());
    perform extensions.dblink_exec(connection_name, 'set role authenticated');
    perform extensions.dblink_exec(connection_name,
        pg_catalog.format('set request.jwt.claim.sub = %L', actor_id::text));
    perform extensions.dblink_exec(connection_name,
        pg_catalog.format('set request.jwt.claims = %L',
            pg_catalog.jsonb_build_object('sub', actor_id::text, 'role', 'authenticated')::text));
end;
$function$;

select extensions.dblink_connect('direct_addition_setup', pg_temp.direct_addition_connection_string());
select extensions.dblink_exec('direct_addition_setup', $setup$
begin;
drop trigger if exists direct_addition_concurrency_pause_log on public.logs;
drop function if exists public.direct_addition_concurrency_pause();
drop function if exists public.direct_addition_concurrency_call(text);
delete from public.word_themes where word_id in (select id from public.words where word = 'raceЖ');
delete from public.words where word = 'raceЖ';
delete from public.logs where word = 'raceЖ';
delete from public.docs_logs where word = 'raceЖ';
delete from public.docs where id in (947001, 947002);
delete from public.themes where code = 'direct-add-race-theme';
delete from public.user_month_contributions where user_id in (
    '4b000000-0000-4000-8000-000000000001',
    '4b000000-0000-4000-8000-000000000002');
delete from public.users where id in (
    '4b000000-0000-4000-8000-000000000001',
    '4b000000-0000-4000-8000-000000000002');
delete from auth.users where id in (
    '4b000000-0000-4000-8000-000000000001',
    '4b000000-0000-4000-8000-000000000002');
insert into auth.users (id) values
    ('4b000000-0000-4000-8000-000000000001'),
    ('4b000000-0000-4000-8000-000000000002');
insert into public.users (id, nickname, role) values
    ('4b000000-0000-4000-8000-000000000001', 'direct-add-race-admin', 'admin'),
    ('4b000000-0000-4000-8000-000000000002', 'direct-add-race-r4', 'r4');
insert into public.themes (code, name) values
    ('direct-add-race-theme', 'direct-add-race-theme');
insert into public.docs (id, name, typez, last_update) values
    (947001, 'direct-add-race-theme', 'theme', '2000-01-01'),
    (947002, 'Ж', 'letter', '2000-01-01');

create function public.direct_addition_concurrency_call(p_word text)
returns jsonb language plpgsql security invoker set search_path = ''
as $function$
begin
    return pg_catalog.jsonb_build_object(
        'status', 'success',
        'result', public.add_word_directly(p_word, array['direct-add-race-theme'])
    );
exception when others then
    return pg_catalog.jsonb_build_object('status', 'error', 'message', sqlerrm);
end;
$function$;
create function public.direct_addition_concurrency_pause()
returns trigger language plpgsql set search_path = ''
as $function$
begin
    if new.word = 'raceЖ' then perform pg_catalog.pg_advisory_xact_lock(947021, 1); end if;
    return new;
end;
$function$;
create trigger direct_addition_concurrency_pause_log
before insert on public.logs
for each row execute function public.direct_addition_concurrency_pause();
commit;
$setup$);

select pg_temp.connect_direct_addition_actor(
    'direct_addition_a', '4b000000-0000-4000-8000-000000000001');
select pg_temp.connect_direct_addition_actor(
    'direct_addition_b', '4b000000-0000-4000-8000-000000000002');
create temporary table direct_addition_pids (connection_name text primary key, pid integer not null);
insert into direct_addition_pids select 'direct_addition_a', response.pid
from extensions.dblink('direct_addition_a', 'select pg_catalog.pg_backend_pid()') as response(pid integer);
insert into direct_addition_pids select 'direct_addition_b', response.pid
from extensions.dblink('direct_addition_b', 'select pg_catalog.pg_backend_pid()') as response(pid integer);

select extensions.dblink_exec('direct_addition_setup',
    'do $lock$ begin perform pg_catalog.pg_advisory_lock(947021, 1); end $lock$;');
select extensions.dblink_send_query('direct_addition_a',
    $$select public.direct_addition_concurrency_call('raceЖ')$$);
create temporary table direct_addition_overlap (
    first_session_paused boolean not null,
    second_session_blocked boolean not null
);
do $synchronize$
declare first_pause_wait_count integer := 0; second_word_wait_count integer := 0;
begin
    for attempt in 1..100 loop
        select pg_catalog.count(*)::integer into first_pause_wait_count
          from pg_catalog.pg_locks as held_lock
         where held_lock.pid = (
                   select pid from direct_addition_pids
                    where connection_name = 'direct_addition_a'
               )
           and held_lock.locktype = 'advisory'
           and held_lock.classid = 947021::oid
           and held_lock.objid = 1::oid
           and held_lock.objsubid = 2
           and held_lock.mode = 'ExclusiveLock'
           and not held_lock.granted;
        exit when first_pause_wait_count > 0;
        perform pg_catalog.pg_sleep(0.05);
    end loop;
    perform extensions.dblink_send_query('direct_addition_b',
        $$select public.direct_addition_concurrency_call('raceЖ')$$);
    for attempt in 1..100 loop
        select pg_catalog.count(*)::integer into second_word_wait_count
          from pg_catalog.pg_locks as held_lock
          cross join lateral (
              select pg_catalog.hashtextextended(
                  'direct-word-addition:raceЖ', 0
              )::bigint as value
          ) as expected_key
         where held_lock.pid = (
                   select pid from direct_addition_pids
                    where connection_name = 'direct_addition_b'
               )
           and held_lock.locktype = 'advisory'
           and held_lock.classid = (
               ((expected_key.value >> 32) & 4294967295::bigint)::oid
           )
           and held_lock.objid = (
               (expected_key.value & 4294967295::bigint)::oid
           )
           and held_lock.objsubid = 1
           and held_lock.mode = 'ExclusiveLock'
           and not held_lock.granted;
        exit when second_word_wait_count > 0;
        perform pg_catalog.pg_sleep(0.05);
    end loop;
    insert into direct_addition_overlap values (
        first_pause_wait_count > 0,
        second_word_wait_count > 0
    );
    perform extensions.dblink_exec('direct_addition_setup',
        'do $unlock$ begin perform pg_catalog.pg_advisory_unlock(947021, 1); end $unlock$;');
end;
$synchronize$;

select no_plan();
select ok((select first_session_paused and second_session_blocked from direct_addition_overlap),
    'overlapping direct additions serialize on the normalized word');
create temporary table direct_addition_results (result jsonb not null);
insert into direct_addition_results select response.result
from extensions.dblink_get_result('direct_addition_a', false) as response(result jsonb);
insert into direct_addition_results select response.result
from extensions.dblink_get_result('direct_addition_b', false) as response(result jsonb);
select response.result from extensions.dblink_get_result('direct_addition_a', false) as response(result jsonb);
select response.result from extensions.dblink_get_result('direct_addition_b', false) as response(result jsonb);
select is((select pg_catalog.count(*)::integer from direct_addition_results
    where result ->> 'status' = 'success'), 1,
    'exactly one concurrent direct addition succeeds');
select is((select pg_catalog.count(*)::integer from direct_addition_results
    where result ->> 'status' = 'error'
      and result ->> 'message' = 'DIRECT_WORD_ADDITION_DUPLICATE'), 1,
    'the losing concurrent addition receives the stable duplicate code');
select is((select pg_catalog.count(*)::integer from public.words where word = 'raceЖ'), 1,
    'concurrency leaves one word');
select is((select pg_catalog.count(*)::integer from public.logs
    where word = 'raceЖ' and r_type = 'add'), 1,
    'concurrency leaves one authoritative word log');
select ok((select pg_catalog.count(*) = 2 and pg_catalog.count(distinct docs_id) = 2
    from public.docs_logs where word = 'raceЖ' and docs_id in (947001, 947002) and type = 'add'),
    'concurrency leaves one unique set of ordinary docs logs');
select is((select pg_catalog.count(*)::integer from public.word_themes as relation
    join public.words as word_row on word_row.id = relation.word_id
    where word_row.word = 'raceЖ'), 1,
    'concurrency leaves one theme relation');

do $disconnect$
begin
    perform extensions.dblink_disconnect('direct_addition_a');
    perform extensions.dblink_disconnect('direct_addition_b');
end;
$disconnect$;
select extensions.dblink_exec('direct_addition_setup', $cleanup$
begin;
drop trigger direct_addition_concurrency_pause_log on public.logs;
drop function public.direct_addition_concurrency_pause();
drop function public.direct_addition_concurrency_call(text);
delete from public.word_themes where word_id in (select id from public.words where word = 'raceЖ');
delete from public.words where word = 'raceЖ';
delete from public.logs where word = 'raceЖ';
delete from public.docs_logs where word = 'raceЖ';
delete from public.docs where id in (947001, 947002);
delete from public.themes where code = 'direct-add-race-theme';
delete from public.user_month_contributions where user_id in (
    '4b000000-0000-4000-8000-000000000001',
    '4b000000-0000-4000-8000-000000000002');
delete from public.users where id in (
    '4b000000-0000-4000-8000-000000000001',
    '4b000000-0000-4000-8000-000000000002');
delete from auth.users where id in (
    '4b000000-0000-4000-8000-000000000001',
    '4b000000-0000-4000-8000-000000000002');
commit;
$cleanup$);
select extensions.dblink_disconnect('direct_addition_setup');
select * from finish();

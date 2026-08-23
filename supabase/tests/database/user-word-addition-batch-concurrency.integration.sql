create schema if not exists extensions;
create extension if not exists dblink with schema extensions;

create function pg_temp.word_addition_batch_connection_string()
returns text language sql stable as $function$
    select pg_catalog.format(
        'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres',
        pg_catalog.current_database()
    );
$function$;

create function pg_temp.connect_word_addition_batch_actor(connection_name text, actor_id uuid)
returns void language plpgsql as $function$
begin
    perform extensions.dblink_connect(connection_name, pg_temp.word_addition_batch_connection_string());
    perform extensions.dblink_exec(connection_name, 'set role authenticated');
    perform extensions.dblink_exec(connection_name, pg_catalog.format('set request.jwt.claim.sub = %L', actor_id::text));
    perform extensions.dblink_exec(
        connection_name,
        pg_catalog.format('set request.jwt.claims = %L', pg_catalog.jsonb_build_object('sub', actor_id::text, 'role', 'authenticated')::text)
    );
end;
$function$;

select extensions.dblink_connect('word_addition_batch_setup', pg_temp.word_addition_batch_connection_string());
select extensions.dblink_exec('word_addition_batch_setup', $setup$
begin;
delete from public.wait_words where word = 'addition-batch-concurrency';
delete from public.words where word = 'addition-batch-concurrency';
delete from public.themes where code = 'addition-batch-concurrency';
delete from public.user_month_contributions where user_id in ('4a000000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000002');
delete from public.users where id in ('4a000000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000002');
delete from auth.users where id in ('4a000000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000002');
insert into auth.users (id) values ('4a000000-0000-4000-8000-000000000001'), ('4a000000-0000-4000-8000-000000000002');
insert into public.users (id, nickname, role) values
    ('4a000000-0000-4000-8000-000000000001', 'addition-batch-concurrency-a', 'r1'),
    ('4a000000-0000-4000-8000-000000000002', 'addition-batch-concurrency-b', 'r1');
insert into public.themes (name, code) values ('대량 동시성 주제', 'addition-batch-concurrency');
create or replace function public.word_addition_batch_concurrency_call()
returns jsonb language plpgsql security invoker set search_path = '' as $function$
begin
    return public.request_word_additions('[{"word":"addition-batch-concurrency","themeCodes":["addition-batch-concurrency"]}]');
end;
$function$;
create or replace function public.word_addition_batch_concurrency_pause()
returns trigger language plpgsql set search_path = '' as $function$
begin
    if new.word = 'addition-batch-concurrency' then
        perform pg_catalog.pg_advisory_xact_lock(948024, 2);
    end if;
    return new;
end;
$function$;
create trigger word_addition_batch_concurrency_pause_insert before insert on public.wait_words
for each row execute function public.word_addition_batch_concurrency_pause();
commit;
$setup$);

select pg_temp.connect_word_addition_batch_actor('word_addition_batch_a', '4a000000-0000-4000-8000-000000000001');
select pg_temp.connect_word_addition_batch_actor('word_addition_batch_b', '4a000000-0000-4000-8000-000000000002');

select extensions.dblink_exec('word_addition_batch_setup', 'do $lock$ begin perform pg_catalog.pg_advisory_lock(948024, 2); end $lock$;');
select extensions.dblink_send_query('word_addition_batch_a', 'select public.word_addition_batch_concurrency_call()');
select pg_catalog.pg_sleep(0.2);
select extensions.dblink_send_query('word_addition_batch_b', 'select public.word_addition_batch_concurrency_call()');
select pg_catalog.pg_sleep(0.2);
select extensions.dblink_exec('word_addition_batch_setup', 'do $unlock$ begin perform pg_catalog.pg_advisory_unlock(948024, 2); end $unlock$;');

create temporary table word_addition_batch_concurrent_results (result jsonb not null);
insert into word_addition_batch_concurrent_results
select response.result from extensions.dblink_get_result('word_addition_batch_a', false) as response(result jsonb);
insert into word_addition_batch_concurrent_results
select response.result from extensions.dblink_get_result('word_addition_batch_b', false) as response(result jsonb);
select response.result from extensions.dblink_get_result('word_addition_batch_a', false) as response(result jsonb);
select response.result from extensions.dblink_get_result('word_addition_batch_b', false) as response(result jsonb);

select no_plan();
select is(
    (select pg_catalog.count(*)::integer from public.wait_words where word = 'addition-batch-concurrency'),
    1,
    'overlapping idempotent batches create one request row'
);
select is(
    (select pg_catalog.count(*)::integer from public.wait_word_themes as relation
     join public.wait_words as request on request.id = relation.wait_word_id
     where request.word = 'addition-batch-concurrency'),
    1,
    'overlapping batches create each theme relation once'
);
select is(
    (select pg_catalog.sum((result ->> 'createdWordRequestCount')::integer)::integer from word_addition_batch_concurrent_results),
    1,
    'exactly one overlapping batch reports creating the request'
);
select is(
    (select pg_catalog.sum((result ->> 'unchangedWordCount')::integer)::integer from word_addition_batch_concurrent_results),
    1,
    'the overlapping retry reports an unchanged word'
);

do $disconnect$ begin
    perform extensions.dblink_disconnect('word_addition_batch_a');
    perform extensions.dblink_disconnect('word_addition_batch_b');
end $disconnect$;
select extensions.dblink_exec('word_addition_batch_setup', $cleanup$
begin;
drop trigger word_addition_batch_concurrency_pause_insert on public.wait_words;
drop function public.word_addition_batch_concurrency_pause();
drop function public.word_addition_batch_concurrency_call();
delete from public.wait_words where word = 'addition-batch-concurrency';
delete from public.themes where code = 'addition-batch-concurrency';
delete from public.user_month_contributions where user_id in ('4a000000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000002');
delete from public.users where id in ('4a000000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000002');
delete from auth.users where id in ('4a000000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000002');
commit;
$cleanup$);
select extensions.dblink_disconnect('word_addition_batch_setup');
select * from finish();

create schema if not exists extensions;
create extension if not exists dblink with schema extensions;

select plan(24);

create function pg_temp.word_deletion_test_connection_string()
returns text
language sql
stable
as $function$
    select pg_catalog.format(
        'host=host.docker.internal port=55322 dbname=%s user=postgres password=postgres',
        pg_catalog.current_database()
    );
$function$;

create function pg_temp.word_deletion_connect_authenticated(
    connection_name text,
    actor_id uuid
)
returns void
language plpgsql
as $function$
begin
    perform extensions.dblink_connect(
        connection_name,
        pg_temp.word_deletion_test_connection_string()
    );
    perform extensions.dblink_exec(
        connection_name,
        pg_catalog.format('set application_name = %L', connection_name)
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
    perform extensions.dblink_exec(connection_name, 'set statement_timeout = ''10s''');
end;
$function$;

select extensions.dblink_connect(
    'word_deletion_setup',
    pg_temp.word_deletion_test_connection_string()
);

select extensions.dblink_exec(
    'word_deletion_setup',
    $setup$
    begin;

    drop trigger if exists word_deletion_test_pause_apply on public.words;
    drop function if exists public.word_deletion_test_pause_apply();
    delete from public.word_deletion_operations
    where operation_id in (
        '30000000-0000-4000-8000-000000000020',
        '30000000-0000-4000-8000-000000000021'
    );
    delete from public.word_themes_wait
    where word_id in (
        select word_row.id from public.words as word_row
        where word_row.word = 'word-deletion-concurrency-fixture-x'
    );
    delete from public.wait_words
    where word = 'word-deletion-concurrency-fixture-x';
    delete from public.word_themes
    where word_id in (
        select word_row.id from public.words as word_row
        where word_row.word = 'word-deletion-concurrency-fixture-x'
    );
    delete from public.words
    where word = 'word-deletion-concurrency-fixture-x';
    delete from public.logs
    where word = 'word-deletion-concurrency-fixture-x';
    delete from public.docs_logs
    where word = 'word-deletion-concurrency-fixture-x';
    delete from public.docs
    where (id = 930001 and name = 'word-deletion-concurrency-theme')
       or (id = 930002 and name = 'x')
       or (id = 201 and name = 'word-deletion-concurrency-special-201')
       or (id = 202 and name = 'word-deletion-concurrency-special-202');
    delete from public.themes where code = 'delete-concurrency-930001';
    delete from public.user_month_contributions
    where user_id in (
        '00000000-0000-4000-8000-0000000000c6',
        '00000000-0000-4000-8000-0000000000c7',
        '00000000-0000-4000-8000-0000000000c8'
    );
    delete from public.users
    where id in (
        '00000000-0000-4000-8000-0000000000c6',
        '00000000-0000-4000-8000-0000000000c7',
        '00000000-0000-4000-8000-0000000000c8'
    );
    delete from auth.users
    where id in (
        '00000000-0000-4000-8000-0000000000c6',
        '00000000-0000-4000-8000-0000000000c7',
        '00000000-0000-4000-8000-0000000000c8'
    );

    insert into auth.users (id) values
        ('00000000-0000-4000-8000-0000000000c6'),
        ('00000000-0000-4000-8000-0000000000c7'),
        ('00000000-0000-4000-8000-0000000000c8');
    insert into public.users (id, nickname, role) values
        ('00000000-0000-4000-8000-0000000000c6', 'deletion-concurrency-admin-a', 'admin'),
        ('00000000-0000-4000-8000-0000000000c7', 'deletion-concurrency-admin-b', 'admin'),
        ('00000000-0000-4000-8000-0000000000c8', 'deletion-concurrency-requester', 'r1');
    insert into public.themes (code, name)
    values ('delete-concurrency-930001', 'word-deletion-concurrency-theme');
    insert into public.docs (id, name, typez) values
        (930001, 'word-deletion-concurrency-theme', 'theme'),
        (930002, 'x', 'letter');
    insert into public.docs (id, name, typez) values
        (201, 'word-deletion-concurrency-special-201', 'ect'),
        (202, 'word-deletion-concurrency-special-202', 'ect')
    on conflict (id) do nothing;
    insert into public.words (word, k_canuse, noin_canuse, added_by)
    values (
        'word-deletion-concurrency-fixture-x', true, false,
        '00000000-0000-4000-8000-0000000000c6'
    );
    insert into public.word_themes (word_id, theme_id)
    select word_row.id, theme.id
    from public.words as word_row
    cross join public.themes as theme
    where word_row.word = 'word-deletion-concurrency-fixture-x'
      and theme.code = 'delete-concurrency-930001';
    insert into public.wait_words (
        word, word_id, request_type, requested_at, requested_by
    )
    select word_row.word, word_row.id, 'delete', '2020-01-01',
        '00000000-0000-4000-8000-0000000000c8'
    from public.words as word_row
    where word_row.word = 'word-deletion-concurrency-fixture-x';

    create function public.word_deletion_test_pause_apply()
    returns trigger
    language plpgsql
    as $function$
    begin
        perform pg_catalog.pg_advisory_xact_lock(9200821, 3);
        return old;
    end;
    $function$;
    create trigger word_deletion_test_pause_apply
        before delete on public.words
        for each row
        when (old.word = 'word-deletion-concurrency-fixture-x')
        execute function public.word_deletion_test_pause_apply();

    commit;
    $setup$
);

select pg_temp.word_deletion_connect_authenticated(
    'word_deletion_apply_a',
    '00000000-0000-4000-8000-0000000000c6'
);
select pg_temp.word_deletion_connect_authenticated(
    'word_deletion_apply_b',
    '00000000-0000-4000-8000-0000000000c7'
);

create temporary table word_deletion_concurrent_start_results (
    operation_id uuid not null,
    result jsonb not null
);
insert into word_deletion_concurrent_start_results (operation_id, result)
select '30000000-0000-4000-8000-000000000020', response.result
from extensions.dblink(
    'word_deletion_apply_a',
    $$select public.start_word_deletion_operation(
        '30000000-0000-4000-8000-000000000020', repeat('8', 64), 1, 1
    )$$
) as response(result jsonb);
insert into word_deletion_concurrent_start_results (operation_id, result)
select '30000000-0000-4000-8000-000000000021', response.result
from extensions.dblink(
    'word_deletion_apply_b',
    $$select public.start_word_deletion_operation(
        '30000000-0000-4000-8000-000000000021', repeat('9', 64), 1, 1
    )$$
) as response(result jsonb);

select is(
    (select pg_catalog.count(*)::integer from word_deletion_concurrent_start_results),
    2,
    'both independent authenticated sessions start an operation'
);
select is(
    (select pg_catalog.count(distinct result ->> 'operationId')::integer
     from word_deletion_concurrent_start_results),
    2,
    'the sessions start separate operations'
);

select extensions.dblink_exec(
    'word_deletion_setup',
    'do $lock$ begin perform pg_catalog.pg_advisory_lock(9200821, 3); end $lock$;'
);

do $apply$
begin
    perform extensions.dblink_send_query(
        'word_deletion_apply_a',
        $$select public.apply_word_deletion_batch(
            '30000000-0000-4000-8000-000000000020', 0, 1, repeat('a', 64),
            '[{"word":"word-deletion-concurrency-fixture-x"}]'::jsonb
        )$$
    );
    perform extensions.dblink_send_query(
        'word_deletion_apply_b',
        $$select public.apply_word_deletion_batch(
            '30000000-0000-4000-8000-000000000021', 0, 1, repeat('b', 64),
            '[{"word":"word-deletion-concurrency-fixture-x"}]'::jsonb
        )$$
    );
end;
$apply$;

create temporary table word_deletion_sync_observation (observed boolean not null);
do $synchronize$
declare
    lock_wait_count integer := 0;
begin
    for attempt in 1..100 loop
        select pg_catalog.count(*)::integer into lock_wait_count
        from pg_catalog.pg_stat_activity as activity
        where activity.application_name in (
            'word_deletion_apply_a', 'word_deletion_apply_b'
        )
          and activity.state = 'active'
          and activity.wait_event_type = 'Lock';
        exit when lock_wait_count = 2;
        perform pg_catalog.pg_sleep(0.05);
    end loop;
    insert into word_deletion_sync_observation values (lock_wait_count = 2);
    perform extensions.dblink_exec(
        'word_deletion_setup',
        'do $unlock$ begin perform pg_catalog.pg_advisory_unlock(9200821, 3); end $unlock$;'
    );
end;
$synchronize$;

select ok(
    (select observed from word_deletion_sync_observation),
    'both apply sessions overlap at the deterministic advisory/row-lock point'
);

create temporary table word_deletion_concurrent_apply_results (
    operation_id uuid not null,
    result jsonb not null
);
insert into word_deletion_concurrent_apply_results (operation_id, result)
select '30000000-0000-4000-8000-000000000020', response.result
from extensions.dblink_get_result('word_deletion_apply_a', false)
    as response(result jsonb);
insert into word_deletion_concurrent_apply_results (operation_id, result)
select '30000000-0000-4000-8000-000000000021', response.result
from extensions.dblink_get_result('word_deletion_apply_b', false)
    as response(result jsonb);
select response.result
from extensions.dblink_get_result('word_deletion_apply_a', false)
    as response(result jsonb);
select response.result
from extensions.dblink_get_result('word_deletion_apply_b', false)
    as response(result jsonb);

select is(
    (select pg_catalog.count(*)::integer from word_deletion_concurrent_apply_results),
    2,
    'both overlapping apply calls terminate successfully without deadlock'
);
select is(
    (select pg_catalog.sum((result ->> 'deletedWordCount')::integer)::integer
     from word_deletion_concurrent_apply_results),
    1,
    'the shared word is reported deleted once'
);
select is(
    (select pg_catalog.sum((result ->> 'missingWordCount')::integer)::integer
     from word_deletion_concurrent_apply_results),
    1,
    'the later overlapping operation reports the already-deleted word missing'
);
select is(
    (select pg_catalog.sum((result ->> 'processedRequestCount')::integer)::integer
     from word_deletion_concurrent_apply_results),
    1,
    'the shared deletion request is processed once'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.wait_words as wait_word
     where wait_word.word = 'word-deletion-concurrency-fixture-x'
       and wait_word.request_type = 'delete'),
    0,
    'the shared deletion request row is absent before replay and cleanup'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.word_deletion_operations as operation
     where operation.operation_id in (
        '30000000-0000-4000-8000-000000000020',
        '30000000-0000-4000-8000-000000000021'
     ) and operation.status = 'completed'),
    2,
    'both operations reach completed'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.word_deletion_batches as batch
     where batch.operation_id in (
        '30000000-0000-4000-8000-000000000020',
        '30000000-0000-4000-8000-000000000021'
     )),
    2,
    'both operations persist one batch row'
);
select is(
    (select pg_catalog.count(*)::integer from public.words as word_row
     where word_row.word = 'word-deletion-concurrency-fixture-x'),
    0,
    'the shared word row is absent after both operations'
);
select is(
    (select pg_catalog.count(*)::integer from public.logs as moderation_log
     where moderation_log.word = 'word-deletion-concurrency-fixture-x'
       and moderation_log.r_type = 'delete'
       and moderation_log.state = 'approved'
       and moderation_log.processed_by in (
            '00000000-0000-4000-8000-0000000000c6',
            '00000000-0000-4000-8000-0000000000c7'
       )),
    1,
    'one approved deletion moderation log records the winning actor'
);
select is(
    (select pg_catalog.count(*)::integer from public.docs_logs as docs_log
     where docs_log.word = 'word-deletion-concurrency-fixture-x'
       and docs_log.docs_id = 930001 and docs_log.type = 'delete'),
    1,
    'the direct theme docs target receives one deletion log'
);
select is(
    (select pg_catalog.count(*)::integer from public.docs_logs as docs_log
     where docs_log.word = 'word-deletion-concurrency-fixture-x'
       and docs_log.docs_id = 930002 and docs_log.type = 'delete'),
    1,
    'the direct letter docs target receives one deletion log'
);
select is(
    (select pg_catalog.count(*)::integer from public.docs_logs as docs_log
     where docs_log.word = 'word-deletion-concurrency-fixture-x'
       and docs_log.docs_id = 201 and docs_log.type = 'delete'),
    1,
    'legacy special docs target 201 receives one separate trigger log'
);
select is(
    (select pg_catalog.count(*)::integer from public.docs_logs as docs_log
     where docs_log.word = 'word-deletion-concurrency-fixture-x'
       and docs_log.docs_id = 202 and docs_log.type = 'delete'),
    1,
    'legacy special docs target 202 receives one separate trigger log'
);
select is(
    (select contribution from public.users as app_user
     where app_user.id = '00000000-0000-4000-8000-0000000000c8'),
    1,
    'the oldest whole-word deletion requester receives one contribution'
);
select is(
    (select pg_catalog.sum(app_user.contribution)::integer
     from public.users as app_user
     where app_user.id in (
        '00000000-0000-4000-8000-0000000000c6',
        '00000000-0000-4000-8000-0000000000c7'
     )),
    0,
    'neither actor receives requester-owned contribution'
);

create temporary table word_deletion_effects_before_replay as
select
    (select pg_catalog.count(*) from public.logs
     where word = 'word-deletion-concurrency-fixture-x') as log_count,
    (select pg_catalog.count(*) from public.docs_logs
     where word = 'word-deletion-concurrency-fixture-x'
       and type = 'delete') as docs_log_count,
    (select contribution from public.users
     where id = '00000000-0000-4000-8000-0000000000c8') as contribution,
    (select pg_catalog.count(*) from public.word_deletion_batches
     where operation_id in (
        '30000000-0000-4000-8000-000000000020',
        '30000000-0000-4000-8000-000000000021'
     )) as batch_count;

create temporary table word_deletion_replay_results (
    operation_id uuid not null,
    result jsonb not null
);
insert into word_deletion_replay_results (operation_id, result)
select '30000000-0000-4000-8000-000000000020', response.result
from extensions.dblink(
    'word_deletion_apply_a',
    $$select public.apply_word_deletion_batch(
        '30000000-0000-4000-8000-000000000020', 0, 1, repeat('a', 64),
        '[{"word":"word-deletion-concurrency-fixture-x"}]'::jsonb
    )$$
) as response(result jsonb);
insert into word_deletion_replay_results (operation_id, result)
select '30000000-0000-4000-8000-000000000021', response.result
from extensions.dblink(
    'word_deletion_apply_b',
    $$select public.apply_word_deletion_batch(
        '30000000-0000-4000-8000-000000000021', 0, 1, repeat('b', 64),
        '[{"word":"word-deletion-concurrency-fixture-x"}]'::jsonb
    )$$
) as response(result jsonb);

select is(
    (select pg_catalog.count(*)::integer
     from word_deletion_replay_results as replay
     join public.word_deletion_batches as batch
       on batch.operation_id = replay.operation_id
      and batch.batch_index = 0
     where replay.result = batch.result),
    2,
    'same-hash replay returns each completed operation stored result'
);
select ok(
    (select before.log_count = (select pg_catalog.count(*) from public.logs
        where word = 'word-deletion-concurrency-fixture-x')
      and before.docs_log_count = (select pg_catalog.count(*) from public.docs_logs
        where word = 'word-deletion-concurrency-fixture-x' and type = 'delete')
      and before.contribution = (select contribution from public.users
        where id = '00000000-0000-4000-8000-0000000000c8')
      and before.batch_count = (select pg_catalog.count(*) from public.word_deletion_batches
        where operation_id in (
            '30000000-0000-4000-8000-000000000020',
            '30000000-0000-4000-8000-000000000021'
        ))
     from word_deletion_effects_before_replay as before),
    'same-hash replay creates no new logs, contribution, or batch rows'
);
select ok(
    not has_function_privilege(
        'anon', 'public.start_word_deletion_operation(uuid,text,integer,integer)', 'EXECUTE'
    )
    and not has_function_privilege(
        'anon', 'public.get_word_deletion_operation(uuid)', 'EXECUTE'
    )
    and not has_function_privilege(
        'anon', 'public.apply_word_deletion_batch(uuid,integer,integer,text,jsonb)', 'EXECUTE'
    )
    and not has_function_privilege(
        'anon', 'public.cancel_word_deletion_operation(uuid)', 'EXECUTE'
    ),
    'concurrency support does not grant deletion RPC execution to anon'
);
select ok(
    has_function_privilege(
        'authenticated', 'public.start_word_deletion_operation(uuid,text,integer,integer)', 'EXECUTE'
    )
    and has_function_privilege(
        'authenticated', 'public.get_word_deletion_operation(uuid)', 'EXECUTE'
    )
    and has_function_privilege(
        'authenticated', 'public.apply_word_deletion_batch(uuid,integer,integer,text,jsonb)', 'EXECUTE'
    )
    and has_function_privilege(
        'authenticated', 'public.cancel_word_deletion_operation(uuid)', 'EXECUTE'
    ),
    'concurrency support preserves authenticated deletion RPC execution'
);

do $disconnect$
begin
    perform extensions.dblink_disconnect('word_deletion_apply_a');
    perform extensions.dblink_disconnect('word_deletion_apply_b');
end;
$disconnect$;

select extensions.dblink_exec(
    'word_deletion_setup',
    $cleanup$
    begin;

    drop trigger word_deletion_test_pause_apply on public.words;
    drop function public.word_deletion_test_pause_apply();
    delete from public.word_deletion_operations
    where operation_id in (
        '30000000-0000-4000-8000-000000000020',
        '30000000-0000-4000-8000-000000000021'
    );
    delete from public.word_themes_wait
    where word_id in (
        select word_row.id from public.words as word_row
        where word_row.word = 'word-deletion-concurrency-fixture-x'
    );
    delete from public.wait_words
    where word = 'word-deletion-concurrency-fixture-x';
    delete from public.word_themes
    where word_id in (
        select word_row.id from public.words as word_row
        where word_row.word = 'word-deletion-concurrency-fixture-x'
    );
    delete from public.words
    where word = 'word-deletion-concurrency-fixture-x';
    delete from public.logs
    where word = 'word-deletion-concurrency-fixture-x';
    delete from public.docs_logs
    where word = 'word-deletion-concurrency-fixture-x';
    delete from public.docs
    where (id = 930001 and name = 'word-deletion-concurrency-theme')
       or (id = 930002 and name = 'x')
       or (id = 201 and name = 'word-deletion-concurrency-special-201')
       or (id = 202 and name = 'word-deletion-concurrency-special-202');
    delete from public.themes where code = 'delete-concurrency-930001';
    delete from public.user_month_contributions
    where user_id in (
        '00000000-0000-4000-8000-0000000000c6',
        '00000000-0000-4000-8000-0000000000c7',
        '00000000-0000-4000-8000-0000000000c8'
    );
    delete from public.users
    where id in (
        '00000000-0000-4000-8000-0000000000c6',
        '00000000-0000-4000-8000-0000000000c7',
        '00000000-0000-4000-8000-0000000000c8'
    );
    delete from auth.users
    where id in (
        '00000000-0000-4000-8000-0000000000c6',
        '00000000-0000-4000-8000-0000000000c7',
        '00000000-0000-4000-8000-0000000000c8'
    );

    commit;
    $cleanup$
);

select extensions.dblink_disconnect('word_deletion_setup');

select ok(
    not exists (select 1 from public.word_deletion_operations where operation_id in (
        '30000000-0000-4000-8000-000000000020',
        '30000000-0000-4000-8000-000000000021'
    ))
    and not exists (select 1 from public.words
        where word = 'word-deletion-concurrency-fixture-x')
    and not exists (select 1 from public.logs
        where word = 'word-deletion-concurrency-fixture-x')
    and not exists (select 1 from public.docs_logs
        where word = 'word-deletion-concurrency-fixture-x')
    and not exists (select 1 from public.themes
        where code = 'delete-concurrency-930001')
    and not exists (select 1 from public.docs where
        (id = 930001 and name = 'word-deletion-concurrency-theme')
        or (id = 930002 and name = 'x')
        or (id = 201 and name = 'word-deletion-concurrency-special-201')
        or (id = 202 and name = 'word-deletion-concurrency-special-202'))
    and not exists (select 1 from public.users where id in (
        '00000000-0000-4000-8000-0000000000c6',
        '00000000-0000-4000-8000-0000000000c7',
        '00000000-0000-4000-8000-0000000000c8'
    )),
    'cleanup removes only the reserved fixture identifiers'
);
select ok(
    not exists (select 1 from pg_catalog.pg_trigger
        where tgname = 'word_deletion_test_pause_apply' and not tgisinternal)
    and pg_catalog.to_regprocedure(
        'public.word_deletion_test_pause_apply()'
    ) is null,
    'cleanup leaves no test synchronization trigger or function'
);

select * from finish();

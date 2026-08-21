create schema if not exists extensions;
create extension if not exists dblink with schema extensions;

create function pg_temp.direct_deletion_connection_string()
returns text
language sql
stable
as $function$
    select pg_catalog.format(
        'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres',
        pg_catalog.current_database()
    );
$function$;

create function pg_temp.direct_deletion_connect_authenticated(
    connection_name text,
    actor_id uuid
)
returns void
language plpgsql
as $function$
begin
    perform extensions.dblink_connect(
        connection_name, pg_temp.direct_deletion_connection_string()
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
    'direct_deletion_setup', pg_temp.direct_deletion_connection_string()
);
select extensions.dblink_exec(
    'direct_deletion_setup',
    $setup$
    begin;
    drop trigger if exists direct_deletion_concurrency_pause_log
        on public.logs;
    drop function if exists public.direct_deletion_concurrency_pause();
    drop function if exists public.direct_deletion_concurrency_call(bigint);
    delete from public.wait_word_themes where wait_word_id in (
        select id from public.wait_words
        where word = 'direct-delete-concurrency-fixture'
    );
    delete from public.wait_words
    where word = 'direct-delete-concurrency-fixture';
    delete from public.word_themes_wait where word_id in (
        select id from public.words
        where word = 'direct-delete-concurrency-fixture'
    );
    delete from public.word_themes where word_id in (
        select id from public.words
        where word = 'direct-delete-concurrency-fixture'
    );
    delete from public.words
    where word = 'direct-delete-concurrency-fixture';
    delete from public.logs
    where word = 'direct-delete-concurrency-fixture';
    delete from public.docs_logs
    where word = 'direct-delete-concurrency-fixture';
    delete from public.docs
    where id in (943001, 943002)
      and name in ('direct-delete-concurrency-theme', 'e');
    delete from public.themes
    where code = 'direct-delete-concurrency-theme';
    delete from public.user_month_contributions where user_id in (
        '44000000-0000-4000-8000-000000000001',
        '44000000-0000-4000-8000-000000000002',
        '44000000-0000-4000-8000-000000000003'
    );
    delete from public.users where id in (
        '44000000-0000-4000-8000-000000000001',
        '44000000-0000-4000-8000-000000000002',
        '44000000-0000-4000-8000-000000000003'
    );
    delete from auth.users where id in (
        '44000000-0000-4000-8000-000000000001',
        '44000000-0000-4000-8000-000000000002',
        '44000000-0000-4000-8000-000000000003'
    );
    insert into auth.users (id) values
        ('44000000-0000-4000-8000-000000000001'),
        ('44000000-0000-4000-8000-000000000002'),
        ('44000000-0000-4000-8000-000000000003');
    insert into public.users (id, nickname, role) values
        ('44000000-0000-4000-8000-000000000001',
         'direct-deletion-concurrency-admin-a', 'admin'),
        ('44000000-0000-4000-8000-000000000002',
         'direct-deletion-concurrency-admin-b', 'admin'),
        ('44000000-0000-4000-8000-000000000003',
         'direct-deletion-concurrency-owner', 'r1');
    insert into public.themes (code, name)
    values (
        'direct-delete-concurrency-theme',
        'direct-delete-concurrency-theme'
    );
    insert into public.docs (id, name, typez, last_update) values
        (943001, 'direct-delete-concurrency-theme', 'theme', '2000-01-01'),
        (943002, 'e', 'letter', '2000-01-01');
    insert into public.docs (id, name, typez)
    values
        (201, 'direct-delete-concurrency-special-201', 'ect'),
        (202, 'direct-delete-concurrency-special-202', 'ect')
    on conflict (id) do nothing;
    insert into public.words (word, k_canuse, noin_canuse, added_by)
    values (
        'direct-delete-concurrency-fixture', true, true,
        '44000000-0000-4000-8000-000000000003'
    );
    insert into public.word_themes (word_id, theme_id)
    select word_row.id, theme.id
    from public.words as word_row
    cross join public.themes as theme
    where word_row.word = 'direct-delete-concurrency-fixture'
      and theme.code = 'direct-delete-concurrency-theme';
    insert into public.wait_words (
        word, word_id, requested_by, request_type
    )
    select word_row.word, word_row.id,
           '44000000-0000-4000-8000-000000000003', 'delete'
    from public.words as word_row
    where word_row.word = 'direct-delete-concurrency-fixture';
    insert into public.wait_word_themes (wait_word_id, theme_id)
    select wait_word.id, theme.id
    from public.wait_words as wait_word
    cross join public.themes as theme
    where wait_word.word = 'direct-delete-concurrency-fixture'
      and theme.code = 'direct-delete-concurrency-theme';
    insert into public.word_themes_wait (word_id, theme_id, req_by, typez)
    select word_row.id, theme.id,
           '44000000-0000-4000-8000-000000000003', 'delete'
    from public.words as word_row
    cross join public.themes as theme
    where word_row.word = 'direct-delete-concurrency-fixture'
      and theme.code = 'direct-delete-concurrency-theme';

    create or replace function public.direct_deletion_concurrency_call(
        p_word_id bigint
    )
    returns jsonb
    language plpgsql
    security invoker
    set search_path = pg_catalog, public, pg_temp
    as $function$
    begin
        return pg_catalog.jsonb_build_object(
            'status', 'success',
            'result', public.delete_word_directly(p_word_id)
        );
    exception when others then
        return pg_catalog.jsonb_build_object(
            'status', 'error', 'message', sqlerrm
        );
    end;
    $function$;

    create or replace function public.direct_deletion_concurrency_pause()
    returns trigger
    language plpgsql
    as $function$
    begin
        if new.word = 'direct-delete-concurrency-fixture' then
            perform pg_catalog.pg_advisory_xact_lock(943021, 1);
        end if;
        return new;
    end;
    $function$;
    create trigger direct_deletion_concurrency_pause_log
    before insert on public.logs
    for each row execute function public.direct_deletion_concurrency_pause();
    commit;
    $setup$
);

select pg_temp.direct_deletion_connect_authenticated(
    'direct_deletion_apply_a', '44000000-0000-4000-8000-000000000001'
);
select pg_temp.direct_deletion_connect_authenticated(
    'direct_deletion_apply_b', '44000000-0000-4000-8000-000000000002'
);
create temporary table direct_deletion_connection_pids (
    connection_name text primary key,
    pid integer not null
);
insert into direct_deletion_connection_pids (connection_name, pid)
select 'direct_deletion_apply_a', response.pid
from extensions.dblink(
    'direct_deletion_apply_a', 'select pg_catalog.pg_backend_pid()'
) as response(pid integer);
insert into direct_deletion_connection_pids (connection_name, pid)
select 'direct_deletion_apply_b', response.pid
from extensions.dblink(
    'direct_deletion_apply_b', 'select pg_catalog.pg_backend_pid()'
) as response(pid integer);
create temporary table direct_deletion_concurrency_target (
    word_id bigint primary key,
    wait_word_id bigint not null unique
);
insert into direct_deletion_concurrency_target (word_id, wait_word_id)
select word_row.id, wait_word.id
from public.words as word_row
join public.wait_words as wait_word on wait_word.word_id = word_row.id
where word_row.word = 'direct-delete-concurrency-fixture';
select extensions.dblink_exec(
    'direct_deletion_setup',
    'do $lock$ begin perform pg_catalog.pg_advisory_lock(943021, 1); end $lock$;'
);

do $send_first$
declare
    target_word_id bigint;
begin
    select target.word_id into target_word_id
    from direct_deletion_concurrency_target as target;
    perform extensions.dblink_send_query(
        'direct_deletion_apply_a',
        pg_catalog.format(
            'select public.direct_deletion_concurrency_call(%s)',
            target_word_id
        )
    );
end;
$send_first$;

create temporary table direct_deletion_overlap_observation (
    first_session_locked boolean not null,
    second_session_blocked boolean not null
);
do $synchronize$
declare
    first_wait_count integer := 0;
    second_wait_count integer := 0;
    target_word_id bigint;
begin
    for attempt in 1..100 loop
        select pg_catalog.count(*)::integer into first_wait_count
        from pg_catalog.pg_locks as held_lock
        where held_lock.pid = (
            select connection.pid
            from direct_deletion_connection_pids as connection
            where connection.connection_name = 'direct_deletion_apply_a'
        )
          and not held_lock.granted;
        exit when first_wait_count > 0;
        perform pg_catalog.pg_sleep(0.05);
    end loop;

    select target.word_id into target_word_id
    from direct_deletion_concurrency_target as target;
    perform extensions.dblink_send_query(
        'direct_deletion_apply_b',
        pg_catalog.format(
            'select public.direct_deletion_concurrency_call(%s)',
            target_word_id
        )
    );

    for attempt in 1..100 loop
        select pg_catalog.count(*)::integer into second_wait_count
        from pg_catalog.pg_locks as held_lock
        where held_lock.pid = (
            select connection.pid
            from direct_deletion_connection_pids as connection
            where connection.connection_name = 'direct_deletion_apply_b'
        )
          and not held_lock.granted;
        exit when second_wait_count > 0;
        perform pg_catalog.pg_sleep(0.05);
    end loop;

    insert into direct_deletion_overlap_observation
    values (first_wait_count > 0, second_wait_count > 0);
    perform extensions.dblink_exec(
        'direct_deletion_setup',
        'do $unlock$ begin perform pg_catalog.pg_advisory_unlock(943021, 1); end $unlock$;'
    );
end;
$synchronize$;

select no_plan();

select ok(
    (select first_session_locked and second_session_blocked
     from direct_deletion_overlap_observation),
    'the first deleter holds the word lock while the second session blocks'
);

create temporary table direct_deletion_concurrent_results (
    result jsonb not null
);
insert into direct_deletion_concurrent_results (result)
select response.result
from extensions.dblink_get_result('direct_deletion_apply_a', false)
    as response(result jsonb);
insert into direct_deletion_concurrent_results (result)
select response.result
from extensions.dblink_get_result('direct_deletion_apply_b', false)
    as response(result jsonb);
select response.result
from extensions.dblink_get_result('direct_deletion_apply_a', false)
    as response(result jsonb);
select response.result
from extensions.dblink_get_result('direct_deletion_apply_b', false)
    as response(result jsonb);

select is(
    (select pg_catalog.count(*)::integer
     from direct_deletion_concurrent_results
     where result ->> 'status' = 'success'
       and result -> 'result' =
           '{"affectedDocsIds":[943001,943002],"deletedWordCount":1}'::jsonb),
    1,
    'exactly one concurrent direct deletion returns the success contract'
);
select is(
    (select pg_catalog.count(*)::integer
     from direct_deletion_concurrent_results
     where result ->> 'status' = 'error'
       and result ->> 'message' = 'DIRECT_WORD_DELETION_CONFLICT'),
    1,
    'the losing concurrent direct deletion returns conflict'
);
select is(
    (select pg_catalog.count(*)::integer from public.logs
     where word = 'direct-delete-concurrency-fixture'
       and make_by = '44000000-0000-4000-8000-000000000001'
       and processed_by = '44000000-0000-4000-8000-000000000001'
       and r_type = 'delete'
       and state = 'approved'),
    1,
    'concurrent direct deletion writes exactly one authoritative word log'
);
select ok(
    (select pg_catalog.count(*) = 1 from public.logs
     where word = 'direct-delete-concurrency-fixture'
       and r_type = 'delete')
    and (
        select pg_catalog.count(*) = 2
           and pg_catalog.count(distinct docs_log.docs_id) = 2
        from public.docs_logs as docs_log
        where docs_log.word = 'direct-delete-concurrency-fixture'
          and docs_log.docs_id in (943001, 943002)
          and docs_log.type = 'delete'
    ),
    'concurrent direct deletion writes one set of direct docs logs'
);
select is(
    (select pg_catalog.sum(app_user.contribution)::integer
     from public.users as app_user
     where app_user.id in (
        '44000000-0000-4000-8000-000000000001',
        '44000000-0000-4000-8000-000000000002'
     )),
    1,
    'concurrent direct deletion increments contribution exactly once'
);
select is(
    (select contribution from public.users
     where id = '44000000-0000-4000-8000-000000000001'),
    1,
    'the first lock holder is the successful administrator'
);
select ok(
    not exists (
        select 1 from public.words as word_row
        where word_row.id = (
            select target.word_id
            from direct_deletion_concurrency_target as target
        )
    )
    and not exists (
        select 1 from public.wait_words as wait_word
        where wait_word.id = (
            select target.wait_word_id
            from direct_deletion_concurrency_target as target
        )
    )
    and not exists (
        select 1 from public.wait_word_themes as wait_theme
        where wait_theme.wait_word_id = (
            select target.wait_word_id
            from direct_deletion_concurrency_target as target
        )
    )
    and not exists (
        select 1 from public.word_themes_wait as wait_theme
        where wait_theme.word_id = (
            select target.word_id
            from direct_deletion_concurrency_target as target
        )
    )
    and not exists (
        select 1 from public.word_themes as word_theme
        where word_theme.word_id = (
            select target.word_id
            from direct_deletion_concurrency_target as target
        )
    ),
    'concurrent deletion leaves no word or word request rows'
);

do $disconnect$
begin
    perform extensions.dblink_disconnect('direct_deletion_apply_a');
    perform extensions.dblink_disconnect('direct_deletion_apply_b');
end;
$disconnect$;

select extensions.dblink_exec(
    'direct_deletion_setup',
    $cleanup$
    begin;
    drop trigger direct_deletion_concurrency_pause_log on public.logs;
    drop function public.direct_deletion_concurrency_pause();
    drop function public.direct_deletion_concurrency_call(bigint);
    delete from public.wait_word_themes where wait_word_id in (
        select id from public.wait_words
        where word = 'direct-delete-concurrency-fixture'
    );
    delete from public.wait_words
    where word = 'direct-delete-concurrency-fixture';
    delete from public.word_themes_wait where word_id in (
        select id from public.words
        where word = 'direct-delete-concurrency-fixture'
    );
    delete from public.word_themes where word_id in (
        select id from public.words
        where word = 'direct-delete-concurrency-fixture'
    );
    delete from public.words
    where word = 'direct-delete-concurrency-fixture';
    delete from public.logs
    where word = 'direct-delete-concurrency-fixture';
    delete from public.docs_logs
    where word = 'direct-delete-concurrency-fixture';
    delete from public.docs
    where id in (943001, 943002)
      and name in ('direct-delete-concurrency-theme', 'e');
    delete from public.themes
    where code = 'direct-delete-concurrency-theme';
    delete from public.user_month_contributions where user_id in (
        '44000000-0000-4000-8000-000000000001',
        '44000000-0000-4000-8000-000000000002',
        '44000000-0000-4000-8000-000000000003'
    );
    delete from public.users where id in (
        '44000000-0000-4000-8000-000000000001',
        '44000000-0000-4000-8000-000000000002',
        '44000000-0000-4000-8000-000000000003'
    );
    delete from auth.users where id in (
        '44000000-0000-4000-8000-000000000001',
        '44000000-0000-4000-8000-000000000002',
        '44000000-0000-4000-8000-000000000003'
    );
    commit;
    $cleanup$
);
select extensions.dblink_disconnect('direct_deletion_setup');

select ok(
    not exists (select 1 from public.words
                where word = 'direct-delete-concurrency-fixture')
    and not exists (select 1 from public.logs
                    where word = 'direct-delete-concurrency-fixture')
    and not exists (select 1 from public.docs_logs
                    where word = 'direct-delete-concurrency-fixture')
    and pg_catalog.to_regprocedure(
        'public.direct_deletion_concurrency_call(bigint)'
    ) is null
    and not exists (
        select 1 from pg_catalog.pg_trigger
        where tgname = 'direct_deletion_concurrency_pause_log'
          and not tgisinternal
    ),
    'concurrency cleanup leaves no fixtures or synchronization objects'
);

select * from finish();

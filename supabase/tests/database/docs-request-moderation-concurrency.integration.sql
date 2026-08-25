create schema if not exists extensions;
create extension if not exists dblink with schema extensions;

create function pg_temp.docs_moderation_connection_string()
returns text
language sql
stable
as $function$
    select pg_catalog.format(
        'host=host.docker.internal port=55322 dbname=%s user=postgres password=postgres',
        pg_catalog.current_database()
    );
$function$;

create function pg_temp.docs_moderation_connect_authenticated(
    connection_name text,
    actor_id uuid
)
returns void
language plpgsql
as $function$
begin
    perform extensions.dblink_connect(
        connection_name, pg_temp.docs_moderation_connection_string()
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
    'docs_moderation_setup', pg_temp.docs_moderation_connection_string()
);
select extensions.dblink_exec(
    'docs_moderation_setup',
    $setup$
    begin;
    drop trigger if exists docs_moderation_concurrency_pause
        on public.docs;
    drop function if exists public.docs_moderation_concurrency_pause();
    drop function if exists public.docs_moderation_approve(jsonb);
    drop function if exists public.docs_moderation_reject(jsonb);
    delete from public.docs
    where name = 'docs-request-moderation-concurrency';
    delete from public.docs_wait where id = 920001;
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
         'docs-moderation-concurrency-admin-a', 'admin'),
        ('44000000-0000-4000-8000-000000000002',
         'docs-moderation-concurrency-admin-b', 'admin'),
        ('44000000-0000-4000-8000-000000000003',
         'docs-moderation-concurrency-requester', 'r1');
    insert into public.docs_wait (id, docs_name, req_by) values (
        920001, 'docs-request-moderation-concurrency',
        '44000000-0000-4000-8000-000000000003'
    );

    create or replace function public.docs_moderation_approve(payload jsonb)
    returns jsonb
    language plpgsql
    security invoker
    set search_path = ''
    as $function$
    begin
        return pg_catalog.jsonb_build_object(
            'status', 'success',
            'action', 'approve',
            'result', public.approve_docs_requests(payload)
        );
    exception when others then
        return pg_catalog.jsonb_build_object(
            'status', 'error', 'action', 'approve', 'message', sqlerrm
        );
    end;
    $function$;

    create or replace function public.docs_moderation_reject(payload jsonb)
    returns jsonb
    language plpgsql
    security invoker
    set search_path = ''
    as $function$
    begin
        return pg_catalog.jsonb_build_object(
            'status', 'success',
            'action', 'reject',
            'result', public.reject_docs_requests(payload)
        );
    exception when others then
        return pg_catalog.jsonb_build_object(
            'status', 'error', 'action', 'reject', 'message', sqlerrm
        );
    end;
    $function$;

    create or replace function public.docs_moderation_concurrency_pause()
    returns trigger
    language plpgsql
    security invoker
    set search_path = ''
    as $function$
    begin
        if new.name = 'docs-request-moderation-concurrency' then
            perform pg_catalog.pg_advisory_xact_lock(920021, 1);
        end if;
        return new;
    end;
    $function$;
    create trigger docs_moderation_concurrency_pause
    before insert on public.docs
    for each row execute function public.docs_moderation_concurrency_pause();
    commit;
    $setup$
);

select pg_temp.docs_moderation_connect_authenticated(
    'docs_moderation_approve_session',
    '44000000-0000-4000-8000-000000000001'
);
select pg_temp.docs_moderation_connect_authenticated(
    'docs_moderation_reject_session',
    '44000000-0000-4000-8000-000000000002'
);

create temporary table docs_moderation_connection_pids (
    action text primary key,
    pid integer not null
);
insert into docs_moderation_connection_pids (action, pid)
select 'approve', response.pid
from extensions.dblink(
    'docs_moderation_approve_session', 'select pg_catalog.pg_backend_pid()'
) as response(pid integer);
insert into docs_moderation_connection_pids (action, pid)
select 'reject', response.pid
from extensions.dblink(
    'docs_moderation_reject_session', 'select pg_catalog.pg_backend_pid()'
) as response(pid integer);

select extensions.dblink_exec(
    'docs_moderation_setup',
    'do $lock$ begin perform pg_catalog.pg_advisory_lock(920021, 1); end $lock$;'
);
select extensions.dblink_send_query(
    'docs_moderation_approve_session',
    $$select public.docs_moderation_approve(
        '[{"requestId":920001,"duem":true}]'::jsonb
    )$$
);

create temporary table docs_moderation_overlap_observation (
    approval_waited boolean not null,
    rejection_waited boolean not null
);
do $race$
declare
    approval_is_waiting boolean := false;
    rejection_is_waiting boolean := false;
    approval_pid integer;
    rejection_pid integer;
begin
    select pid into approval_pid
    from docs_moderation_connection_pids where action = 'approve';
    select pid into rejection_pid
    from docs_moderation_connection_pids where action = 'reject';

    for attempt in 1..100 loop
        select exists (
            select 1 from pg_catalog.pg_locks
            where pid = approval_pid and not granted
        ) into approval_is_waiting;
        exit when approval_is_waiting;
        perform pg_catalog.pg_sleep(0.05);
    end loop;

    perform extensions.dblink_send_query(
        'docs_moderation_reject_session',
        $$select public.docs_moderation_reject('[920001]'::jsonb)$$
    );
    for attempt in 1..100 loop
        select exists (
            select 1 from pg_catalog.pg_locks
            where pid = rejection_pid and not granted
        ) into rejection_is_waiting;
        exit when rejection_is_waiting;
        perform pg_catalog.pg_sleep(0.05);
    end loop;

    insert into docs_moderation_overlap_observation
    values (approval_is_waiting, rejection_is_waiting);
    perform extensions.dblink_exec(
        'docs_moderation_setup',
        'do $unlock$ begin perform pg_catalog.pg_advisory_unlock(920021, 1); end $unlock$;'
    );
end;
$race$;

select no_plan();

select ok(
    (select approval_waited and rejection_waited
     from docs_moderation_overlap_observation),
    'approval and rejection overlap at real lock contention'
);

create temporary table docs_moderation_concurrent_results (
    result jsonb not null
);
insert into docs_moderation_concurrent_results (result)
select response.result
from extensions.dblink_get_result(
    'docs_moderation_approve_session', false
) as response(result jsonb);
insert into docs_moderation_concurrent_results (result)
select response.result
from extensions.dblink_get_result(
    'docs_moderation_reject_session', false
) as response(result jsonb);
select response.result
from extensions.dblink_get_result(
    'docs_moderation_approve_session', false
) as response(result jsonb);
select response.result
from extensions.dblink_get_result(
    'docs_moderation_reject_session', false
) as response(result jsonb);

select is(
    (select pg_catalog.count(*)::integer
     from docs_moderation_concurrent_results
     where result ->> 'status' = 'success'),
    1,
    'exactly one concurrent docs moderation transaction succeeds'
);
select is(
    (select pg_catalog.count(*)::integer
     from docs_moderation_concurrent_results
     where result ->> 'status' = 'error'
       and result ->> 'message' = 'DOCS_REQUEST_MODERATION_CONFLICT'),
    1,
    'the losing concurrent docs moderation transaction returns conflict'
);
select is(
    (select pg_catalog.count(*)::integer from public.docs_wait
     where id = 920001),
    0,
    'the raced wait row is removed exactly once'
);
select ok(
    (
        select case result ->> 'action'
            when 'approve' then exists (
                select 1 from public.docs
                where name = 'docs-request-moderation-concurrency'
                  and duem is true
                  and maker =
                      '44000000-0000-4000-8000-000000000003'::uuid
            )
            when 'reject' then not exists (
                select 1 from public.docs
                where name = 'docs-request-moderation-concurrency'
            )
            else false
        end
        from docs_moderation_concurrent_results
        where result ->> 'status' = 'success'
    ),
    'the docs side effect matches the winning action'
);
select ok(
    (select pg_catalog.count(*) from public.docs
     where name = 'docs-request-moderation-concurrency') between 0 and 1,
    'the approval side effect is never duplicated'
);

do $disconnect$
begin
    perform extensions.dblink_disconnect('docs_moderation_approve_session');
    perform extensions.dblink_disconnect('docs_moderation_reject_session');
end;
$disconnect$;

select extensions.dblink_exec(
    'docs_moderation_setup',
    $cleanup$
    begin;
    drop trigger docs_moderation_concurrency_pause on public.docs;
    drop function public.docs_moderation_concurrency_pause();
    drop function public.docs_moderation_approve(jsonb);
    drop function public.docs_moderation_reject(jsonb);
    delete from public.docs
    where name = 'docs-request-moderation-concurrency';
    delete from public.docs_wait where id = 920001;
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
select extensions.dblink_disconnect('docs_moderation_setup');

select ok(
    not exists (
        select 1 from public.docs
        where name = 'docs-request-moderation-concurrency'
    )
    and not exists (select 1 from public.docs_wait where id = 920001)
    and pg_catalog.to_regprocedure(
        'public.docs_moderation_approve(jsonb)'
    ) is null
    and pg_catalog.to_regprocedure(
        'public.docs_moderation_reject(jsonb)'
    ) is null,
    'concurrency cleanup leaves no fixtures or synchronization functions'
);

select * from finish();

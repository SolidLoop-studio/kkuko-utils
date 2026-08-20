begin;

create schema if not exists extensions;
create extension if not exists dblink with schema extensions;

select plan(4);

do $outer$
begin
    perform extensions.dblink_connect(
        'word_approval_setup',
        pg_catalog.format('dbname=%s', pg_catalog.current_database())
    );
    perform extensions.dblink_exec(
        'word_approval_setup',
        $$delete from public.word_approval_operations
          where operation_id in (
              '10000000-0000-4000-8000-000000000004',
              '10000000-0000-4000-8000-000000000005'
          )$$
    );
    perform extensions.dblink_exec(
        'word_approval_setup',
        $$delete from public.users
          where id = '00000000-0000-4000-8000-0000000000b1'$$
    );
    perform extensions.dblink_exec(
        'word_approval_setup',
        $$insert into public.users (id, nickname, role)
          values ('00000000-0000-4000-8000-0000000000b1', '승인동시성관리자', 'admin')$$
    );
    perform extensions.dblink_exec(
        'word_approval_setup',
        $ddl$
        create or replace function public.word_approval_test_pause_start()
        returns trigger
        language plpgsql
        as $function$
        begin
            perform pg_catalog.pg_sleep(0.75);
            return new;
        end;
        $function$
        $ddl$
    );
    perform extensions.dblink_exec(
        'word_approval_setup',
        $$drop trigger if exists word_approval_test_pause_start
          on public.word_approval_operations$$
    );
    perform extensions.dblink_exec(
        'word_approval_setup',
        $$create trigger word_approval_test_pause_start
          before insert on public.word_approval_operations
          for each row
          when (new.input_hash = repeat('1', 64))
          execute function public.word_approval_test_pause_start()$$
    );
end;
$outer$;

do $$
declare
    connection_name text;
begin
    foreach connection_name in array array['word_approval_a', 'word_approval_b'] loop
        perform extensions.dblink_connect(
            connection_name,
            pg_catalog.format('dbname=%s', pg_catalog.current_database())
        );
        perform extensions.dblink_exec(connection_name, 'set role authenticated');
        perform extensions.dblink_exec(
            connection_name,
            $$set request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000b1'$$
        );
        perform extensions.dblink_exec(
            connection_name,
            $$set request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}'$$
        );
    end loop;

    perform extensions.dblink_send_query(
        'word_approval_a',
        $$select public.start_word_approval_operation(
            '10000000-0000-4000-8000-000000000004', repeat('1', 64), 1, 1
        )$$
    );
    perform extensions.dblink_send_query(
        'word_approval_b',
        $$select public.start_word_approval_operation(
            '10000000-0000-4000-8000-000000000005', repeat('1', 64), 1, 1
        )$$
    );
end;
$$;

create temporary table word_approval_concurrent_results (result jsonb not null);
insert into word_approval_concurrent_results (result)
select response.result
from extensions.dblink_get_result('word_approval_a') as response(result jsonb);
insert into word_approval_concurrent_results (result)
select response.result
from extensions.dblink_get_result('word_approval_b') as response(result jsonb);

select is(
    (select pg_catalog.count(*)::integer from word_approval_concurrent_results),
    2,
    '두 overlapping start 호출이 모두 성공한다'
);
select is(
    (select pg_catalog.count(distinct result ->> 'operationId')::integer
     from word_approval_concurrent_results),
    1,
    'overlapping 같은-hash start는 하나의 authoritative operation ID를 반환한다'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.word_approval_operations as operation
     where operation.actor_id = '00000000-0000-4000-8000-0000000000b1'
       and operation.input_hash = repeat('1', 64)
       and operation.status = 'running'),
    1,
    'overlapping start는 running operation row를 하나만 만든다'
);
select is(
    (select pg_catalog.count(*)::integer
     from word_approval_concurrent_results
     where result ->> 'status' = 'running'),
    2,
    '두 호출 모두 같은 running 상태를 관찰한다'
);

do $$
begin
    perform extensions.dblink_disconnect('word_approval_a');
    perform extensions.dblink_disconnect('word_approval_b');
    perform extensions.dblink_exec(
        'word_approval_setup',
        $$drop trigger word_approval_test_pause_start
          on public.word_approval_operations$$
    );
    perform extensions.dblink_exec(
        'word_approval_setup',
        $$drop function public.word_approval_test_pause_start()$$
    );
    perform extensions.dblink_exec(
        'word_approval_setup',
        $$delete from public.word_approval_operations
          where operation_id in (
              '10000000-0000-4000-8000-000000000004',
              '10000000-0000-4000-8000-000000000005'
          )$$
    );
    perform extensions.dblink_exec(
        'word_approval_setup',
        $$delete from public.users
          where id = '00000000-0000-4000-8000-0000000000b1'$$
    );
    perform extensions.dblink_disconnect('word_approval_setup');
end;
$$;

select * from finish();
rollback;

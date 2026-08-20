create schema if not exists extensions;
create extension if not exists dblink with schema extensions;

select plan(16);

create function pg_temp.word_approval_test_connection_string()
returns text
language sql
stable
as $function$
    select pg_catalog.format(
        'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres',
        pg_catalog.current_database()
    );
$function$;

create function pg_temp.word_approval_connect_authenticated(
    connection_name text,
    actor_id uuid
)
returns void
language plpgsql
as $function$
begin
    perform extensions.dblink_connect(
        connection_name,
        pg_temp.word_approval_test_connection_string()
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
    'word_approval_setup',
    pg_temp.word_approval_test_connection_string()
);

select extensions.dblink_exec(
    'word_approval_setup',
    $setup$
    begin;

    drop trigger if exists word_approval_test_pause_start
        on public.word_approval_operations;
    drop trigger if exists word_approval_test_pause_apply
        on public.words;
    drop function if exists public.word_approval_test_pause_start();
    drop function if exists public.word_approval_test_pause_apply();

    delete from public.word_approval_operations
    where operation_id in (
        '10000000-0000-4000-8000-000000000004',
        '10000000-0000-4000-8000-000000000005',
        '10000000-0000-4000-8000-000000000006',
        '10000000-0000-4000-8000-000000000007'
    );
    delete from public.wait_word_themes
    where wait_word_id in (
        select wait_word.id
        from public.wait_words as wait_word
        where wait_word.word = '승인동시적용※'
    );
    delete from public.wait_words where word = '승인동시적용※';
    delete from public.word_themes
    where word_id in (
        select word_row.id
        from public.words as word_row
        where word_row.word = '승인동시적용※'
    );
    delete from public.words where word = '승인동시적용※';
    delete from public.logs where word = '승인동시적용※';
    delete from public.docs_logs where word = '승인동시적용※';
    delete from public.docs where name in ('승인동시성주제', '※');
    delete from public.themes where code = '9914';
    delete from public.user_month_contributions
    where user_id in (
        '00000000-0000-4000-8000-0000000000b1',
        '00000000-0000-4000-8000-0000000000b2',
        '00000000-0000-4000-8000-0000000000b3'
    );
    delete from public.users
    where id in (
        '00000000-0000-4000-8000-0000000000b1',
        '00000000-0000-4000-8000-0000000000b2',
        '00000000-0000-4000-8000-0000000000b3'
    );
    delete from auth.users
    where id in (
        '00000000-0000-4000-8000-0000000000b1',
        '00000000-0000-4000-8000-0000000000b2',
        '00000000-0000-4000-8000-0000000000b3'
    );

    insert into auth.users (id)
    values
        ('00000000-0000-4000-8000-0000000000b1'),
        ('00000000-0000-4000-8000-0000000000b2'),
        ('00000000-0000-4000-8000-0000000000b3');
    insert into public.users (id, nickname, role)
    values
        ('00000000-0000-4000-8000-0000000000b1', '승인동시성관리자A', 'admin'),
        ('00000000-0000-4000-8000-0000000000b2', '승인동시성관리자B', 'admin'),
        ('00000000-0000-4000-8000-0000000000b3', '승인동시성기여자', 'r1');
    insert into public.themes (code, name)
    values ('9914', '승인동시성주제');
    insert into public.docs (name, typez)
    values ('승인동시성주제', 'theme'), ('※', 'letter');
    insert into public.wait_words (word, requested_by, request_type)
    values (
        '승인동시적용※',
        '00000000-0000-4000-8000-0000000000b3',
        'add'
    );
    insert into public.wait_word_themes (wait_word_id, theme_id)
    select wait_word.id, theme.id
    from public.wait_words as wait_word
    cross join public.themes as theme
    where wait_word.word = '승인동시적용※'
      and theme.code = '9914';

    create function public.word_approval_test_pause_start()
    returns trigger
    language plpgsql
    as $function$
    begin
        perform pg_catalog.pg_sleep(0.75);
        return new;
    end;
    $function$;
    create function public.word_approval_test_pause_apply()
    returns trigger
    language plpgsql
    as $function$
    begin
        perform pg_catalog.pg_sleep(0.75);
        return new;
    end;
    $function$;
    create trigger word_approval_test_pause_start
        before insert on public.word_approval_operations
        for each row
        when (new.input_hash = repeat('1', 64))
        execute function public.word_approval_test_pause_start();
    create trigger word_approval_test_pause_apply
        before insert on public.words
        for each row
        when (new.word = '승인동시적용※')
        execute function public.word_approval_test_pause_apply();

    commit;
    $setup$
);

select pg_temp.word_approval_connect_authenticated(
    'word_approval_start_a',
    '00000000-0000-4000-8000-0000000000b1'
);
select pg_temp.word_approval_connect_authenticated(
    'word_approval_start_b',
    '00000000-0000-4000-8000-0000000000b1'
);

do $start$
begin
    perform extensions.dblink_send_query(
        'word_approval_start_a',
        $$select public.start_word_approval_operation(
            '10000000-0000-4000-8000-000000000004', repeat('1', 64), 1, 1
        )$$
    );
    perform extensions.dblink_send_query(
        'word_approval_start_b',
        $$select public.start_word_approval_operation(
            '10000000-0000-4000-8000-000000000005', repeat('1', 64), 1, 1
        )$$
    );
end;
$start$;

create temporary table word_approval_concurrent_start_results (result jsonb not null);
insert into word_approval_concurrent_start_results (result)
select response.result
from extensions.dblink_get_result('word_approval_start_a') as response(result jsonb);
insert into word_approval_concurrent_start_results (result)
select response.result
from extensions.dblink_get_result('word_approval_start_b') as response(result jsonb);

select is(
    (select pg_catalog.count(*)::integer from word_approval_concurrent_start_results),
    2,
    '두 overlapping start 호출이 모두 성공한다'
);
select is(
    (select pg_catalog.count(distinct result ->> 'operationId')::integer
     from word_approval_concurrent_start_results),
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
     from word_approval_concurrent_start_results
     where result ->> 'status' = 'running'),
    2,
    '두 호출 모두 같은 running 상태를 관찰한다'
);

select pg_temp.word_approval_connect_authenticated(
    'word_approval_apply_a',
    '00000000-0000-4000-8000-0000000000b1'
);
select pg_temp.word_approval_connect_authenticated(
    'word_approval_apply_b',
    '00000000-0000-4000-8000-0000000000b2'
);

do $apply$
begin
    perform response.result
    from extensions.dblink(
        'word_approval_apply_a',
        $$select public.start_word_approval_operation(
            '10000000-0000-4000-8000-000000000006', repeat('2', 64), 1, 1
        )$$
    ) as response(result jsonb);
    perform response.result
    from extensions.dblink(
        'word_approval_apply_b',
        $$select public.start_word_approval_operation(
            '10000000-0000-4000-8000-000000000007', repeat('3', 64), 1, 1
        )$$
    ) as response(result jsonb);

    perform extensions.dblink_send_query(
        'word_approval_apply_a',
        $$select public.apply_word_approval_batch(
            '10000000-0000-4000-8000-000000000006', 0, 1, repeat('4', 64),
            '[{"word":"승인동시적용※","themeCodes":["9914"],"noinCanUse":false}]'::jsonb
        )$$
    );
    perform extensions.dblink_send_query(
        'word_approval_apply_b',
        $$select public.apply_word_approval_batch(
            '10000000-0000-4000-8000-000000000007', 0, 1, repeat('5', 64),
            '[{"word":"승인동시적용※","themeCodes":["9914"],"noinCanUse":false}]'::jsonb
        )$$
    );
end;
$apply$;

create temporary table word_approval_concurrent_apply_results (result jsonb not null);
insert into word_approval_concurrent_apply_results (result)
select response.result
from extensions.dblink_get_result('word_approval_apply_a') as response(result jsonb);
insert into word_approval_concurrent_apply_results (result)
select response.result
from extensions.dblink_get_result('word_approval_apply_b') as response(result jsonb);

select is(
    (select pg_catalog.count(*)::integer from word_approval_concurrent_apply_results),
    2,
    '두 overlapping apply 호출이 모두 성공한다'
);
select is(
    (select pg_catalog.sum((result ->> 'approvedWordCount')::integer)::integer
     from word_approval_concurrent_apply_results),
    1,
    'overlapping apply는 신규 단어를 한 번만 승인한다'
);
select is(
    (select pg_catalog.sum((result ->> 'addedThemeCount')::integer)::integer
     from word_approval_concurrent_apply_results),
    1,
    'overlapping apply는 주제 관계를 한 번만 추가한다'
);
select is(
    (select pg_catalog.sum((result ->> 'processedRequestCount')::integer)::integer
     from word_approval_concurrent_apply_results),
    1,
    'overlapping apply는 대기 요청을 한 번만 처리한다'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.words as word_row
     where word_row.word = '승인동시적용※'),
    1,
    'affected word row는 하나만 존재한다'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.word_themes as word_theme
     join public.words as word_row on word_row.id = word_theme.word_id
     join public.themes as theme on theme.id = word_theme.theme_id
     where word_row.word = '승인동시적용※'
       and theme.code = '9914'),
    1,
    'affected word-theme row는 하나만 존재한다'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.logs as approval_log
     where approval_log.word = '승인동시적용※'),
    1,
    'overlapping apply는 승인 로그를 한 번만 생성한다'
);
select is(
    (select app_user.contribution
     from public.users as app_user
     where app_user.id = '00000000-0000-4000-8000-0000000000b3'),
    1,
    'overlapping apply는 기여도를 한 번만 증가시킨다'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.wait_words as wait_word
     where wait_word.word = '승인동시적용※'),
    0,
    'overlapping apply 이후 대기 요청은 남지 않는다'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.word_approval_operations as operation
     where operation.operation_id in (
         '10000000-0000-4000-8000-000000000006',
         '10000000-0000-4000-8000-000000000007'
     )
       and operation.status = 'completed'),
    2,
    '각 overlapping apply operation이 completed 상태가 된다'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.word_approval_batches as batch
     where batch.operation_id in (
         '10000000-0000-4000-8000-000000000006',
         '10000000-0000-4000-8000-000000000007'
     )),
    2,
    '각 overlapping apply operation에 batch metadata가 기록된다'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.docs_logs as docs_log
     where docs_log.word = '승인동시적용※'),
    2,
    'overlapping apply는 글자 및 주제 docs 로그를 한 번씩 생성한다'
);

do $disconnect$
begin
    perform extensions.dblink_disconnect('word_approval_start_a');
    perform extensions.dblink_disconnect('word_approval_start_b');
    perform extensions.dblink_disconnect('word_approval_apply_a');
    perform extensions.dblink_disconnect('word_approval_apply_b');
end;
$disconnect$;

select extensions.dblink_exec(
    'word_approval_setup',
    $cleanup$
    begin;

    drop trigger word_approval_test_pause_start
        on public.word_approval_operations;
    drop trigger word_approval_test_pause_apply
        on public.words;
    drop function public.word_approval_test_pause_start();
    drop function public.word_approval_test_pause_apply();
    delete from public.word_approval_operations
    where operation_id in (
        '10000000-0000-4000-8000-000000000004',
        '10000000-0000-4000-8000-000000000005',
        '10000000-0000-4000-8000-000000000006',
        '10000000-0000-4000-8000-000000000007'
    );
    delete from public.wait_word_themes
    where wait_word_id in (
        select wait_word.id
        from public.wait_words as wait_word
        where wait_word.word = '승인동시적용※'
    );
    delete from public.wait_words where word = '승인동시적용※';
    delete from public.word_themes
    where word_id in (
        select word_row.id
        from public.words as word_row
        where word_row.word = '승인동시적용※'
    );
    delete from public.words where word = '승인동시적용※';
    delete from public.logs where word = '승인동시적용※';
    delete from public.docs_logs where word = '승인동시적용※';
    delete from public.docs where name in ('승인동시성주제', '※');
    delete from public.themes where code = '9914';
    delete from public.user_month_contributions
    where user_id in (
        '00000000-0000-4000-8000-0000000000b1',
        '00000000-0000-4000-8000-0000000000b2',
        '00000000-0000-4000-8000-0000000000b3'
    );
    delete from public.users
    where id in (
        '00000000-0000-4000-8000-0000000000b1',
        '00000000-0000-4000-8000-0000000000b2',
        '00000000-0000-4000-8000-0000000000b3'
    );
    delete from auth.users
    where id in (
        '00000000-0000-4000-8000-0000000000b1',
        '00000000-0000-4000-8000-0000000000b2',
        '00000000-0000-4000-8000-0000000000b3'
    );

    commit;
    $cleanup$
);

select extensions.dblink_disconnect('word_approval_setup');
select * from finish();

begin;

select plan(43);

delete from public.word_approval_operations
where operation_id in (
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003'
);
delete from public.docs_logs where word in ('승인통합성공¤', '승인통합롤백¤');
delete from public.logs where word in ('승인통합성공¤', '승인통합롤백¤');
delete from public.wait_word_themes
where wait_word_id in (
    select wait_word.id
    from public.wait_words as wait_word
    where wait_word.word in ('승인통합성공¤', '승인통합롤백¤')
);
delete from public.wait_words where word in ('승인통합성공¤', '승인통합롤백¤');
delete from public.word_themes
where word_id in (
    select word_row.id
    from public.words as word_row
    where word_row.word in ('승인통합성공¤', '승인통합롤백¤')
);
delete from public.words where word in ('승인통합성공¤', '승인통합롤백¤');
delete from public.docs where name in ('승인통합주제', '¤');
delete from public.themes where code = '9913';
delete from public.user_month_contributions
where user_id in (
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-0000000000a2',
    '00000000-0000-4000-8000-0000000000a3',
    '00000000-0000-4000-8000-0000000000a4'
);
delete from public.users
where id in (
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-0000000000a2',
    '00000000-0000-4000-8000-0000000000a3',
    '00000000-0000-4000-8000-0000000000a4'
);

delete from auth.users
where id in (
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-0000000000a2',
    '00000000-0000-4000-8000-0000000000a3',
    '00000000-0000-4000-8000-0000000000a4'
);

insert into auth.users (id)
values
    ('00000000-0000-4000-8000-0000000000a1'),
    ('00000000-0000-4000-8000-0000000000a2'),
    ('00000000-0000-4000-8000-0000000000a3'),
    ('00000000-0000-4000-8000-0000000000a4');

insert into public.users (id, nickname, role)
values
    ('00000000-0000-4000-8000-0000000000a1', '승인통합관리자', 'admin'),
    ('00000000-0000-4000-8000-0000000000a2', '승인통합일반사용자', 'r1'),
    ('00000000-0000-4000-8000-0000000000a3', '승인통합다른관리자', 'admin'),
    ('00000000-0000-4000-8000-0000000000a4', '승인통합기여자', 'r1');
insert into public.themes (code, name) values ('9913', '승인통합주제');
insert into public.docs (name, typez)
values ('승인통합주제', 'theme'), ('¤', 'letter');

do $$
begin
    perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
    perform pg_catalog.set_config('request.jwt.claims', '{}', true);
end;
$$;
set local role authenticated;
select throws_ok(
    $$select public.start_word_approval_operation(
        '10000000-0000-4000-8000-000000000001', repeat('a', 64), 1, 1
    )$$,
    'P0001',
    'WORD_APPROVAL_UNAUTHORIZED',
    'authenticated 호출도 JWT actor가 없으면 거부한다'
);
reset role;

do $$
begin
    perform pg_catalog.set_config(
        'request.jwt.claim.sub',
        '00000000-0000-4000-8000-0000000000a2',
        true
    );
    perform pg_catalog.set_config(
        'request.jwt.claims',
        '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}',
        true
    );
end;
$$;
set local role authenticated;
select throws_ok(
    $$select public.start_word_approval_operation(
        '10000000-0000-4000-8000-000000000001', repeat('a', 64), 1, 1
    )$$,
    'P0001',
    'WORD_APPROVAL_FORBIDDEN',
    '일반 사용자는 승인 operation을 시작할 수 없다'
);
reset role;

select ok(
    not has_function_privilege(
        'anon',
        'public.apply_word_approval_batch(uuid,integer,integer,text,jsonb)',
        'EXECUTE'
    ),
    'anon에는 batch RPC 실행 권한이 없다'
);
select ok(
    has_function_privilege(
        'authenticated',
        'public.apply_word_approval_batch(uuid,integer,integer,text,jsonb)',
        'EXECUTE'
    ),
    'authenticated에는 batch RPC 실행 권한이 있다'
);
select is(
    (
        select pg_catalog.array_to_string(routine.proconfig, ',')
        from pg_catalog.pg_proc as routine
        where routine.oid =
            'public.apply_word_approval_batch(uuid,integer,integer,text,jsonb)'::pg_catalog.regprocedure
    ),
    'search_path=pg_catalog, public, pg_temp',
    'batch RPC는 trusted legacy-trigger search path만 사용한다'
);
select ok(
    not pg_catalog.has_schema_privilege('anon', 'public', 'CREATE')
    and not pg_catalog.has_schema_privilege('authenticated', 'public', 'CREATE')
    and not pg_catalog.has_schema_privilege('service_role', 'public', 'CREATE'),
    'RPC 호출 역할은 public 스키마에 객체를 만들 수 없다'
);

insert into public.wait_words (word, requested_by, request_type)
values ('승인통합성공¤', '00000000-0000-4000-8000-0000000000a4', 'add');
insert into public.wait_word_themes (wait_word_id, theme_id)
select wait_word.id, theme.id
from public.wait_words as wait_word
cross join public.themes as theme
where wait_word.word = '승인통합성공¤'
  and theme.code = '9913';

do $$
begin
    perform pg_catalog.set_config(
        'request.jwt.claim.sub',
        '00000000-0000-4000-8000-0000000000a1',
        true
    );
    perform pg_catalog.set_config(
        'request.jwt.claims',
        '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}',
        true
    );
end;
$$;
set local role authenticated;
create temporary table docs (
    name text not null,
    typez text not null,
    last_update timestamp without time zone not null
);
insert into docs (name, typez, last_update)
values ('¤', 'letter', '2000-01-01 00:00:00'::timestamp);
select is(
    public.start_word_approval_operation(
        '10000000-0000-4000-8000-000000000001', repeat('a', 64), 1, 1
    ) ->> 'operationId',
    '10000000-0000-4000-8000-000000000001',
    '관리자는 operation을 시작한다'
);
reset role;
select is(
    (select operation.status from public.word_approval_operations as operation
     where operation.operation_id = '10000000-0000-4000-8000-000000000001'),
    'running',
    '새 operation은 running 상태다'
);

set local role authenticated;
select is(
    (public.apply_word_approval_batch(
        '10000000-0000-4000-8000-000000000001',
        0,
        1,
        repeat('b', 64),
        '[{"word":"승인통합성공¤","themeCodes":["9913"],"noinCanUse":false}]'::jsonb
    ) ->> 'approvedWordCount')::integer,
    1,
    '성공 batch는 신규 단어 수를 반환한다'
);
reset role;

select is(
    (
        select shadow_docs.last_update
        from pg_temp.docs as shadow_docs
        where shadow_docs.name = '¤'
    ),
    '2000-01-01 00:00:00'::timestamp,
    'authenticated 임시 relation은 definer trigger의 public relation을 가로채지 못한다'
);

select is(
    (select (batch.result ->> 'addedThemeCount')::integer
     from public.word_approval_batches as batch
     where batch.operation_id = '10000000-0000-4000-8000-000000000001'
       and batch.batch_index = 0),
    1,
    '성공 batch는 주제 관계를 추가한다'
);
select is(
    (select (batch.result ->> 'processedRequestCount')::integer
     from public.word_approval_batches as batch
     where batch.operation_id = '10000000-0000-4000-8000-000000000001'
       and batch.batch_index = 0),
    1,
    '성공 batch는 대기 요청 처리 수를 기록한다'
);
select is(
    (select pg_catalog.jsonb_array_length(batch.result -> 'affectedDocsIds')
     from public.word_approval_batches as batch
     where batch.operation_id = '10000000-0000-4000-8000-000000000001'
       and batch.batch_index = 0),
    2,
    '성공 batch는 글자 및 주제 docs를 모두 반환한다'
);
select is(
    (select pg_catalog.count(*)::integer from public.words where word = '승인통합성공¤'),
    1,
    '단어 변경이 commit된다'
);
select is(
    (select pg_catalog.count(*)::integer from public.words
     where word = '승인통합성공¤' and noin_canuse = false),
    1,
    'noin_canuse 정책 결과가 저장된다'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.word_themes as word_theme
     join public.words as word_row on word_row.id = word_theme.word_id
     join public.themes as theme on theme.id = word_theme.theme_id
     where word_row.word = '승인통합성공¤' and theme.code = '9913'),
    1,
    '단어-주제 관계가 commit된다'
);
select is(
    (select pg_catalog.count(*)::integer from public.wait_words
     where word = '승인통합성공¤'),
    0,
    '처리한 단어 대기 요청이 제거된다'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.wait_word_themes as wait_theme
     join public.wait_words as wait_word on wait_word.id = wait_theme.wait_word_id
     where wait_word.word = '승인통합성공¤'),
    0,
    '처리한 대기 요청 주제도 제거된다'
);
select is(
    (select pg_catalog.count(*)::integer from public.logs where word = '승인통합성공¤'),
    1,
    '단어 승인 로그가 한 번 생성된다'
);
select is(
    (select pg_catalog.count(*)::integer from public.docs_logs where word = '승인통합성공¤'),
    2,
    '글자 및 주제 docs 로그가 생성된다'
);
select is(
    (select app_user.contribution from public.users as app_user
     where app_user.id = '00000000-0000-4000-8000-0000000000a4'),
    1,
    '신규 단어 기여도가 증가한다'
);
select is(
    (select app_user.month_contribution from public.users as app_user
     where app_user.id = '00000000-0000-4000-8000-0000000000a4'),
    1,
    '월 기여도도 증가한다'
);
select is(
    (select operation.status from public.word_approval_operations as operation
     where operation.operation_id = '10000000-0000-4000-8000-000000000001'),
    'completed',
    '마지막 batch는 operation을 completed로 만든다'
);
select is(
    (select pg_catalog.count(*)::integer from public.word_approval_batches as batch
     where batch.operation_id = '10000000-0000-4000-8000-000000000001'),
    1,
    '완료 batch metadata가 기록된다'
);

set local role authenticated;
select is(
    (public.apply_word_approval_batch(
        '10000000-0000-4000-8000-000000000001',
        0,
        1,
        repeat('b', 64),
        '[{"word":"승인통합성공¤","themeCodes":["9913"],"noinCanUse":false}]'::jsonb
    ) ->> 'approvedWordCount')::integer,
    1,
    '같은 hash replay는 기존 결과를 반환한다'
);
reset role;
select is(
    (select pg_catalog.count(*)::integer from public.logs where word = '승인통합성공¤'),
    1,
    '같은 hash replay는 단어 로그를 중복 생성하지 않는다'
);
select is(
    (select pg_catalog.count(*)::integer from public.docs_logs where word = '승인통합성공¤'),
    2,
    '같은 hash replay는 docs 로그를 중복 생성하지 않는다'
);
select is(
    (select app_user.contribution from public.users as app_user
     where app_user.id = '00000000-0000-4000-8000-0000000000a4'),
    1,
    '같은 hash replay는 기여도를 중복 반영하지 않는다'
);

set local role authenticated;
select throws_ok(
    $$select public.apply_word_approval_batch(
        '10000000-0000-4000-8000-000000000001',
        0,
        1,
        repeat('c', 64),
        '[{"word":"승인통합성공¤","themeCodes":["9913"],"noinCanUse":false}]'::jsonb
    )$$,
    'P0001',
    'WORD_APPROVAL_CONFLICT',
    '같은 batch index의 다른 hash는 conflict다'
);
reset role;
select is(
    (select batch.payload_hash from public.word_approval_batches as batch
     where batch.operation_id = '10000000-0000-4000-8000-000000000001'
       and batch.batch_index = 0),
    repeat('b', 64),
    '다른 hash conflict는 완료 metadata를 변경하지 않는다'
);

insert into public.wait_words (word, requested_by, request_type)
values ('승인통합롤백¤', '00000000-0000-4000-8000-0000000000a4', 'add');
set local role authenticated;
select lives_ok(
    $$select public.start_word_approval_operation(
        '10000000-0000-4000-8000-000000000002', repeat('d', 64), 1, 1
    )$$,
    'rollback 검증 operation을 시작한다'
);
reset role;

create function pg_temp.fail_word_approval_log()
returns trigger
language plpgsql
as $$
begin
    if new.word = '승인통합롤백¤' then
        raise exception 'WORD_APPROVAL_TEST_FORCED_FAILURE';
    end if;
    return new;
end;
$$;
create trigger word_approval_test_fail_log
before insert on public.logs
for each row execute function pg_temp.fail_word_approval_log();

set local role authenticated;
select throws_ok(
    $$select public.apply_word_approval_batch(
        '10000000-0000-4000-8000-000000000002',
        0,
        1,
        repeat('e', 64),
        '[{"word":"승인통합롤백¤","themeCodes":["9913"],"noinCanUse":false}]'::jsonb
    )$$,
    'P0001',
    'WORD_APPROVAL_INTERNAL_ERROR',
    '중간 side effect 실패는 공개 internal error로 반환된다'
);
reset role;
drop trigger word_approval_test_fail_log on public.logs;

select is(
    (select pg_catalog.count(*)::integer from public.words where word = '승인통합롤백¤'),
    0,
    '중간 실패 시 단어 insert가 rollback된다'
);
select is(
    (select pg_catalog.count(*)::integer from public.wait_words
     where word = '승인통합롤백¤'),
    1,
    '중간 실패 시 대기 요청 삭제가 rollback된다'
);
select is(
    (select pg_catalog.count(*)::integer from public.word_approval_batches as batch
     where batch.operation_id = '10000000-0000-4000-8000-000000000002'),
    0,
    '중간 실패 시 batch 완료 row가 기록되지 않는다'
);
select is(
    (select pg_catalog.count(*)::integer from public.logs where word = '승인통합롤백¤'),
    0,
    '중간 실패 시 로그가 남지 않는다'
);
select is(
    (select app_user.contribution from public.users as app_user
     where app_user.id = '00000000-0000-4000-8000-0000000000a4'),
    1,
    '중간 실패 시 기여도가 rollback된다'
);

set local role authenticated;
select lives_ok(
    $$select public.start_word_approval_operation(
        '10000000-0000-4000-8000-000000000003', repeat('f', 64), 2, 2
    )$$,
    '취소 검증 operation을 시작한다'
);
select is(
    public.cancel_word_approval_operation(
        '10000000-0000-4000-8000-000000000003'
    ) ->> 'status',
    'cancelled',
    'running operation을 취소한다'
);
select is(
    public.cancel_word_approval_operation(
        '10000000-0000-4000-8000-000000000003'
    ) ->> 'status',
    'cancelled',
    '취소 재호출은 멱등하게 cancelled를 반환한다'
);
select throws_ok(
    $$select public.apply_word_approval_batch(
        '10000000-0000-4000-8000-000000000003',
        0,
        2,
        repeat('0', 64),
        '[{"word":"취소후실행어","themeCodes":["9913"],"noinCanUse":false}]'::jsonb
    )$$,
    'P0001',
    'WORD_APPROVAL_CONFLICT',
    '취소된 operation은 batch를 실행할 수 없다'
);
reset role;

do $$
begin
    perform pg_catalog.set_config(
        'request.jwt.claim.sub',
        '00000000-0000-4000-8000-0000000000a3',
        true
    );
    perform pg_catalog.set_config(
        'request.jwt.claims',
        '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}',
        true
    );
end;
$$;
set local role authenticated;
select throws_ok(
    $$select public.get_word_approval_operation(
        '10000000-0000-4000-8000-000000000001'
    )$$,
    'P0001',
    'WORD_APPROVAL_NOT_FOUND',
    '다른 관리자는 operation을 조회할 수 없다'
);
select throws_ok(
    $$select public.cancel_word_approval_operation(
        '10000000-0000-4000-8000-000000000003'
    )$$,
    'P0001',
    'WORD_APPROVAL_FORBIDDEN',
    '다른 관리자는 operation을 취소할 수 없다'
);
reset role;

select * from finish();
rollback;

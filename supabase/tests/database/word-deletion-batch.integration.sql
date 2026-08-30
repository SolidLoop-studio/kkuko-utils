begin;

select no_plan();

create function pg_temp.authenticate(actor uuid)
returns void language plpgsql as $$
begin
    perform pg_catalog.set_config('request.jwt.claim.sub', coalesce(actor::text, ''), true);
    perform pg_catalog.set_config(
        'request.jwt.claims',
        case when actor is null then '{}' else
            pg_catalog.jsonb_build_object('sub', actor, 'role', 'authenticated')::text end,
        true
    );
end;
$$;

insert into auth.users (id) values
    ('00000000-0000-4000-8000-0000000000c1'),
    ('00000000-0000-4000-8000-0000000000c2'),
    ('00000000-0000-4000-8000-0000000000c3'),
    ('00000000-0000-4000-8000-0000000000c4'),
    ('00000000-0000-4000-8000-0000000000c5');
insert into public.users (id, nickname, role) values
    ('00000000-0000-4000-8000-0000000000c1', '삭제통합r4', 'r4'),
    ('00000000-0000-4000-8000-0000000000c2', '삭제통합r1', 'r1'),
    ('00000000-0000-4000-8000-0000000000c3', '삭제통합admin', 'admin'),
    ('00000000-0000-4000-8000-0000000000c4', '삭제통합요청자A', 'r1'),
    ('00000000-0000-4000-8000-0000000000c5', '삭제통합요청자B', 'r1');

select pg_temp.authenticate(null);
set local role authenticated;
select throws_ok(
    $$select public.start_word_deletion_operation(
        '30000000-0000-4000-8000-000000000001', repeat('a', 64), 1, 1
    )$$,
    'P0001', 'WORD_DELETION_UNAUTHORIZED', 'JWT actor가 없으면 거부한다'
);
reset role;

select pg_temp.authenticate('00000000-0000-4000-8000-0000000000c2');
set local role authenticated;
select throws_ok(
    $$select public.start_word_deletion_operation(
        '30000000-0000-4000-8000-000000000001', repeat('a', 64), 1, 1
    )$$,
    'P0001', 'WORD_DELETION_FORBIDDEN', 'r1 actor를 거부한다'
);
reset role;

select ok(not has_function_privilege(
    'anon', 'public.start_word_deletion_operation(uuid,text,integer,integer)', 'EXECUTE'
), 'anon에는 start 권한이 없다');
select ok(not has_function_privilege(
    'anon', 'public.get_word_deletion_operation(uuid)', 'EXECUTE'
), 'anon에는 get 권한이 없다');
select ok(not has_function_privilege(
    'anon', 'public.apply_word_deletion_batch(uuid,integer,integer,text,jsonb)', 'EXECUTE'
), 'anon에는 apply 권한이 없다');
select ok(not has_function_privilege(
    'anon', 'public.cancel_word_deletion_operation(uuid)', 'EXECUTE'
), 'anon에는 cancel 권한이 없다');
select ok(
    has_function_privilege('authenticated', 'public.start_word_deletion_operation(uuid,text,integer,integer)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.get_word_deletion_operation(uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.apply_word_deletion_batch(uuid,integer,integer,text,jsonb)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.cancel_word_deletion_operation(uuid)', 'EXECUTE'),
    'authenticated에는 네 RPC 권한이 있다'
);
select ok(
    has_function_privilege('service_role', 'public.start_word_deletion_operation(uuid,text,integer,integer)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.get_word_deletion_operation(uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.apply_word_deletion_batch(uuid,integer,integer,text,jsonb)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.cancel_word_deletion_operation(uuid)', 'EXECUTE'),
    'service_role에는 네 RPC 권한이 있다'
);
select is((
    select pg_catalog.count(*)::integer from pg_catalog.pg_proc as routine
    where routine.oid in (
        'public.start_word_deletion_operation(uuid,text,integer,integer)'::regprocedure,
        'public.get_word_deletion_operation(uuid)'::regprocedure,
        'public.apply_word_deletion_batch(uuid,integer,integer,text,jsonb)'::regprocedure,
        'public.cancel_word_deletion_operation(uuid)'::regprocedure
    ) and routine.prosecdef
), 4, '네 RPC는 SECURITY DEFINER다');
select is((
    select pg_catalog.count(*)::integer from pg_catalog.pg_proc as routine
    where routine.oid in (
        'public.start_word_deletion_operation(uuid,text,integer,integer)'::regprocedure,
        'public.get_word_deletion_operation(uuid)'::regprocedure,
        'public.apply_word_deletion_batch(uuid,integer,integer,text,jsonb)'::regprocedure,
        'public.cancel_word_deletion_operation(uuid)'::regprocedure
    ) and pg_catalog.array_to_string(routine.proconfig, ',') =
        'search_path=pg_catalog, public, pg_temp'
), 4, '네 RPC는 fixed trusted search path를 쓴다');
select is((
    select pg_catalog.count(*)::integer from pg_catalog.pg_class as relation
    where relation.oid in (
        'public.word_deletion_operations'::regclass,
        'public.word_deletion_batches'::regclass
    ) and relation.relrowsecurity
), 2, '두 내부 테이블에 RLS가 켜진다');
select is((
    select pg_catalog.count(*)::integer from pg_catalog.pg_policy as policy
    where policy.polrelid in (
        'public.word_deletion_operations'::regclass,
        'public.word_deletion_batches'::regclass
    )
), 0, '두 내부 테이블에는 direct policy가 없다');
select ok(
    not has_table_privilege('anon', 'public.word_deletion_operations', 'SELECT')
    and not has_table_privilege('authenticated', 'public.word_deletion_operations', 'SELECT')
    and not has_table_privilege('service_role', 'public.word_deletion_operations', 'SELECT')
    and not has_table_privilege('anon', 'public.word_deletion_batches', 'SELECT')
    and not has_table_privilege('authenticated', 'public.word_deletion_batches', 'SELECT')
    and not has_table_privilege('service_role', 'public.word_deletion_batches', 'SELECT'),
    '호출 role은 내부 테이블을 직접 읽지 못한다'
);

select pg_temp.authenticate('00000000-0000-4000-8000-0000000000c1');
set local role authenticated;
select throws_ok(
    $$select public.start_word_deletion_operation(null, repeat('a', 64), 1, 1)$$,
    'P0001', 'WORD_DELETION_INVALID_INPUT', 'null operation ID를 거부한다'
);
select throws_ok(
    $$select public.start_word_deletion_operation(
        '30000000-0000-4000-8000-000000000001', repeat('A', 64), 1, 1
    )$$,
    'P0001', 'WORD_DELETION_INVALID_INPUT', '잘못된 input hash를 거부한다'
);
select throws_ok(
    $$select public.start_word_deletion_operation(
        '30000000-0000-4000-8000-000000000001', repeat('a', 64), 51, 1
    )$$,
    'P0001', 'WORD_DELETION_INVALID_INPUT', '불가능한 total metadata를 거부한다'
);
select is(public.start_word_deletion_operation(
    '30000000-0000-4000-8000-000000000001', repeat('a', 64), 1, 1
) ->> 'operationId', '30000000-0000-4000-8000-000000000001', 'r4가 operation을 시작한다');
select is(public.start_word_deletion_operation(
    '30000000-0000-4000-8000-000000000002', repeat('a', 64), 1, 1
) ->> 'operationId', '30000000-0000-4000-8000-000000000001', '같은 actor/input은 running operation을 재사용한다');
select throws_ok(
    $$select public.start_word_deletion_operation(
        '30000000-0000-4000-8000-000000000002', repeat('a', 64), 2, 1
    )$$,
    'P0001', 'WORD_DELETION_CONFLICT', '재사용 operation metadata 불일치는 conflict다'
);
select is(public.get_word_deletion_operation(
    '30000000-0000-4000-8000-000000000001'
) ->> 'status', 'running', 'actor가 operation을 조회한다');
select lives_ok($$select public.start_word_deletion_operation(
    '30000000-0000-4000-8000-000000000003', repeat('b', 64), 1, 1
)$$, 'cancel 검증 operation을 시작한다');
select is(public.cancel_word_deletion_operation(
    '30000000-0000-4000-8000-000000000003'
) ->> 'status', 'cancelled', 'running operation을 취소한다');
select is(public.cancel_word_deletion_operation(
    '30000000-0000-4000-8000-000000000003'
) ->> 'status', 'cancelled', 'cancel은 멱등하다');
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000003', 0, 1, repeat('c', 64),
    '[{"word":"삭제통합취소¤"}]'::jsonb
)$$, 'P0001', 'WORD_DELETION_CONFLICT', 'cancelled operation은 apply를 막는다');
reset role;

select pg_temp.authenticate('00000000-0000-4000-8000-0000000000c3');
set local role authenticated;
select lives_ok($$select public.start_word_deletion_operation(
    '30000000-0000-4000-8000-000000000004', repeat('d', 64), 1, 1
)$$, 'admin도 operation을 시작한다');
select throws_ok($$select public.get_word_deletion_operation(
    '30000000-0000-4000-8000-000000000001'
)$$, 'P0001', 'WORD_DELETION_NOT_FOUND', '다른 actor의 get은 not found다');
select throws_ok($$select public.cancel_word_deletion_operation(
    '30000000-0000-4000-8000-000000000003'
)$$, 'P0001', 'WORD_DELETION_FORBIDDEN', '다른 actor의 cancel은 forbidden이다');
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000001', 0, 1, repeat('e', 64),
    '[{"word":"삭제통합권한¤"}]'::jsonb
)$$, 'P0001', 'WORD_DELETION_FORBIDDEN', '다른 actor의 apply는 forbidden이다');
reset role;

select pg_temp.authenticate('00000000-0000-4000-8000-0000000000c1');
set local role authenticated;
select throws_ok($$select public.apply_word_deletion_batch(
    '39999999-0000-4000-8000-000000000099', 0, 1, repeat('e', 64),
    '[{"word":"삭제통합검증¤"}]'::jsonb
)$$, 'P0001', 'WORD_DELETION_NOT_FOUND', 'unknown operation을 거부한다');
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000001', 0, 2, repeat('e', 64),
    '[{"word":"삭제통합검증¤"}]'::jsonb
)$$, 'P0001', 'WORD_DELETION_CONFLICT', 'total batches 불일치는 conflict다');
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000001', -1, 1, repeat('e', 64),
    '[{"word":"삭제통합검증¤"}]'::jsonb
)$$, 'P0001', 'WORD_DELETION_INVALID_INPUT', 'invalid batch index를 거부한다');
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000001', 0, 1, repeat('E', 64),
    '[{"word":"삭제통합검증¤"}]'::jsonb
)$$, 'P0001', 'WORD_DELETION_INVALID_INPUT', 'invalid payload hash를 거부한다');
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000001', 0, 1, repeat('e', 64), null
)$$, 'P0001', 'WORD_DELETION_INVALID_INPUT', 'null payload를 거부한다');
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000001', 0, 1, repeat('e', 64),
    '{"word":"삭제통합검증¤"}'::jsonb
)$$, 'P0001', 'WORD_DELETION_INVALID_INPUT', 'non-array payload를 거부한다');
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000001', 0, 1, repeat('e', 64),
    '["삭제통합검증¤"]'::jsonb
)$$, 'P0001', 'WORD_DELETION_INVALID_INPUT', 'non-object entry를 거부한다');
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000001', 0, 1, repeat('e', 64), '[{}]'::jsonb
)$$, 'P0001', 'WORD_DELETION_INVALID_INPUT', 'missing word key를 거부한다');
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000001', 0, 1, repeat('e', 64),
    '[{"word":"삭제통합검증¤","extra":true}]'::jsonb
)$$, 'P0001', 'WORD_DELETION_INVALID_INPUT', 'unknown key를 거부한다');
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000001', 0, 1, repeat('e', 64), '[{"word":1}]'::jsonb
)$$, 'P0001', 'WORD_DELETION_INVALID_INPUT', 'non-string word를 거부한다');
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000001', 0, 1, repeat('e', 64), '[{"word":""}]'::jsonb
)$$, 'P0001', 'WORD_DELETION_INVALID_INPUT', 'empty word를 거부한다');
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000001', 0, 1, repeat('e', 64), '[{"word":" 삭제통합¤"}]'::jsonb
)$$, 'P0001', 'WORD_DELETION_INVALID_INPUT', 'leading whitespace를 거부한다');
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000001', 0, 1, repeat('e', 64), '[{"word":"삭제통합¤ "}]'::jsonb
)$$, 'P0001', 'WORD_DELETION_INVALID_INPUT', 'trailing whitespace를 거부한다');
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000001', 0, 1, repeat('e', 64),
    '[{"word":"삭제통합중복¤"},{"word":"삭제통합중복¤"}]'::jsonb
)$$, 'P0001', 'WORD_DELETION_INVALID_INPUT', 'duplicate word를 거부한다');
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000001', 0, 1, repeat('e', 64), '[]'::jsonb
)$$, 'P0001', 'WORD_DELETION_INVALID_INPUT', '0-entry batch를 거부한다');
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000001', 0, 1, repeat('e', 64),
    (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'word', '삭제통합' || item::text || '¤'
    )) from pg_catalog.generate_series(1, 51) as item)
)$$, 'P0001', 'WORD_DELETION_INVALID_INPUT', '51-entry batch를 거부한다');
select lives_ok($$select public.start_word_deletion_operation(
    '30000000-0000-4000-8000-000000000005', repeat('f', 64), 2, 2
)$$, '2-batch operation을 시작한다');
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000005', 1, 2, repeat('0', 64),
    '[{"word":"삭제통합순서¤"}]'::jsonb
)$$, 'P0001', 'WORD_DELETION_CONFLICT', 'out-of-order batch를 거부한다');
reset role;

-- The remote snapshot omits several hard-coded docs rows used by this unrelated
-- legacy trigger. Other production word/stat/special-docs triggers stay enabled.
alter table public.words disable trigger trg_after_word_change;

insert into public.themes (code, name) values
    ('delete-9931', '삭제통합주제'), ('123', '삭제통합숫자주제');
insert into public.docs (name, typez, last_update) values
    ('삭제통합주제', 'theme', '2000-01-01'), ('¤', 'letter', '2000-01-01');
create temporary table deletion_baseline as select
    (select total_words from public.words_count where id = 1) as total_words,
    coalesce((select count from public.word_last_letter_counts where last_letter = '¤'), 0) as last_count;
insert into public.words (word, k_canuse, noin_canuse, added_by) values
    ('삭제통합정상¤', true, false, '00000000-0000-4000-8000-0000000000c5'),
    ('삭제통합처리자¤', true, false, '00000000-0000-4000-8000-0000000000c5'),
    ('삭제통합오래된¤', true, false, '00000000-0000-4000-8000-0000000000c5'),
    ('삭제통합보호¤', true, false, '00000000-0000-4000-8000-0000000000c5');
insert into public.word_themes (word_id, theme_id)
select word_row.id, theme.id from public.words as word_row cross join public.themes as theme
where word_row.word like '삭제통합%' and theme.code = 'delete-9931';
insert into public.word_themes (word_id, theme_id)
select word_row.id, theme.id from public.words as word_row cross join public.themes as theme
where word_row.word = '삭제통합보호¤' and theme.code = '123';
alter table public.wait_words drop constraint wait_words_word_key;
insert into public.wait_words (word, word_id, request_type, requested_at, requested_by)
select fixture.word, word_row.id, 'delete', fixture.requested_at, fixture.requested_by
from (values
    ('삭제통합정상¤'::text, '2020-01-01'::timestamptz, '00000000-0000-4000-8000-0000000000c4'::uuid),
    ('삭제통합오래된¤'::text, '2021-01-01'::timestamptz, '00000000-0000-4000-8000-0000000000c5'::uuid),
    ('삭제통합오래된¤'::text, '2019-01-01'::timestamptz, '00000000-0000-4000-8000-0000000000c4'::uuid)
) as fixture(word, requested_at, requested_by)
join public.words as word_row on word_row.word = fixture.word;
insert into public.wait_words (word, word_id, request_type, requested_by)
select word_row.word, word_row.id, 'delete', '00000000-0000-4000-8000-0000000000c5'
from public.words as word_row where word_row.word = '삭제통합보호¤';
insert into public.wait_words (word, word_id, request_type, requested_by)
values ('삭제통합없는¤', null, 'delete', '00000000-0000-4000-8000-0000000000c5');
insert into public.word_themes_wait (word_id, theme_id, typez, req_by)
select word_row.id, theme.id, 'delete', '00000000-0000-4000-8000-0000000000c5'
from public.words as word_row cross join public.themes as theme
where word_row.word in ('삭제통합정상¤', '삭제통합처리자¤') and theme.code = 'delete-9931';
insert into public.word_themes_wait (word_id, theme_id, typez, req_by)
select word_row.id, theme.id, 'delete', '00000000-0000-4000-8000-0000000000c5'
from public.words as word_row cross join public.themes as theme
where word_row.word = '삭제통합보호¤' and theme.code = '123';
update public.docs set last_update = '2000-01-01'
where name in ('삭제통합주제', '¤');

select pg_temp.authenticate('00000000-0000-4000-8000-0000000000c1');
set local role authenticated;
select lives_ok($$select public.start_word_deletion_operation(
    '30000000-0000-4000-8000-000000000010', repeat('1', 64), 5, 1
)$$, '정상 삭제 operation을 시작한다');
create temporary table deletion_result (result jsonb not null);
insert into deletion_result select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000010', 0, 1, repeat('2', 64),
    '[{"word":"삭제통합정상¤"},{"word":"삭제통합처리자¤"},
      {"word":"삭제통합오래된¤"},{"word":"삭제통합보호¤"},
      {"word":"삭제통합없는¤"}]'::jsonb
);
reset role;
select is((select (result ->> 'deletedWordCount')::integer from deletion_result), 3, 'actual deletion을 센다');
select is((select (result ->> 'protectedWordCount')::integer from deletion_result), 1, 'numeric theme 단어를 보호한다');
select is((select (result ->> 'missingWordCount')::integer from deletion_result), 1, 'missing 단어를 센다');
select is((select (result ->> 'processedRequestCount')::integer from deletion_result), 5, '삭제 요청을 센다');
select is((select pg_catalog.jsonb_array_length(result -> 'affectedDocsIds') from deletion_result), 2, 'affected docs ID를 dedupe한다');
select is((select pg_catalog.count(*)::integer from public.words where word in (
    '삭제통합정상¤', '삭제통합처리자¤', '삭제통합오래된¤'
)), 0, 'actual target word를 삭제한다');
select is((select pg_catalog.count(*)::integer from public.words where word = '삭제통합보호¤'), 1, 'protected word를 남긴다');
select is((select pg_catalog.count(*)::integer from public.wait_words where word in (
    '삭제통합정상¤', '삭제통합처리자¤', '삭제통합오래된¤'
)), 0, 'whole-word deletion request를 정리한다');
select is((select pg_catalog.count(*)::integer from public.wait_words
    where word = '삭제통합보호¤'), 1, 'protected word request를 보존한다');
select is((select pg_catalog.count(*)::integer from public.word_themes_wait as wait_theme
    join public.words as word_row on word_row.id = wait_theme.word_id
    where word_row.word = '삭제통합보호¤' and wait_theme.typez = 'delete'),
    1, 'protected word theme request를 보존한다');
select is((select pg_catalog.count(*)::integer from public.wait_words
    where word = '삭제통합없는¤'), 1, 'missing word request를 보존한다');
select is((select pg_catalog.count(*)::integer from public.logs where word like '삭제통합%'
    and r_type = 'delete' and state = 'approved'
), 3, 'actual deletion moderation log만 만든다');
select is((select make_by from public.logs where word = '삭제통합정상¤'),
    '00000000-0000-4000-8000-0000000000c4'::uuid, 'whole-word requester를 credit한다');
select is((select make_by from public.logs where word = '삭제통합처리자¤'),
    '00000000-0000-4000-8000-0000000000c1'::uuid, 'requester가 없으면 actor를 credit한다');
select is((select make_by from public.logs where word = '삭제통합오래된¤'),
    '00000000-0000-4000-8000-0000000000c4'::uuid, 'oldest whole-word requester가 이긴다');
select is((select pg_catalog.count(*)::integer from public.docs_logs where word in (
    '삭제통합정상¤', '삭제통합처리자¤', '삭제통합오래된¤'
) and type = 'delete'), 6, 'letter/theme docs log를 actual deletion에만 만든다');
select is((select add_by from public.docs_logs as docs_log join public.docs as document
    on document.id = docs_log.docs_id
    where docs_log.word = '삭제통합정상¤' and document.typez = 'theme'),
    '00000000-0000-4000-8000-0000000000c4'::uuid, 'theme log는 whole-word requester를 우선한다');
select is((select add_by from public.docs_logs as docs_log join public.docs as document
    on document.id = docs_log.docs_id
    where docs_log.word = '삭제통합처리자¤' and document.typez = 'theme'),
    '00000000-0000-4000-8000-0000000000c5'::uuid, '그 다음 matching theme requester를 쓴다');
select is((select contribution from public.users where id = '00000000-0000-4000-8000-0000000000c4'), 2, 'requester contribution은 actual word당 한 점이다');
select is((select contribution from public.users where id = '00000000-0000-4000-8000-0000000000c1'), 1, 'actor fallback contribution은 actual word당 한 점이다');
select is((select contribution from public.users where id = '00000000-0000-4000-8000-0000000000c5'), 0, 'theme requester에게 word contribution을 주지 않는다');
select ok((select pg_catalog.bool_and(last_update > '2000-01-01') from public.docs
    where name in ('삭제통합주제', '¤')), 'affected docs timestamp를 갱신한다');
select is((select total_words from public.words_count where id = 1),
    (select total_words + 1 from deletion_baseline), 'words_count trigger 결과가 맞다');
select is(coalesce((select count from public.word_last_letter_counts where last_letter = '¤'), 0),
    (select last_count + 1 from deletion_baseline), 'letter stats trigger 결과가 맞다');
select is((select status from public.word_deletion_operations where operation_id =
    '30000000-0000-4000-8000-000000000010'), 'completed', 'last batch가 operation을 완료한다');

set local role authenticated;
select is(public.cancel_word_deletion_operation(
    '30000000-0000-4000-8000-000000000010'
) ->> 'status', 'completed', 'completed cancel은 completed를 유지한다');
select is(public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000010', 0, 1, repeat('2', 64),
    '[{"word":"삭제통합정상¤"},{"word":"삭제통합처리자¤"},
      {"word":"삭제통합오래된¤"},{"word":"삭제통합보호¤"},
      {"word":"삭제통합없는¤"}]'::jsonb
), (select result from deletion_result), 'same-hash replay는 exact stored result다');
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000010', 0, 1, repeat('3', 64),
    '[{"word":"삭제통합정상¤"}]'::jsonb
)$$, 'P0001', 'WORD_DELETION_CONFLICT', 'same-index different-hash는 conflict다');
reset role;
select is((select pg_catalog.count(*)::integer from public.logs where word in (
    '삭제통합정상¤', '삭제통합처리자¤', '삭제통합오래된¤'
)), 3, 'replay는 log를 중복 생성하지 않는다');
select is((select contribution from public.users where id = '00000000-0000-4000-8000-0000000000c4'), 2, 'replay는 contribution을 중복 생성하지 않는다');

update public.docs
set
    name = case id
        when 201 then '삭제통합특수문서A'
        when 202 then '삭제통합특수문서B'
    end,
    typez = 'ect',
    last_update = '1999-01-01'
where id in (201, 202);
select is((select pg_catalog.count(*)::integer from public.docs where id in (201, 202)), 2, 'special docs fixture가 있다');
insert into public.words (word, added_by) values
    ('삭제통합특수문서동작확인¤', '00000000-0000-4000-8000-0000000000c5');
create temporary table special_docs_baseline as
select id, last_update from public.docs where id in (201, 202);
set local role authenticated;
select lives_ok($$select public.start_word_deletion_operation(
    '30000000-0000-4000-8000-000000000011', repeat('4', 64), 1, 1
)$$, 'special docs operation을 시작한다');
create temporary table special_deletion_result (result jsonb not null);
insert into special_deletion_result
select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000011', 0, 1, repeat('5', 64),
    '[{"word":"삭제통합특수문서동작확인¤"}]'::jsonb
);
reset role;
select is((select (result ->> 'deletedWordCount')::integer from special_deletion_result),
    1, '긴 word를 삭제한다');
select is((select result -> 'affectedDocsIds' from special_deletion_result),
    (select pg_catalog.to_jsonb(array[document.id]) from public.docs as document
     where document.typez = 'letter' and document.name = '¤'),
    'returned affectedDocsIds는 직접 생성한 letter/theme docs log만 포함한다');
select is((select result -> 'affectedDocsIds' from public.word_deletion_batches
    where operation_id = '30000000-0000-4000-8000-000000000011' and batch_index = 0),
    (select pg_catalog.to_jsonb(array[document.id]) from public.docs as document
     where document.typez = 'letter' and document.name = '¤'),
    'persisted affectedDocsIds는 legacy 201/202를 제외한다');
select is((select pg_catalog.count(*)::integer from public.docs_logs
    where word = '삭제통합특수문서동작확인¤' and docs_id in (201, 202) and type = 'delete'
), 2, '기존 special docs trigger를 유지한다');
select ok((select pg_catalog.bool_and(document.last_update = baseline.last_update)
    from public.docs as document join special_docs_baseline as baseline using (id)),
    'RPC는 legacy 201/202 last_update를 직접 변경하지 않는다');

insert into public.words (word, added_by) values
    ('삭제통합롤백¤', '00000000-0000-4000-8000-0000000000c5');
insert into public.word_themes (word_id, theme_id)
select word_row.id, theme.id from public.words as word_row cross join public.themes as theme
where word_row.word = '삭제통합롤백¤' and theme.code = 'delete-9931';
insert into public.wait_words (word, word_id, request_type, requested_by)
select word, id, 'delete', '00000000-0000-4000-8000-0000000000c4'
from public.words where word = '삭제통합롤백¤';
update public.docs set last_update = '2001-01-01' where name in ('삭제통합주제', '¤');
select pg_temp.authenticate('00000000-0000-4000-8000-0000000000c1');
set local role authenticated;
select lives_ok($$select public.start_word_deletion_operation(
    '30000000-0000-4000-8000-000000000012', repeat('6', 64), 1, 1
)$$, 'rollback operation을 시작한다');
reset role;
create temporary table rollback_baseline as select
    (select contribution from public.users where id = '00000000-0000-4000-8000-0000000000c4') as contribution,
    (select last_update from public.docs where name = '¤') as last_update,
    (select updated_at from public.word_deletion_operations where operation_id =
        '30000000-0000-4000-8000-000000000012') as updated_at;
create function pg_temp.fail_word_deletion_log() returns trigger language plpgsql as $$
begin
    if new.word = '삭제통합롤백¤' then raise exception 'forced'; end if;
    return new;
end;
$$;
create trigger word_deletion_test_fail_log before insert on public.logs
for each row execute function pg_temp.fail_word_deletion_log();
set local role authenticated;
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000012', 0, 1, repeat('7', 64),
    '[{"word":"삭제통합롤백¤"}]'::jsonb
)$$, 'P0001', 'WORD_DELETION_INTERNAL_ERROR', 'log failure는 stable internal error다');
reset role;
drop trigger word_deletion_test_fail_log on public.logs;
select is((select pg_catalog.count(*)::integer from public.words where word = '삭제통합롤백¤'), 1, 'failure가 word를 rollback한다');
select is((select pg_catalog.count(*)::integer from public.wait_words where word = '삭제통합롤백¤'), 1, 'failure가 request를 rollback한다');
select is((select pg_catalog.count(*)::integer from public.logs where word = '삭제통합롤백¤'), 0, 'failure가 log를 rollback한다');
select is((select pg_catalog.count(*)::integer from public.docs_logs where word = '삭제통합롤백¤'), 0, 'failure가 docs log를 rollback한다');
select is((select contribution from public.users where id = '00000000-0000-4000-8000-0000000000c4'),
    (select contribution from rollback_baseline), 'failure가 contribution을 rollback한다');
select is((select last_update from public.docs where name = '¤'),
    (select last_update from rollback_baseline), 'failure가 docs timestamp를 rollback한다');
select is((select pg_catalog.count(*)::integer from public.word_deletion_batches where operation_id =
    '30000000-0000-4000-8000-000000000012'), 0, 'failure가 batch row를 rollback한다');
select is((select status from public.word_deletion_operations where operation_id =
    '30000000-0000-4000-8000-000000000012'), 'running', 'failure가 operation status를 유지한다');
select is((select updated_at from public.word_deletion_operations where operation_id =
    '30000000-0000-4000-8000-000000000012'), (select updated_at from rollback_baseline),
    'failure가 operation timestamp를 유지한다');

set local role authenticated;
select is(public.cancel_word_deletion_operation(
    '30000000-0000-4000-8000-000000000012'
) ->> 'status', 'cancelled', 'rollback operation을 cancel한다');
select throws_ok($$select public.apply_word_deletion_batch(
    '30000000-0000-4000-8000-000000000012', 0, 1, repeat('7', 64),
    '[{"word":"삭제통합롤백¤"}]'::jsonb
)$$, 'P0001', 'WORD_DELETION_CONFLICT', 'cancel이 이후 apply를 막는다');
reset role;

select * from finish();
rollback;

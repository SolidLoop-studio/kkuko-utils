begin;

create temporary table expected_docs_reference (
    legacy_id bigint primary key,
    expected_name text not null
) on commit drop;

insert into expected_docs_reference values
    (201, '한국어 끝말잇기 긴단어'),
    (202, '한국어 앞말잇기 긴단어'),
    (208, '한국어 끝말잇기 미션단어'),
    (223, '한국어 앞말잇기 미션단어'),
    (238, '한국어 쿵쿵따 미션단어');

with letters(ordinal, letter) as (values
    (1, '가'), (2, '나'), (3, '다'), (4, '라'), (5, '마'),
    (6, '바'), (7, '사'), (8, '아'), (9, '자'), (10, '차'),
    (11, '카'), (12, '타'), (13, '파'), (14, '하')
), families(first_id, name_prefix) as (values
    (209, '한국어 끝말잇기 미션단어'),
    (224, '한국어 앞말잇기 미션단어'),
    (239, '한국어 쿵쿵따 미션단어')
)
insert into expected_docs_reference
select first_id + ordinal - 1, name_prefix || ' - ' || letter
from letters cross join families;

delete from public.words where word in (
    '�R�R�R�R�R�R�R�R�R',
    '������������������',
    '������������������',
    '������������������',
    '�޴޴޴޴޴޴޴޴�',
    '�ɲɲɲɲɲɲɲɲ�',
    '가가가',
    '가나가',
    '가나가나',
    '가가가실패'
);
delete from public.docs_logs where word in (
    '�R�R�R�R�R�R�R�R�R',
    '������������������',
    '������������������',
    '������������������',
    '�޴޴޴޴޴޴޴޴�',
    '�ɲɲɲɲɲɲɲɲ�',
    '가가가',
    '가나가',
    '가나가나',
    '가가가실패'
);
delete from public.users where id in (
    '52000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000002'
);
delete from auth.users where id in (
    '52000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000002'
);

insert into auth.users (id) values
    ('52000000-0000-4000-8000-000000000001'),
    ('52000000-0000-4000-8000-000000000002');
insert into public.users (id, nickname, role) values
    ('52000000-0000-4000-8000-000000000001', 'docs-reference-old', 'r1'),
    ('52000000-0000-4000-8000-000000000002', 'docs-reference-new', 'r1');

select no_plan();

select results_eq(
    $$ select document.id, document.name
       from public.docs as document
       join expected_docs_reference as expected
         on expected.legacy_id = document.id
      order by document.id $$,
    $$ select legacy_id, expected_name
       from expected_docs_reference order by legacy_id $$,
    'the seed has all 47 legacy semantic roles'
);

insert into public.words (word, k_canuse, added_by)
values (
    '�R�R�R�R�R�R�R�R�R', true,
    '52000000-0000-4000-8000-000000000001'
);
select is(
    (select count(*)::integer from public.docs_logs
      where word = '�R�R�R�R�R�R�R�R�R'
        and docs_id in (201, 202)
        and add_by = '52000000-0000-4000-8000-000000000001'
        and type = 'add'),
    2,
    'a qualifying insert records both long-word docs'
);

delete from public.words where word = '�R�R�R�R�R�R�R�R�R';
select is(
    (select count(*)::integer from public.docs_logs
      where word = '�R�R�R�R�R�R�R�R�R'
        and docs_id in (201, 202)
        and add_by = '52000000-0000-4000-8000-000000000001'
        and type = 'delete'),
    2,
    'an eligible delete records both long-word docs from OLD'
);

insert into public.words (word, k_canuse, added_by) values (
    '������������������', false,
    '52000000-0000-4000-8000-000000000001'
);
update public.words
   set word = '������������������',
       added_by = '52000000-0000-4000-8000-000000000002'
 where word = '������������������';
select is(
    (select count(*)::integer from public.docs_logs
      where word in ('������������������', '������������������')
        and docs_id in (201, 202)),
    0,
    'false-to-false eligibility produces no long-word log'
);

update public.words
   set word = '������������������',
       k_canuse = true,
       added_by = '52000000-0000-4000-8000-000000000001'
 where word = '������������������';
select is(
    (select count(*)::integer from public.docs_logs
      where word = '������������������'
        and docs_id in (201, 202)
        and add_by = '52000000-0000-4000-8000-000000000001'
        and type = 'add'),
    2,
    'false-to-true uses NEW word and NEW added_by'
);

update public.words
   set word = '�޴޴޴޴޴޴޴޴�'
 where word = '������������������';
select is(
    (select count(*)::integer from public.docs_logs
      where word = '�޴޴޴޴޴޴޴޴�' and docs_id in (201, 202)),
    0,
    'true-to-true eligibility produces no long-word log'
);

update public.words
   set word = '�ɲɲɲɲɲɲɲɲ�',
       k_canuse = false,
       added_by = '52000000-0000-4000-8000-000000000002'
 where word = '�޴޴޴޴޴޴޴޴�';
select is(
    (select count(*)::integer from public.docs_logs
      where word = '�ɲɲɲɲɲɲɲɲ�'
        and docs_id in (201, 202)
        and add_by = '52000000-0000-4000-8000-000000000002'
        and type = 'delete'),
    2,
    'true-to-false uses NEW word and NEW added_by'
);

insert into public.words (word, k_canuse, added_by) values (
    '가가가', false,
    '52000000-0000-4000-8000-000000000001'
);
select is(
    (select count(*)::integer from public.docs_logs
      where word = '가가가' and docs_id in (209, 224, 239) and type = 'add'),
    3,
    'repeated 가 produces one add log for each of its three mission docs'
);
delete from public.words where word = '가가가';
select is(
    (select count(*)::integer from public.docs_logs
      where word = '가가가' and docs_id in (209, 224, 239) and type = 'delete'),
    3,
    'deleting the repeated 가 fixture records matching mission deletes'
);

insert into public.words (word, k_canuse, added_by) values (
    '가나가', false,
    '52000000-0000-4000-8000-000000000001'
);
select is(
    (select count(*)::integer from public.docs_logs
      where word = '가나가' and docs_id between 209 and 252 and type = 'add'),
    6,
    'a length-three word produces six mission add logs'
);
delete from public.words where word = '가나가';
select is(
    (select count(*)::integer from public.docs_logs
      where word = '가나가' and docs_id between 209 and 252 and type = 'delete'),
    6,
    'deleting the length-three fixture records six mission deletes'
);

insert into public.words (word, k_canuse, added_by) values (
    '가나가나', false,
    '52000000-0000-4000-8000-000000000001'
);
select is(
    (select count(*)::integer from public.docs_logs
      where word = '가나가나' and docs_id between 209 and 238 and type = 'add'),
    4,
    'a non-three-character word produces four word-chain and reverse mission add logs'
);
select is(
    (select count(*)::integer from public.docs_logs
      where word = '가나가나' and docs_id between 239 and 252),
    0,
    'a non-three-character word produces no Kkungkkungtta mission logs'
);
delete from public.words where word = '가나가나';
select is(
    (select count(*)::integer from public.docs_logs
      where word = '가나가나' and docs_id between 209 and 238 and type = 'delete'),
    4,
    'deleting the non-three-character fixture records matching mission deletes'
);

update public.docs
   set last_update = '2000-01-01'::timestamptz
 where id in (208, 209, 223, 224, 238, 239);
insert into public.words (word, k_canuse, added_by) values (
    '가가가', false,
    '52000000-0000-4000-8000-000000000001'
);
select ok(
    (select last_update > '2000-01-01'::timestamptz from public.docs where id = 209)
    and (select last_update > '2000-01-01'::timestamptz from public.docs where id = 208)
    and (select last_update > '2000-01-01'::timestamptz from public.docs where id = 223)
    and (select last_update > '2000-01-01'::timestamptz from public.docs where id = 238),
    'a mission insert touches its child and all three parent last-update timestamps'
);

delete from public.docs where id = 209;
select throws_ok(
    $$ insert into public.words (word, k_canuse, added_by) values
       ('가가가실패', false, '52000000-0000-4000-8000-000000000001') $$,
    null
);
select ok(
    not exists (select 1 from public.words where word = '가가가실패')
    and not exists (select 1 from public.docs_logs where word = '가가가실패'),
    'the missing-child failure rolls back its word and docs-log rows'
);

select * from finish();
rollback;

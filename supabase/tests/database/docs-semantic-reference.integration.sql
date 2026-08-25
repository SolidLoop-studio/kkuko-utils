begin;

select no_plan();

delete from public.words where word in (
    '힣힣힣힣힣힣힣힣힣',
    '가나힣',
    '봄봄봄봄봄봄봄봄봄',
    '옴옴',
    '가힣힣'
);
delete from public.docs_logs where word in (
    '힣힣힣힣힣힣힣힣힣',
    '가나힣',
    '봄봄봄봄봄봄봄봄봄',
    '옴옴',
    '가힣힣'
);

create temporary table original_semantic_docs on commit drop as
select document.*
from public.docs as document
where document.reference_code is not null;

select is(
    (select count(*)::integer from original_semantic_docs),
    47,
    'the varying-PK fixture captures all references'
);

delete from public.docs where reference_code is not null;

insert into public.docs (
    id, created_at, name, maker, typez, last_update,
    is_hidden, duem, views, reference_code
)
select
    original.id + 900000,
    original.created_at,
    original.name,
    original.maker,
    original.typez,
    original.last_update,
    original.is_hidden,
    original.duem,
    original.views,
    original.reference_code
from original_semantic_docs as original;

select is(
    (select count(*)::integer
       from public.docs as rekeyed
       join original_semantic_docs as original
         on original.reference_code = rekeyed.reference_code
      where rekeyed.id > 900000),
    47,
    'all semantic references use varying primary keys above the legacy range'
);

select is(
    (select count(*)::integer
       from public.docs as rekeyed
       join original_semantic_docs as original
         on original.reference_code = rekeyed.reference_code
      where rekeyed.id = original.id),
    0,
    'no semantic reference retains its original primary key'
);

create temporary table successful_reference_codes (
    fixture text not null,
    reference_code text primary key
) on commit drop;

insert into successful_reference_codes values
    ('long', 'ko.word-chain.long'),
    ('long', 'ko.reverse-word-chain.long'),
    ('mission-child', 'ko.word-chain.mission.ga'),
    ('mission-child', 'ko.word-chain.mission.na'),
    ('mission-child', 'ko.reverse-word-chain.mission.ga'),
    ('mission-child', 'ko.reverse-word-chain.mission.na'),
    ('mission-child', 'ko.kkungkkungtta.mission.ga'),
    ('mission-child', 'ko.kkungkkungtta.mission.na');

create temporary table mission_timestamp_reference_codes (
    reference_code text primary key
) on commit drop;

insert into mission_timestamp_reference_codes values
    ('ko.word-chain.mission.ga'),
    ('ko.word-chain.mission.na'),
    ('ko.reverse-word-chain.mission.ga'),
    ('ko.reverse-word-chain.mission.na'),
    ('ko.kkungkkungtta.mission.ga'),
    ('ko.kkungkkungtta.mission.na'),
    ('ko.word-chain.mission'),
    ('ko.reverse-word-chain.mission'),
    ('ko.kkungkkungtta.mission');

update public.docs as document
   set last_update = '2000-01-01'::timestamptz
  from mission_timestamp_reference_codes as expected
 where expected.reference_code = document.reference_code
   and expected.reference_code like '%.mission.%';

update public.docs as document
   set last_update = '2000-01-01'::timestamptz
  from mission_timestamp_reference_codes as expected
 where expected.reference_code = document.reference_code
   and expected.reference_code in (
       'ko.word-chain.mission',
       'ko.reverse-word-chain.mission',
       'ko.kkungkkungtta.mission'
   );

insert into public.words (word, k_canuse)
values ('힣힣힣힣힣힣힣힣힣', true);

insert into public.words (word, k_canuse)
values ('가나힣', false);

select is(
    (select count(*)::integer
       from public.docs_logs as log
       join public.docs as document on document.id = log.docs_id
       join successful_reference_codes as expected
         on expected.reference_code = document.reference_code
        and expected.fixture = 'long'
      where log.word = '힣힣힣힣힣힣힣힣힣'
        and log.type = 'add'),
    2,
    'the varying-PK long insert records both semantic long references'
);

select is(
    (select count(*)::integer
       from public.docs_logs as log
       join public.docs as document on document.id = log.docs_id
       join successful_reference_codes as expected
         on expected.reference_code = document.reference_code
        and expected.fixture = 'mission-child'
      where log.word = '가나힣'
        and log.type = 'add'),
    6,
    'the varying-PK mission insert records ga and na in all three families'
);

select is(
    (select count(*)::integer
       from public.docs_logs as log
       join public.docs as document on document.id = log.docs_id
       join successful_reference_codes as expected
         on expected.reference_code = document.reference_code
      where log.word in ('힣힣힣힣힣힣힣힣힣', '가나힣')
        and log.type = 'add'
        and log.docs_id > 900000),
    8,
    'every successful add effect uses a re-keyed semantic reference'
);

select is(
    (select count(*)::integer
       from mission_timestamp_reference_codes as expected
       join public.docs as document
         on document.reference_code = expected.reference_code
      where document.last_update > '2000-01-01'::timestamptz),
    9,
    'mission child updates touch six re-keyed children and all three parents'
);

delete from public.words
where word in ('힣힣힣힣힣힣힣힣힣', '가나힣');

select is(
    (select count(*)::integer
       from public.docs_logs as log
       join public.docs as document on document.id = log.docs_id
       join successful_reference_codes as expected
         on expected.reference_code = document.reference_code
        and expected.fixture = 'long'
      where log.word = '힣힣힣힣힣힣힣힣힣'
        and log.type = 'delete'),
    2,
    'the varying-PK long delete records both semantic long references'
);

select is(
    (select count(*)::integer
       from public.docs_logs as log
       join public.docs as document on document.id = log.docs_id
       join successful_reference_codes as expected
         on expected.reference_code = document.reference_code
        and expected.fixture = 'mission-child'
      where log.word = '가나힣'
        and log.type = 'delete'),
    6,
    'the varying-PK mission delete records the same six semantic references'
);

select is(
    (select count(*)::integer
       from public.docs_logs as log
       join public.docs as document on document.id = log.docs_id
       join successful_reference_codes as expected
         on expected.reference_code = document.reference_code
      where log.word in ('힣힣힣힣힣힣힣힣힣', '가나힣')
        and log.type = 'delete'
        and log.docs_id > 900000),
    8,
    'every successful delete effect uses a re-keyed semantic reference'
);

create temporary table missing_long_restore on commit drop as
select document.*
from public.docs as document
where document.reference_code = 'ko.word-chain.long';

delete from public.docs
where reference_code = 'ko.word-chain.long';

select is(
    (select count(*)::integer from public.docs_logs
      where word = '봄봄봄봄봄봄봄봄봄'),
    0,
    'the distinct missing-long fixture starts with no log history'
);

select throws_ok(
    $$ insert into public.words (word, k_canuse)
       values ('봄봄봄봄봄봄봄봄봄', true) $$,
    'P0001',
    'DOCS_REQUIRED_REFERENCE_MISSING',
    'a missing long reference aborts the word insert'
);

select ok(
    not exists (
        select 1 from public.words
        where word = '봄봄봄봄봄봄봄봄봄'
    ),
    'the failed missing-long insert rolls back the word row'
);

select is(
    (select count(*)::integer from public.docs_logs
      where word = '봄봄봄봄봄봄봄봄봄'),
    0,
    'the failed missing-long insert leaves no log for either long reference'
);

select lives_ok(
    $$ insert into public.words (word, k_canuse)
       values ('옴옴', true) $$,
    'an unrelated short word resolves no missing long reference'
);

select ok(
    exists (select 1 from public.words where word = '옴옴'),
    'the unrelated short word is inserted while the long reference is missing'
);

delete from public.words where word = '옴옴';

insert into public.docs (
    id, created_at, name, maker, typez, last_update,
    is_hidden, duem, views, reference_code
)
select
    id, created_at, name, maker, typez, last_update,
    is_hidden, duem, views, reference_code
from missing_long_restore;

select is(
    (select count(*)::integer
       from public.docs as restored
       join missing_long_restore as expected
         on expected.reference_code = restored.reference_code),
    1,
    'the missing long reference is restored before mission failures'
);

create temporary table mission_failure_timestamp_codes (
    reference_code text primary key
) on commit drop;

insert into mission_failure_timestamp_codes values
    ('ko.word-chain.mission.ga'),
    ('ko.reverse-word-chain.mission.ga'),
    ('ko.kkungkkungtta.mission.ga'),
    ('ko.word-chain.mission'),
    ('ko.reverse-word-chain.mission'),
    ('ko.kkungkkungtta.mission');

update public.docs as document
   set last_update = '2000-01-01'::timestamptz
  from mission_failure_timestamp_codes as expected
 where expected.reference_code = document.reference_code
   and expected.reference_code like '%.mission.%';

update public.docs as document
   set last_update = '2000-01-01'::timestamptz
  from mission_failure_timestamp_codes as expected
 where expected.reference_code = document.reference_code
   and expected.reference_code in (
       'ko.word-chain.mission',
       'ko.reverse-word-chain.mission',
       'ko.kkungkkungtta.mission'
   );

create temporary table missing_mission_child_restore on commit drop as
select document.*
from public.docs as document
where document.reference_code = 'ko.word-chain.mission.ga';

delete from public.docs
where reference_code = 'ko.word-chain.mission.ga';

select throws_ok(
    $$ insert into public.words (word, k_canuse)
       values ('가힣힣', false) $$,
    'P0001',
    'DOCS_REQUIRED_REFERENCE_MISSING',
    'a missing mission child aborts the word insert'
);

select ok(
    not exists (select 1 from public.words where word = '가힣힣'),
    'the missing-child failure rolls back the initiating word'
);

select is(
    (select count(*)::integer from public.docs_logs
      where word = '가힣힣'),
    0,
    'the missing-child failure leaves no mission logs'
);

select is(
    (select count(*)::integer
       from mission_failure_timestamp_codes as expected
       join public.docs as document
         on document.reference_code = expected.reference_code
      where expected.reference_code <> 'ko.word-chain.mission.ga'
        and document.last_update = '2000-01-01'::timestamptz),
    5,
    'the missing-child failure preserves every observable child and parent timestamp'
);

select is(
    (select last_update from missing_mission_child_restore),
    '2000-01-01'::timestamptz,
    'the removed child restore row retains its timestamp baseline'
);

insert into public.docs (
    id, created_at, name, maker, typez, last_update,
    is_hidden, duem, views, reference_code
)
select
    id, created_at, name, maker, typez, last_update,
    is_hidden, duem, views, reference_code
from missing_mission_child_restore;

select is(
    (select count(*)::integer
       from mission_failure_timestamp_codes as expected
       join public.docs as document
         on document.reference_code = expected.reference_code
      where document.last_update = '2000-01-01'::timestamptz),
    6,
    'the mission child is restored at baseline before the parent failure'
);

update public.docs as document
   set last_update = '2000-01-01'::timestamptz
  from mission_failure_timestamp_codes as expected
 where expected.reference_code = document.reference_code
   and expected.reference_code like '%.mission.%';

update public.docs as document
   set last_update = '2000-01-01'::timestamptz
  from mission_failure_timestamp_codes as expected
 where expected.reference_code = document.reference_code
   and expected.reference_code in (
       'ko.word-chain.mission',
       'ko.reverse-word-chain.mission',
       'ko.kkungkkungtta.mission'
   );

create temporary table missing_mission_parent_restore on commit drop as
select document.*
from public.docs as document
where document.reference_code = 'ko.word-chain.mission';

delete from public.docs
where reference_code = 'ko.word-chain.mission';

select throws_ok(
    $$ insert into public.words (word, k_canuse)
       values ('가힣힣', false) $$,
    'P0001',
    'DOCS_REQUIRED_REFERENCE_MISSING',
    'a missing mission parent aborts parent propagation'
);

select ok(
    not exists (select 1 from public.words where word = '가힣힣'),
    'the missing-parent failure rolls back the initiating word'
);

select is(
    (select count(*)::integer from public.docs_logs
      where word = '가힣힣'),
    0,
    'the missing-parent failure rolls back every mission log'
);

select is(
    (select count(*)::integer
       from mission_failure_timestamp_codes as expected
       join public.docs as document
         on document.reference_code = expected.reference_code
      where expected.reference_code <> 'ko.word-chain.mission'
        and document.last_update = '2000-01-01'::timestamptz),
    5,
    'the missing-parent failure rolls back child and other-parent timestamp updates'
);

select is(
    (select last_update from missing_mission_parent_restore),
    '2000-01-01'::timestamptz,
    'the removed parent restore row retains its timestamp baseline'
);

insert into public.docs (
    id, created_at, name, maker, typez, last_update,
    is_hidden, duem, views, reference_code
)
select
    id, created_at, name, maker, typez, last_update,
    is_hidden, duem, views, reference_code
from missing_mission_parent_restore;

select is(
    (select count(*)::integer
       from mission_failure_timestamp_codes as expected
       join public.docs as document
         on document.reference_code = expected.reference_code
      where document.last_update = '2000-01-01'::timestamptz),
    6,
    'the mission parent is restored after rollback coverage'
);

select * from finish();
rollback;

begin;

select no_plan();

create temporary table expected_docs_reference_code (
    legacy_id bigint primary key,
    reference_code text not null unique
) on commit drop;

insert into expected_docs_reference_code values
    (201, 'ko.word-chain.long'),
    (202, 'ko.reverse-word-chain.long'),
    (208, 'ko.word-chain.mission'),
    (223, 'ko.reverse-word-chain.mission'),
    (238, 'ko.kkungkkungtta.mission');

with letters(ordinal, reference_key) as (values
    (1, 'ga'), (2, 'na'), (3, 'da'), (4, 'ra'), (5, 'ma'),
    (6, 'ba'), (7, 'sa'), (8, 'a'), (9, 'ja'), (10, 'cha'),
    (11, 'ka'), (12, 'ta'), (13, 'pa'), (14, 'ha')
), families(first_id, code_prefix) as (values
    (209, 'ko.word-chain.mission'),
    (224, 'ko.reverse-word-chain.mission'),
    (239, 'ko.kkungkkungtta.mission')
)
insert into expected_docs_reference_code
select
    family.first_id + letter.ordinal - 1,
    family.code_prefix || '.' || letter.reference_key
from letters as letter cross join families as family;

select is(
    (select count(*)::integer from public.docs where reference_code is not null),
    47,
    'exactly 47 system docs have semantic references'
);

select is(
    (select reference_code from public.docs where id = 201),
    'ko.word-chain.long',
    'legacy 201 is backfilled without changing its primary key'
);

select is(
    (select reference_code from public.docs where id = 252),
    'ko.kkungkkungtta.mission.ha',
    'legacy 252 receives the final child code'
);

select results_eq(
    $$ select document.id, document.reference_code
       from public.docs as document
       join expected_docs_reference_code as expected
         on expected.legacy_id = document.id
      order by document.id $$,
    $$ select legacy_id, reference_code
       from expected_docs_reference_code
      order by legacy_id $$,
    'the seeded legacy roles have the exact semantic reference catalog'
);

insert into public.docs (name, typez) values
    ('reference-null-a', 'ect'),
    ('reference-null-b', 'ect');

select is(
    (select count(*)::integer from public.docs
      where name like 'reference-null-%' and reference_code is null),
    2,
    'ordinary docs retain null semantic references'
);

update public.docs set reference_code = 'test.reference.one'
where name = 'reference-null-a';

select throws_ok(
    $$ update public.docs set reference_code = 'test.reference.one'
       where name = 'reference-null-b' $$,
    '23505',
    'duplicate key value violates unique constraint "docs_reference_code_key"',
    'duplicate non-null semantic references are rejected by the named unique constraint'
);

select throws_ok(
    $$ update public.docs set reference_code = 'KO invalid'
       where name = 'reference-null-b' $$,
    '23514',
    'new row for relation "docs" violates check constraint "docs_reference_code_format_check"',
    'malformed semantic references are rejected by the named format constraint'
);

select throws_ok(
    $$ update public.docs set reference_code = 'test.reference.two'
       where name = 'reference-null-a' $$,
    'P0001',
    'DOCS_REFERENCE_CODE_IMMUTABLE',
    'assigned semantic references cannot be reassigned'
);

select throws_ok(
    $$ update public.docs set reference_code = null
       where name = 'reference-null-a' $$,
    'P0001',
    'DOCS_REFERENCE_CODE_IMMUTABLE',
    'assigned semantic references cannot be cleared'
);

select is(
    private.require_docs_reference_id('ko.word-chain.long', 'pgTAP'),
    (select id from public.docs where reference_code = 'ko.word-chain.long'),
    'the resolver returns the current surrogate key'
);
select throws_ok(
    $$ select private.require_docs_reference_id('test.reference.missing', 'pgTAP') $$,
    'P0001',
    'DOCS_REQUIRED_REFERENCE_MISSING',
    'a missing required reference exposes only the stable public token'
);
select is(
    (select pg_catalog.array_to_string(routine.proconfig, ',')
       from pg_catalog.pg_proc as routine
      where routine.oid =
        'private.require_docs_reference_id(text,text)'::pg_catalog.regprocedure),
    'search_path=""',
    'the resolver has an empty search path'
);
select ok(
    not pg_catalog.has_function_privilege(
        'anon', 'private.require_docs_reference_id(text,text)', 'EXECUTE')
    and not pg_catalog.has_function_privilege(
        'authenticated', 'private.require_docs_reference_id(text,text)', 'EXECUTE')
    and not pg_catalog.has_function_privilege(
        'service_role', 'private.require_docs_reference_id(text,text)', 'EXECUTE'),
    'application roles cannot execute the private resolver'
);

select * from finish();
rollback;

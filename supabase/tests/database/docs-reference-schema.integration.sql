begin;

select no_plan();

select ok(
    exists (
        select 1
          from pg_catalog.pg_policy as policy
         where policy.polname = 'docs_insert_reference_code_null'
           and policy.polrelid = 'public.docs'::pg_catalog.regclass
           and policy.polcmd = 'a'
           and not policy.polpermissive
           and policy.polroles = array[(
               select role.oid
                 from pg_catalog.pg_roles as role
                where role.rolname = 'authenticated'
           )]
           and pg_catalog.pg_get_expr(
               policy.polwithcheck, policy.polrelid
           ) = '(reference_code IS NULL)'
    ),
    'authenticated docs inserts require null reference codes through a restrictive policy'
);

select ok(
    exists (
        select 1
          from pg_catalog.pg_policy as policy
         where policy.polname = 'Enable insert for authenticated users only'
           and policy.polrelid = 'public.docs_wait'::pg_catalog.regclass
           and policy.polcmd = 'a'
           and policy.polpermissive
           and policy.polroles = array[(
               select role.oid
                 from pg_catalog.pg_roles as role
                where role.rolname = 'authenticated'
           )]
           and pg_catalog.pg_get_expr(
               policy.polwithcheck, policy.polrelid
           ) = '(req_by = ( SELECT auth.uid() AS uid))'
    ),
    'docs creation requests require req_by to equal the authenticated user'
);

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

select alike(
    (select routine.prosrc from pg_catalog.pg_proc as routine
      where routine.oid = 'public.words_docs_logs_trg()'::pg_catalog.regprocedure),
    '%ko.word-chain.long%',
    'the long trigger names the word-chain semantic reference'
);
select unalike(
    (select routine.prosrc from pg_catalog.pg_proc as routine
      where routine.oid = 'public.words_docs_logs_trg()'::pg_catalog.regprocedure),
    '%(201,%',
    'the long trigger no longer inserts legacy 201 directly'
);
select is(
    (select pg_catalog.array_to_string(routine.proconfig, ',')
       from pg_catalog.pg_proc as routine
      where routine.oid = 'public.words_docs_logs_trg()'::pg_catalog.regprocedure),
    'search_path=""',
    'the long trigger has an empty search path'
);
select ok(
    not pg_catalog.has_function_privilege(
        'anon', 'public.words_docs_logs_trg()', 'EXECUTE')
    and not pg_catalog.has_function_privilege(
        'authenticated', 'public.words_docs_logs_trg()', 'EXECUTE')
    and not pg_catalog.has_function_privilege(
        'service_role', 'public.words_docs_logs_trg()', 'EXECUTE'),
    'application roles cannot execute the long trigger function'
);

select alike(
    (select routine.prosrc from pg_catalog.pg_proc as routine
      where routine.oid =
        'public.fn_process_word_docs_update()'::pg_catalog.regprocedure),
    '%ko.word-chain.mission%',
    'the mission trigger names the word-chain semantic reference prefix'
);
select alike(
    (select routine.prosrc from pg_catalog.pg_proc as routine
      where routine.oid =
        'public.fn_process_word_docs_update()'::pg_catalog.regprocedure),
    '%ko.reverse-word-chain.mission%',
    'the mission trigger names the reverse word-chain semantic reference prefix'
);
select alike(
    (select routine.prosrc from pg_catalog.pg_proc as routine
      where routine.oid =
        'public.fn_process_word_docs_update()'::pg_catalog.regprocedure),
    '%ko.kkungkkungtta.mission%',
    'the mission trigger names the Kkungkkungtta semantic reference prefix'
);
select alike(
    (select routine.prosrc from pg_catalog.pg_proc as routine
      where routine.oid =
        'public.fn_process_word_docs_update()'::pg_catalog.regprocedure),
    '%ARRAY[''가'', ''나'', ''다'', ''라'', ''마'', ''바'', ''사'', ''아'', ''자'', ''차'', ''카'', ''타'', ''파'', ''하'']%',
    'the mission trigger has the explicit ordered character array'
);
select alike(
    (select routine.prosrc from pg_catalog.pg_proc as routine
      where routine.oid =
        'public.fn_process_word_docs_update()'::pg_catalog.regprocedure),
    '%ARRAY[''ga'', ''na'', ''da'', ''ra'', ''ma'', ''ba'', ''sa'', ''a'', ''ja'', ''cha'', ''ka'', ''ta'', ''pa'', ''ha'']%',
    'the mission trigger has the explicit ordered semantic-key array'
);
select unalike(
    (select routine.prosrc from pg_catalog.pg_proc as routine
      where routine.oid =
        'public.fn_process_word_docs_update()'::pg_catalog.regprocedure),
    '%209 + i%',
    'the mission trigger no longer computes word-chain child IDs'
);
select unalike(
    (select routine.prosrc from pg_catalog.pg_proc as routine
      where routine.oid =
        'public.fn_process_word_docs_update()'::pg_catalog.regprocedure),
    '%224 + i%',
    'the mission trigger no longer computes reverse word-chain child IDs'
);
select unalike(
    (select routine.prosrc from pg_catalog.pg_proc as routine
      where routine.oid =
        'public.fn_process_word_docs_update()'::pg_catalog.regprocedure),
    '%239 + i%',
    'the mission trigger no longer computes Kkungkkungtta child IDs'
);
select is(
    (select pg_catalog.array_to_string(routine.proconfig, ',')
       from pg_catalog.pg_proc as routine
      where routine.oid =
        'public.fn_process_word_docs_update()'::pg_catalog.regprocedure),
    'search_path=""',
    'the mission trigger has an empty search path'
);
select ok(
    (select routine.prosecdef
       from pg_catalog.pg_proc as routine
      where routine.oid =
        'public.fn_process_word_docs_update()'::pg_catalog.regprocedure),
    'the mission trigger is SECURITY DEFINER'
);
select ok(
    not pg_catalog.has_function_privilege(
        'anon', 'public.fn_process_word_docs_update()', 'EXECUTE')
    and not pg_catalog.has_function_privilege(
        'authenticated', 'public.fn_process_word_docs_update()', 'EXECUTE')
    and not pg_catalog.has_function_privilege(
        'service_role', 'public.fn_process_word_docs_update()', 'EXECUTE'),
    'application roles cannot execute the mission trigger function'
);
select ok(
    (
        select routine.prosrc like '%pg_catalog.now()%'
           and routine.prosrc !~ '(^|[^.[:alnum:]_])now\(\)'
          from pg_catalog.pg_proc as routine
         where routine.oid =
            'public.fn_process_word_docs_update()'::pg_catalog.regprocedure
    ),
    'the mission trigger schema-qualifies every now call'
);

select alike(
    (select routine.prosrc from pg_catalog.pg_proc as routine
      where routine.oid = 'public.sync_parent_last_update()'::pg_catalog.regprocedure),
    '%ko.word-chain.mission%',
    'the parent trigger names the word-chain mission parent reference'
);
select alike(
    (select routine.prosrc from pg_catalog.pg_proc as routine
      where routine.oid = 'public.sync_parent_last_update()'::pg_catalog.regprocedure),
    '%ko.reverse-word-chain.mission%',
    'the parent trigger names the reverse word-chain mission parent reference'
);
select alike(
    (select routine.prosrc from pg_catalog.pg_proc as routine
      where routine.oid = 'public.sync_parent_last_update()'::pg_catalog.regprocedure),
    '%ko.kkungkkungtta.mission%',
    'the parent trigger names the Kkungkkungtta mission parent reference'
);
select unalike(
    (select routine.prosrc from pg_catalog.pg_proc as routine
      where routine.oid = 'public.sync_parent_last_update()'::pg_catalog.regprocedure),
    '%between 209 and 222%',
    'the parent trigger no longer uses word-chain child ID ranges'
);
select unalike(
    (select routine.prosrc from pg_catalog.pg_proc as routine
      where routine.oid = 'public.sync_parent_last_update()'::pg_catalog.regprocedure),
    '%between 224 and 237%',
    'the parent trigger no longer uses reverse word-chain child ID ranges'
);
select unalike(
    (select routine.prosrc from pg_catalog.pg_proc as routine
      where routine.oid = 'public.sync_parent_last_update()'::pg_catalog.regprocedure),
    '%between 239 and 252%',
    'the parent trigger no longer uses Kkungkkungtta child ID ranges'
);
select ok(
    (select routine.prosecdef
       from pg_catalog.pg_proc as routine
      where routine.oid = 'public.sync_parent_last_update()'::pg_catalog.regprocedure),
    'the parent trigger is SECURITY DEFINER'
);
select is(
    (select pg_catalog.array_to_string(routine.proconfig, ',')
       from pg_catalog.pg_proc as routine
      where routine.oid = 'public.sync_parent_last_update()'::pg_catalog.regprocedure),
    'search_path=""',
    'the parent trigger has an empty search path'
);
select ok(
    not pg_catalog.has_function_privilege(
        'anon', 'public.sync_parent_last_update()', 'EXECUTE')
    and not pg_catalog.has_function_privilege(
        'authenticated', 'public.sync_parent_last_update()', 'EXECUTE')
    and not pg_catalog.has_function_privilege(
        'service_role', 'public.sync_parent_last_update()', 'EXECUTE'),
    'application roles cannot execute the parent trigger function'
);

select ok(
    exists (
        select 1
          from pg_catalog.pg_trigger as trigger
          join pg_catalog.pg_attribute as attribute
            on attribute.attrelid = trigger.tgrelid
           and attribute.attname = 'last_update'
         where trigger.tgname = 'trg_sync_parent_last_update'
           and trigger.tgrelid = 'public.docs'::pg_catalog.regclass
           and trigger.tgfoid =
               'public.sync_parent_last_update()'::pg_catalog.regprocedure
           and not trigger.tgisinternal
           and trigger.tgenabled = 'O'
           and trigger.tgtype & 1 = 1
           and trigger.tgtype & 2 = 0
           and trigger.tgtype & 16 = 16
           and attribute.attnum::smallint = any(trigger.tgattr::smallint[])
    ),
    'the docs parent timestamp trigger remains an enabled AFTER UPDATE OF last_update binding'
);

create temporary table parent_trigger_observation (
    scenario text primary key,
    word_chain_parent_changed boolean not null,
    reverse_word_chain_parent_changed boolean not null,
    kkungkkungtta_parent_changed boolean not null,
    source_last_update_preserved boolean not null
) on commit drop;

insert into public.docs (name, typez, reference_code, last_update) values
    ('parent-trigger-malformed-suffix', 'ect', 'ko.word-chain.mission.ga.extra', '2000-01-01'::timestamptz),
    ('parent-trigger-unknown-suffix', 'ect', 'ko.reverse-word-chain.mission.unknown', '2000-01-01'::timestamptz),
    ('parent-trigger-unrelated-code', 'ect', 'future.unrelated', '2000-01-01'::timestamptz),
    ('parent-trigger-null-code', 'ect', null, '2000-01-01'::timestamptz);

do $block$
declare
    baseline constant timestamptz := '2000-01-01'::timestamptz;
    changed_at constant timestamptz := '2001-01-01'::timestamptz;
    mission_keys text[] := array[
        'ga', 'na', 'da', 'ra', 'ma', 'ba', 'sa',
        'a', 'ja', 'cha', 'ka', 'ta', 'pa', 'ha'
    ];
    mission_key text;
    word_chain_parent_id bigint;
    reverse_word_chain_parent_id bigint;
    kkungkkungtta_parent_id bigint;
    source_id bigint;
begin
    select id into word_chain_parent_id
      from public.docs
     where reference_code = 'ko.word-chain.mission';
    select id into reverse_word_chain_parent_id
      from public.docs
     where reference_code = 'ko.reverse-word-chain.mission';
    select id into kkungkkungtta_parent_id
      from public.docs
     where reference_code = 'ko.kkungkkungtta.mission';

    foreach mission_key in array mission_keys loop
        update public.docs
           set last_update = baseline
         where id in (
             word_chain_parent_id,
             reverse_word_chain_parent_id,
             kkungkkungtta_parent_id
         );
        update public.docs
           set last_update = changed_at
         where reference_code = 'ko.word-chain.mission.' || mission_key;
        insert into pg_temp.parent_trigger_observation
        select
            'word-chain.' || mission_key,
            (select last_update <> baseline from public.docs where id = word_chain_parent_id),
            (select last_update <> baseline from public.docs where id = reverse_word_chain_parent_id),
            (select last_update <> baseline from public.docs where id = kkungkkungtta_parent_id),
            true;

        update public.docs
           set last_update = baseline
         where id in (
             word_chain_parent_id,
             reverse_word_chain_parent_id,
             kkungkkungtta_parent_id
         );
        update public.docs
           set last_update = changed_at
         where reference_code = 'ko.reverse-word-chain.mission.' || mission_key;
        insert into pg_temp.parent_trigger_observation
        select
            'reverse-word-chain.' || mission_key,
            (select last_update <> baseline from public.docs where id = word_chain_parent_id),
            (select last_update <> baseline from public.docs where id = reverse_word_chain_parent_id),
            (select last_update <> baseline from public.docs where id = kkungkkungtta_parent_id),
            true;

        update public.docs
           set last_update = baseline
         where id in (
             word_chain_parent_id,
             reverse_word_chain_parent_id,
             kkungkkungtta_parent_id
         );
        update public.docs
           set last_update = changed_at
         where reference_code = 'ko.kkungkkungtta.mission.' || mission_key;
        insert into pg_temp.parent_trigger_observation
        select
            'kkungkkungtta.' || mission_key,
            (select last_update <> baseline from public.docs where id = word_chain_parent_id),
            (select last_update <> baseline from public.docs where id = reverse_word_chain_parent_id),
            (select last_update <> baseline from public.docs where id = kkungkkungtta_parent_id),
            true;
    end loop;

    update public.docs
       set last_update = baseline
     where id in (
         word_chain_parent_id,
         reverse_word_chain_parent_id,
         kkungkkungtta_parent_id
     );
    update public.docs
       set last_update = last_update
     where reference_code = 'ko.word-chain.mission.ga';
    insert into pg_temp.parent_trigger_observation
    select
        'unchanged-last-update',
        (select last_update <> baseline from public.docs where id = word_chain_parent_id),
        (select last_update <> baseline from public.docs where id = reverse_word_chain_parent_id),
        (select last_update <> baseline from public.docs where id = kkungkkungtta_parent_id),
        true;

    foreach source_id in array array[
        (select id from public.docs where reference_code = 'ko.word-chain.long'),
        (select id from public.docs where reference_code = 'ko.reverse-word-chain.long'),
        (select id from public.docs where name = 'parent-trigger-malformed-suffix'),
        (select id from public.docs where name = 'parent-trigger-unknown-suffix'),
        (select id from public.docs where name = 'parent-trigger-unrelated-code'),
        (select id from public.docs where name = 'parent-trigger-null-code')
    ] loop
        update public.docs
           set last_update = baseline
         where id in (
             word_chain_parent_id,
             reverse_word_chain_parent_id,
             kkungkkungtta_parent_id
         );
        update public.docs
           set last_update = changed_at
         where id = source_id;
        insert into pg_temp.parent_trigger_observation
        select
            'non-child.' || source_id,
            (select last_update <> baseline from public.docs where id = word_chain_parent_id),
            (select last_update <> baseline from public.docs where id = reverse_word_chain_parent_id),
            (select last_update <> baseline from public.docs where id = kkungkkungtta_parent_id),
            (select last_update = changed_at from public.docs where id = source_id);
    end loop;

    foreach source_id in array array[
        word_chain_parent_id,
        reverse_word_chain_parent_id,
        kkungkkungtta_parent_id
    ] loop
        update public.docs
           set last_update = baseline
         where id in (
             word_chain_parent_id,
             reverse_word_chain_parent_id,
             kkungkkungtta_parent_id
         );
        update public.docs
           set last_update = changed_at
         where id = source_id;
        insert into pg_temp.parent_trigger_observation
        select
            'parent-code.' || source_id,
            (select last_update <> baseline from public.docs where id = word_chain_parent_id),
            (select last_update <> baseline from public.docs where id = reverse_word_chain_parent_id),
            (select last_update <> baseline from public.docs where id = kkungkkungtta_parent_id),
            (select last_update = changed_at from public.docs where id = source_id);
    end loop;
end;
$block$;

select is(
    (select count(*)::integer from parent_trigger_observation
      where scenario like 'word-chain.%'
        and word_chain_parent_changed
        and not reverse_word_chain_parent_changed
        and not kkungkkungtta_parent_changed),
    14,
    'every exact word-chain suffix updates only the word-chain parent'
);
select is(
    (select count(*)::integer from parent_trigger_observation
      where scenario like 'reverse-word-chain.%'
        and not word_chain_parent_changed
        and reverse_word_chain_parent_changed
        and not kkungkkungtta_parent_changed),
    14,
    'every exact reverse word-chain suffix updates only the reverse word-chain parent'
);
select is(
    (select count(*)::integer from parent_trigger_observation
      where scenario like 'kkungkkungtta.%'
        and not word_chain_parent_changed
        and not reverse_word_chain_parent_changed
        and kkungkkungtta_parent_changed),
    14,
    'every exact Kkungkkungtta suffix updates only the Kkungkkungtta parent'
);
select ok(
    exists (
        select 1 from parent_trigger_observation
         where scenario = 'unchanged-last-update'
           and not word_chain_parent_changed
           and not reverse_word_chain_parent_changed
           and not kkungkkungtta_parent_changed
    ),
    'an unchanged exact child timestamp does not propagate to a parent'
);
select is(
    (select count(*)::integer from parent_trigger_observation
      where scenario like 'non-child.%'
        and not word_chain_parent_changed
        and not reverse_word_chain_parent_changed
        and not kkungkkungtta_parent_changed
        and source_last_update_preserved),
    6,
    'long, malformed, unknown, unrelated, and null references do not propagate'
);
select is(
    (select count(*)::integer from parent_trigger_observation
      where scenario like 'parent-code.%'
        and (
            word_chain_parent_changed::integer
            + reverse_word_chain_parent_changed::integer
            + kkungkkungtta_parent_changed::integer
        ) = 1
        and source_last_update_preserved),
    3,
    'updating a parent code changes only its directly updated parent'
);

select * from finish();
rollback;

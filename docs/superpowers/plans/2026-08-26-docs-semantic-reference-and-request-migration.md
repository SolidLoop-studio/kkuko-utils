# Docs Semantic Reference and Request Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every numeric docs business reference in the word triggers with immutable semantic codes, make fresh local database verification reproducible, and then migrate the remaining `WordsDocsHome` duplicate query and creation-request command out of legacy SCM.

**Architecture:** Five ordered, forward-only migrations add a nullable semantic key, backfill the 47 system docs, introduce one private fail-fast resolver, and replace the long-word, mission-word, and parent-update trigger functions without changing their bindings. pgTAP first characterizes production-ID behavior and then proves identical effects with different primary keys and atomic failures for missing references. After Phase 0B is locally complete, the existing `modules/docs` composition root gains one purpose-built duplicate query and one single-table request command consumed through React Query hooks.

**Tech Stack:** PostgreSQL 15, Supabase CLI 2.62, pgTAP, Node.js, TypeScript 5, React 19, Next.js 15 App Router, TanStack React Query 5, Supabase JS 2, Jest 30, Testing Library

**Spec:** `docs/superpowers/specs/2026-08-26-docs-semantic-reference-design.md`

## Global Constraints

- Preserve the exact 47-role catalog and romanization in the spec. The stable prefixes are `ko.word-chain`, `ko.reverse-word-chain`, and `ko.kkungkkungtta`.
- Keep `docs.id` as a surrogate key. Runtime trigger code must not use `201`, `202`, `208`, `209 + i`, `223`, `224 + i`, `238`, `239 + i`, or the corresponding numeric ranges as business identifiers.
- `docs.reference_code` is nullable, unique when non-null, ASCII-format checked, and immutable after first assignment. Normal user-created docs keep `NULL`.
- Use only new forward migrations. Do not edit, rename, or delete an existing migration, including `supabase/migrations/20260820143308_remote_schema.sql`.
- Do not manually edit `src/app/types/database.types.ts`, run `npm run gen-type`, execute `supabase db push`, use `--linked`, repair remote migration history, or mutate cloud Supabase.
- Cloud rollout remains user/operator controlled; local migration success is not cloud deployment.
- Every new database function uses an explicit safe search path, schema-qualified objects, and least-privilege grants. Resolver and trigger functions are not directly executable by `PUBLIC`, `anon`, `authenticated`, or `service_role`.
- A missing required reference raises SQLSTATE `P0001` with message `DOCS_REQUIRED_REFERENCE_MISSING`, emits server-only diagnostic context, and rolls back the entire initiating transaction.
- Preserve legacy trigger eligibility, log type, logged word/user source, character/category order, one-log-per-contained-character behavior, and parent timestamp propagation.
- Use the repository-local Supabase stack only. Remap configured ports from `54320..54329` to `55320..55329`; stop the local stack after verification even on failure.
- Preserve the exact `WordsDocsHome` Korean messages and the existing login, inline request, and completion modal behavior. Do not expose raw PostgREST `message` or `details`.
- Domain/Application code must not import React, Next.js, Supabase, or generated database types. Supabase tables, columns, query builders, and raw response shapes stay in Infrastructure.
- Do not add a generic docs repository or a new legacy SCM method. Remove only `letterDocs` and `waitDocs` after their final production consumer is gone.
- Follow TDD for each deliverable: establish the stated RED result, add the minimum implementation, then obtain the stated GREEN result before commit.
- Run `git diff --check` for every task. Run focused tests for every task and the full lint/type/Jest/DB verification in Task 10.

---

### Task 2: Characterize the legacy trigger behavior and enable the local DB

**Files:**
- Modify: `supabase/config.toml`
- Create: `supabase/tests/database/docs-reference-trigger-characterization.integration.sql`

**Interfaces:**
- Consumes: legacy `public.words_docs_logs_trg()`, `public.fn_process_word_docs_update()`, and `public.sync_parent_last_update()` exactly as defined in `20260820143308_remote_schema.sql`.
- Produces: a pgTAP behavioral contract that remains green before and after Tasks 3–7.
- Produces: repository-local external ports `55320` shadow DB, `55321` API, `55322` DB, `55323` Studio, `55324` Inbucket, `55325` SMTP comment, `55326` POP3 comment, `55327` analytics, and `55329` pooler.
- Preserves: production IDs, names, trigger bindings, and cloud configuration.

- [ ] **Step 1: Write the legacy characterization test**

Create a transactional pgTAP file with `select no_plan();`, reserved test words, and `select * from finish(); rollback;`. Record the exact 47 ID/name roles using a temporary expected catalog generated from these fixed rows and letter families:

```sql
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
```

Add exact behavioral fixtures and assertions:

```sql
insert into auth.users (id) values
    ('52000000-0000-4000-8000-000000000001'),
    ('52000000-0000-4000-8000-000000000002');
insert into public.users (id, nickname, role) values
    ('52000000-0000-4000-8000-000000000001', 'docs-reference-old', 'r1'),
    ('52000000-0000-4000-8000-000000000002', 'docs-reference-new', 'r1');

delete from public.words where word in (
    '힣힣힣힣힣힣힣힣힣',
    '숲숲숲숲숲숲숲숲숲',
    '봄봄봄봄봄봄봄봄봄',
    '별별별별별별별별별',
    '달달달달달달달달달',
    '꽃꽃꽃꽃꽃꽃꽃꽃꽃'
);
delete from public.docs_logs where word in (
    '힣힣힣힣힣힣힣힣힣',
    '숲숲숲숲숲숲숲숲숲',
    '봄봄봄봄봄봄봄봄봄',
    '별별별별별별별별별',
    '달달달달달달달달달',
    '꽃꽃꽃꽃꽃꽃꽃꽃꽃'
);

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
    '힣힣힣힣힣힣힣힣힣', true,
    '52000000-0000-4000-8000-000000000001'
);
select is(
    (select count(*)::integer from public.docs_logs
      where word = '힣힣힣힣힣힣힣힣힣'
        and docs_id in (201, 202)
        and add_by = '52000000-0000-4000-8000-000000000001'
        and type = 'add'),
    2,
    'a qualifying insert records both long-word docs'
);

delete from public.words where word = '힣힣힣힣힣힣힣힣힣';
select is(
    (select count(*)::integer from public.docs_logs
      where word = '힣힣힣힣힣힣힣힣힣'
        and docs_id in (201, 202)
        and add_by = '52000000-0000-4000-8000-000000000001'
        and type = 'delete'),
    2,
    'an eligible delete records both long-word docs from OLD'
);

insert into public.words (word, k_canuse, added_by) values (
    '숲숲숲숲숲숲숲숲숲', false,
    '52000000-0000-4000-8000-000000000001'
);
update public.words
   set word = '봄봄봄봄봄봄봄봄봄',
       added_by = '52000000-0000-4000-8000-000000000002'
 where word = '숲숲숲숲숲숲숲숲숲';
select is(
    (select count(*)::integer from public.docs_logs
      where word in ('숲숲숲숲숲숲숲숲숲', '봄봄봄봄봄봄봄봄봄')
        and docs_id in (201, 202)),
    0,
    'false-to-false eligibility produces no long-word log'
);

update public.words
   set word = '별별별별별별별별별',
       k_canuse = true,
       added_by = '52000000-0000-4000-8000-000000000001'
 where word = '봄봄봄봄봄봄봄봄봄';
select is(
    (select count(*)::integer from public.docs_logs
      where word = '별별별별별별별별별'
        and docs_id in (201, 202)
        and add_by = '52000000-0000-4000-8000-000000000001'
        and type = 'add'),
    2,
    'false-to-true uses NEW word and NEW added_by'
);

update public.words
   set word = '달달달달달달달달달'
 where word = '별별별별별별별별별';
select is(
    (select count(*)::integer from public.docs_logs
      where word = '달달달달달달달달달' and docs_id in (201, 202)),
    0,
    'true-to-true eligibility produces no long-word log'
);

update public.words
   set word = '꽃꽃꽃꽃꽃꽃꽃꽃꽃',
       k_canuse = false,
       added_by = '52000000-0000-4000-8000-000000000002'
 where word = '달달달달달달달달달';
select is(
    (select count(*)::integer from public.docs_logs
      where word = '꽃꽃꽃꽃꽃꽃꽃꽃꽃'
        and docs_id in (201, 202)
        and add_by = '52000000-0000-4000-8000-000000000002'
        and type = 'delete'),
    2,
    'true-to-false uses NEW word and NEW added_by'
);
```

These assertions explicitly cover qualifying INSERT, eligible DELETE, `false -> true`, `true -> false`, `false -> false`, `true -> true`, and UPDATE provenance from `NEW.word`/`NEW.added_by`. After completing them, use `가가힣` to prove repeated `가` produces one log each at `209`, `224`, and `239`; use `가나힣` to prove a length-three word produces six mission logs; use `가나힣힣` to prove a non-three-character word produces four word-chain/reverse logs and zero Kkungkkungtta logs. Delete each mission fixture and assert its matching `delete` logs. Set child and parent timestamps to `2000-01-01`, insert `가나힣`, and assert the touched child and all three parent timestamps are newer. Delete one copied legacy child, use the four-argument `throws_ok(sql, NULL, NULL, description)` form to assert that insertion fails without fixing the legacy SQLSTATE or message, and assert the word/log rows did not commit. This rollback-only assertion remains valid after Task 4 introduces the stable resolver error; Task 8 owns the exact new error-token contract.

- [ ] **Step 2: Run the local stack command and record RED**

Run:

```bash
npx supabase start
```

Expected: FAIL before tests run because Windows reserves TCP `54265..54364` and the configured `54320..54329` ports overlap that excluded range. `netstat` showing no listener on `54322` does not invalidate the OS exclusion.

- [ ] **Step 3: Remap every configured local Supabase port**

Apply these exact replacements in `supabase/config.toml`:

```toml
[api]
port = 55321

[db]
port = 55322
shadow_port = 55320

[db.pooler]
port = 55329

[studio]
port = 55323

[inbucket]
port = 55324
# smtp_port = 55325
# pop3_port = 55326

[analytics]
port = 55327
```

Do not change the application development port, auth URLs, or any remote project identifier.

- [ ] **Step 4: Start the stack, prove status, and run GREEN**

Run:

```bash
npx supabase start
npx supabase status
npx supabase test db --local supabase/tests/database/docs-reference-trigger-characterization.integration.sql
```

Expected: start and status exit 0 and report the local API on `55321` and DB on `55322`; pgTAP exits 0 with every legacy characterization assertion passing.

- [ ] **Step 5: Stop, inspect, and commit**

Run:

```bash
npx supabase stop
git diff --check
git status --short
```

Expected: the local stack stops, diff check exits 0, and only the config and characterization test are changed. Commit:

```bash
git add supabase/config.toml supabase/tests/database/docs-reference-trigger-characterization.integration.sql
git commit -m "test: characterize docs reference triggers"
```

---

### Task 3: Add `reference_code`, constraints, backfill, and seed assignment

**Files:**
- Create: `supabase/migrations/20260826090000_add_docs_reference_codes.sql`
- Modify: `supabase/seed.sql`
- Create: `supabase/tests/database/docs-reference-schema.integration.sql`

**Interfaces:**
- Produces: `public.docs.reference_code text null`.
- Produces: `docs_reference_code_format_check`, `docs_reference_code_key`, `private.enforce_docs_reference_code_immutable()`, and `trg_docs_reference_code_immutable`.
- Produces: errors `DOCS_REFERENCE_BACKFILL_MISMATCH`, `DOCS_REFERENCE_SEED_MISMATCH`, and `DOCS_REFERENCE_CODE_IMMUTABLE`.
- Produces: the exact 47 code assignments from the spec while retaining production IDs.
- Consumes: Task 2's remapped local configuration and legacy characterization test.

- [ ] **Step 1: Write failing schema/seed tests**

Create `docs-reference-schema.integration.sql` with `begin`, `no_plan`, and rollback. Add assertions for the exact fixed codes, generated mission codes, null behavior, uniqueness, format, and immutability:

```sql
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
    $$ update public.docs set reference_code = 'test.reference.two'
       where name = 'reference-null-a' $$,
    'P0001', 'DOCS_REFERENCE_CODE_IMMUTABLE'
);
select throws_ok(
    $$ update public.docs set reference_code = null
       where name = 'reference-null-a' $$,
    'P0001', 'DOCS_REFERENCE_CODE_IMMUTABLE'
);
```

Use `throws_ok` to prove a duplicate non-null code fails with `23505` and `docs_reference_code_key`, and a value such as `KO invalid` fails with `23514` and `docs_reference_code_format_check`.

- [ ] **Step 2: Run schema tests and verify RED**

Run:

```bash
npx supabase start
npx supabase status
npx supabase test db --local supabase/tests/database/docs-reference-schema.integration.sql
```

Expected: the local stack starts on the remapped ports, then pgTAP FAILS with `column "reference_code" does not exist`.

- [ ] **Step 3: Write the forward schema and remote-safe backfill migration**

Use explicit `begin; ... commit;`. Add the nullable column first. Build one temporary catalog with the five fixed rows and all children from this complete key table:

```sql
create temporary table docs_reference_catalog (
    legacy_id bigint primary key,
    expected_name text not null unique,
    reference_code text not null unique
) on commit drop;

insert into pg_temp.docs_reference_catalog values
    (201, '한국어 끝말잇기 긴단어', 'ko.word-chain.long'),
    (202, '한국어 앞말잇기 긴단어', 'ko.reverse-word-chain.long'),
    (208, '한국어 끝말잇기 미션단어', 'ko.word-chain.mission'),
    (223, '한국어 앞말잇기 미션단어', 'ko.reverse-word-chain.mission'),
    (238, '한국어 쿵쿵따 미션단어', 'ko.kkungkkungtta.mission');

with letters(ordinal, letter, key) as (values
    (1, '가', 'ga'), (2, '나', 'na'), (3, '다', 'da'),
    (4, '라', 'ra'), (5, '마', 'ma'), (6, '바', 'ba'),
    (7, '사', 'sa'), (8, '아', 'a'), (9, '자', 'ja'),
    (10, '차', 'cha'), (11, '카', 'ka'), (12, '타', 'ta'),
    (13, '파', 'pa'), (14, '하', 'ha')
), families(first_id, name_prefix, code_prefix) as (values
    (209, '한국어 끝말잇기 미션단어', 'ko.word-chain.mission'),
    (224, '한국어 앞말잇기 미션단어', 'ko.reverse-word-chain.mission'),
    (239, '한국어 쿵쿵따 미션단어', 'ko.kkungkkungtta.mission')
)
insert into pg_temp.docs_reference_catalog
select
    family.first_id + letter.ordinal - 1,
    family.name_prefix || ' - ' || letter.letter,
    family.code_prefix || '.' || letter.key
from letters as letter cross join families as family;
```

In a `DO` block, count exact `(id, name)` matches. If `public.docs` is non-empty and the count is not 47, raise `DOCS_REFERENCE_BACKFILL_MISMATCH` before updating. Then update by both ID and expected name and assert 47 assigned rows for a non-empty database.

Add the exact format and unique constraints from the spec. Create `private.enforce_docs_reference_code_immutable()` as `language plpgsql security invoker set search_path = ''`; compare `OLD.reference_code` and `NEW.reference_code` with `IS DISTINCT FROM`, reject only when `OLD.reference_code IS NOT NULL`, and return `NEW`. Create the named trigger and revoke direct function execution from all application roles.

- [ ] **Step 4: Add the same catalog to the active seed**

After the existing docs insert and before `setval('public.docs_id_seq', ...)`, create the same catalog as a CTE, update exact ID/name rows from null or the identical code, and assert 47 matches:

```sql
do $seed_check$
begin
    if (select pg_catalog.count(*) from public.docs
        where reference_code is not null) <> 47 then
        raise exception using
            errcode = 'P0001',
            message = 'DOCS_REFERENCE_SEED_MISMATCH';
    end if;
end;
$seed_check$;
```

Do not change existing docs IDs, names, timestamps, types, visibility, `duem`, or sequence behavior.

- [ ] **Step 5: Reset locally and verify GREEN plus regression**

Run:

```bash
npx supabase db reset --local
npx supabase test db --local supabase/tests/database/docs-reference-schema.integration.sql
npx supabase test db --local supabase/tests/database/docs-reference-trigger-characterization.integration.sql
```

Expected: reset exits 0; schema tests pass; the legacy trigger characterization remains green on IDs `201..252`.

- [ ] **Step 6: Inspect and commit**

Run:

```bash
npx supabase stop
git diff --check
git diff -- supabase/migrations/20260826090000_add_docs_reference_codes.sql supabase/seed.sql supabase/tests/database/docs-reference-schema.integration.sql
```

Confirm the migration has 47 generated catalog rows, the seed uses the identical mapping, and no existing migration changed. Commit:

```bash
git add supabase/migrations/20260826090000_add_docs_reference_codes.sql supabase/seed.sql supabase/tests/database/docs-reference-schema.integration.sql
git commit -m "feat: add docs semantic reference codes"
```

---

### Task 4: Add the required-reference resolver and stable diagnostics contract

**Files:**
- Create: `supabase/migrations/20260826100000_add_required_docs_reference_resolver.sql`
- Modify: `supabase/tests/database/docs-reference-schema.integration.sql`

**Interfaces:**
- Produces: `private.require_docs_reference_id(p_reference_code text, p_context text) returns bigint`.
- Produces: SQLSTATE/message contract `P0001 / DOCS_REQUIRED_REFERENCE_MISSING`.
- Produces: server `LOG` diagnostics containing the code, trusted context, session user, and current user without adding client exception detail.
- Consumes: Task 3's unique `public.docs.reference_code`.
- Grants: no direct execution for `PUBLIC`, `anon`, `authenticated`, or `service_role`.

- [ ] **Step 1: Add failing resolver contract tests**

Append these tests:

```sql
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
```

- [ ] **Step 2: Run resolver tests and verify RED**

Run:

```bash
npx supabase start
npx supabase status
npx supabase test db --local supabase/tests/database/docs-reference-schema.integration.sql
```

Expected: FAIL because `private.require_docs_reference_id(text,text)` does not exist.

- [ ] **Step 3: Implement the minimal resolver migration**

Use this contract and control flow:

```sql
begin;

create or replace function private.require_docs_reference_id(
    p_reference_code text,
    p_context text
)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
    resolved_id bigint;
begin
    select document.id
      into resolved_id
      from public.docs as document
     where document.reference_code = p_reference_code;

    if resolved_id is null then
        raise log using
            message = 'DOCS_REQUIRED_REFERENCE_MISSING',
            detail = pg_catalog.format(
                'reference_code=%L context=%L session_user=%s current_user=%s',
                p_reference_code,
                p_context,
                session_user,
                current_user
            );
        raise exception using
            errcode = 'P0001',
            message = 'DOCS_REQUIRED_REFERENCE_MISSING';
    end if;

    return resolved_id;
end;
$function$;

revoke all on function private.require_docs_reference_id(text, text)
    from public, anon, authenticated, service_role;

commit;
```

Do not add a diagnostic table: a missing-reference transaction would roll the row back.

- [ ] **Step 4: Reset and verify GREEN**

Run:

```bash
npx supabase db reset --local
npx supabase test db --local supabase/tests/database/docs-reference-schema.integration.sql
```

Expected: reset and all schema/resolver assertions pass. The local PostgreSQL logs include the diagnostic record for the intentional missing-code assertion, while pgTAP sees only the stable exception message.

- [ ] **Step 5: Inspect and commit**

Run:

```bash
npx supabase stop
git diff --check
git diff -- supabase/migrations/20260826100000_add_required_docs_reference_resolver.sql supabase/tests/database/docs-reference-schema.integration.sql
```

Commit:

```bash
git add supabase/migrations/20260826100000_add_required_docs_reference_resolver.sql supabase/tests/database/docs-reference-schema.integration.sql
git commit -m "feat: add required docs reference resolver"
```

---

### Task 5: Convert the long-word trigger to semantic references

**Files:**
- Create: `supabase/migrations/20260826110000_convert_long_word_docs_trigger.sql`
- Modify: `supabase/tests/database/docs-reference-schema.integration.sql`

**Interfaces:**
- Replaces body only: `public.words_docs_logs_trg() returns trigger`.
- Consumes: `private.require_docs_reference_id(text, text)` with `ko.word-chain.long` and `ko.reverse-word-chain.long`.
- Preserves: trigger `trg_words_docs_logs`, eligibility expression, `NEW`/`OLD` selection, update-transition semantics, log count/order, and no direct docs timestamp update.
- Removes: runtime IDs `201` and `202` from the function body and application-role execute grants.

- [ ] **Step 1: Add failing catalog/security assertions**

Append assertions against `pg_proc.prosrc` and `proconfig`:

```sql
select like(
    (select routine.prosrc from pg_catalog.pg_proc as routine
      where routine.oid = 'public.words_docs_logs_trg()'::pg_catalog.regprocedure),
    '%ko.word-chain.long%',
    'the long trigger names the word-chain semantic reference'
);
select unlike(
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
```

Add one `ok` assertion that `anon`, `authenticated`, and `service_role` all lack direct execute privilege.

- [ ] **Step 2: Run schema tests and verify RED**

Run:

```bash
npx supabase start
npx supabase status
npx supabase test db --local supabase/tests/database/docs-reference-schema.integration.sql
```

Expected: FAIL because the legacy body contains numeric IDs and has no empty search path.

- [ ] **Step 3: Replace the function in one forward migration**

Start the migration with two resolver preflight calls in a `DO` block. Then replace the function with the same three `TG_OP` branches. Inside a branch that needs logs, resolve both IDs before inserting:

```sql
target_docs_ids := array[
    private.require_docs_reference_id(
        'ko.word-chain.long',
        'public.words_docs_logs_trg:' || tg_op
    ),
    private.require_docs_reference_id(
        'ko.reverse-word-chain.long',
        'public.words_docs_logs_trg:' || tg_op
    )
];

insert into public.docs_logs (docs_id, word, add_by, type)
select target_id, target_word, target_user, target_log_type
from pg_catalog.unnest(target_docs_ids) with ordinality
    as target(target_id, position)
order by target.position;
```

For insert/delete, set `target_word`, `target_user`, and `target_log_type` from `NEW` or `OLD` only after confirming eligibility. For update, compute `old_valid` and `new_valid`; return `NEW` immediately when they are equal, otherwise use `NEW.word`, `NEW.added_by`, and `add` or `delete`. Return `NEW`/`OLD` exactly as the legacy branches do. Define the function as `SECURITY DEFINER SET search_path = ''`, qualify enum/table/function references, and revoke direct execution from all application roles.

- [ ] **Step 4: Reset and verify GREEN plus parity**

Run:

```bash
npx supabase db reset --local
npx supabase test db --local supabase/tests/database/docs-reference-schema.integration.sql
npx supabase test db --local supabase/tests/database/docs-reference-trigger-characterization.integration.sql
```

Expected: source/search-path/grant assertions pass and every long-word insert/delete/update characterization remains green.

- [ ] **Step 5: Inspect and commit**

Run:

```bash
npx supabase stop
git diff --check
rg -n "\b201\b|\b202\b" supabase/migrations/20260826110000_convert_long_word_docs_trigger.sql
```

Expected: no numeric matches in the migration function or preflight. Commit:

```bash
git add supabase/migrations/20260826110000_convert_long_word_docs_trigger.sql supabase/tests/database/docs-reference-schema.integration.sql
git commit -m "refactor: resolve long-word docs by semantic code"
```

---

### Task 6: Convert the mission-word trigger to semantic references

**Files:**
- Create: `supabase/migrations/20260826120000_convert_mission_word_docs_trigger.sql`
- Modify: `supabase/tests/database/docs-reference-schema.integration.sql`

**Interfaces:**
- Replaces body only: `public.fn_process_word_docs_update() returns trigger`.
- Consumes: exact arrays `['가','나','다','라','마','바','사','아','자','차','카','타','파','하']` and `['ga','na','da','ra','ma','ba','sa','a','ja','cha','ka','ta','pa','ha']`.
- Consumes: resolver codes under `ko.word-chain.mission`, `ko.reverse-word-chain.mission`, and `ko.kkungkkungtta.mission`.
- Preserves: `AFTER INSERT OR DELETE` binding, `k_canuse` independence, generated length-three rule, one log per contained character/category, update-before-log behavior, and target order.
- Removes: `209 + i`, `224 + i`, and `239 + i` from the function body and application-role execute grants.

- [ ] **Step 1: Add failing function-contract assertions**

Add assertions that the function body contains all three prefixes and both explicit arrays, has `search_path=""`, and does not contain the strings `209 + i`, `224 + i`, or `239 + i`. Add one privilege assertion for all three application roles.

```sql
select unlike(
    (select routine.prosrc from pg_catalog.pg_proc as routine
      where routine.oid =
        'public.fn_process_word_docs_update()'::pg_catalog.regprocedure),
    '%209 + i%',
    'the mission trigger no longer computes word-chain child IDs'
);
```

- [ ] **Step 2: Run schema tests and verify RED**

Run:

```bash
npx supabase start
npx supabase status
npx supabase test db --local supabase/tests/database/docs-reference-schema.integration.sql
```

Expected: FAIL on the semantic-prefix/search-path/numeric-arithmetic assertions.

- [ ] **Step 3: Add a migration preflight for all 42 children**

In a `DO` block, iterate the complete key array and call the resolver for all three prefixes before replacing the function:

```sql
for key_index in 1..14 loop
    perform private.require_docs_reference_id(
        'ko.word-chain.mission.' || mission_keys[key_index],
        'migration:convert_mission_word_docs_trigger'
    );
    perform private.require_docs_reference_id(
        'ko.reverse-word-chain.mission.' || mission_keys[key_index],
        'migration:convert_mission_word_docs_trigger'
    );
    perform private.require_docs_reference_id(
        'ko.kkungkkungtta.mission.' || mission_keys[key_index],
        'migration:convert_mission_word_docs_trigger'
    );
end loop;
```

An incomplete catalog aborts before the old function is replaced.

- [ ] **Step 4: Replace the mission function with ordered resolution**

Set insert/delete variables exactly as the legacy function. Build an initially empty `bigint[]` target list. For each character found with `pg_catalog.strpos(target_word, mission_characters[key_index]) > 0`, append word-chain then reverse-word-chain IDs, and append Kkungkkungtta only when `word_length = 3`:

```sql
target_ids := pg_catalog.array_append(
    target_ids,
    private.require_docs_reference_id(
        'ko.word-chain.mission.' || mission_keys[key_index],
        'public.fn_process_word_docs_update:' || tg_op
    )
);
target_ids := pg_catalog.array_append(
    target_ids,
    private.require_docs_reference_id(
        'ko.reverse-word-chain.mission.' || mission_keys[key_index],
        'public.fn_process_word_docs_update:' || tg_op
    )
);
if word_length = 3 then
    target_ids := pg_catalog.array_append(
        target_ids,
        private.require_docs_reference_id(
            'ko.kkungkkungtta.mission.' || mission_keys[key_index],
            'public.fn_process_word_docs_update:' || tg_op
        )
    );
end if;
```

After the complete list resolves, update `public.docs.last_update` for `id = any(target_ids)` using the legacy UTC expression, then insert `public.docs_logs` from `unnest(target_ids) with ordinality order by position`. Use `target_word`, `target_user`, `add`/`delete`, and the legacy UTC date expression. Return `NULL`, use `SECURITY DEFINER SET search_path = ''`, and revoke direct execution from all application roles.

- [ ] **Step 5: Reset and verify GREEN plus mission parity**

Run:

```bash
npx supabase db reset --local
npx supabase test db --local supabase/tests/database/docs-reference-schema.integration.sql
npx supabase test db --local supabase/tests/database/docs-reference-trigger-characterization.integration.sql
```

Expected: function-contract tests pass; three-character, non-three-character, repeated-character, insert/delete, child timestamp, and parent timestamp characterizations remain green.

- [ ] **Step 6: Inspect and commit**

Run:

```bash
npx supabase stop
git diff --check
rg -n "209|224|239|target_id IN|between 209" supabase/migrations/20260826120000_convert_mission_word_docs_trigger.sql
```

Expected: no numeric child-ID arithmetic or ranges. Commit:

```bash
git add supabase/migrations/20260826120000_convert_mission_word_docs_trigger.sql supabase/tests/database/docs-reference-schema.integration.sql
git commit -m "refactor: resolve mission docs by semantic code"
```

---

### Task 7: Convert mission-parent timestamp propagation

**Files:**
- Create: `supabase/migrations/20260826130000_convert_mission_parent_trigger.sql`
- Modify: `supabase/tests/database/docs-reference-schema.integration.sql`

**Interfaces:**
- Replaces body only: `public.sync_parent_last_update() returns trigger`.
- Consumes: `NEW.reference_code`, the exact 14 suffix keys, and parent codes `ko.word-chain.mission`, `ko.reverse-word-chain.mission`, `ko.kkungkkungtta.mission`.
- Preserves: trigger `trg_sync_parent_last_update`, `last_update IS DISTINCT FROM` guard, one corresponding parent update, and `RETURN NEW`.
- Removes: child numeric ranges and parent IDs `208`, `223`, and `238` from runtime logic and direct application-role execute grants.

- [ ] **Step 1: Add failing parent-function assertions**

Add tests that all three parent codes appear in `prosrc`, `between 209 and 222`, `between 224 and 237`, and `between 239 and 252` do not appear, `proconfig` is `search_path=""`, and application roles lack execute privilege.

- [ ] **Step 2: Run schema tests and verify RED**

Run:

```bash
npx supabase start
npx supabase status
npx supabase test db --local supabase/tests/database/docs-reference-schema.integration.sql
```

Expected: FAIL because the legacy function still branches on numeric ranges.

- [ ] **Step 3: Preflight the three parents and replace the function**

Resolve all three parent codes in a migration `DO` block before replacement. In the new function, keep this exact suffix array:

```sql
mission_keys text[] := array[
    'ga', 'na', 'da', 'ra', 'ma', 'ba', 'sa',
    'a', 'ja', 'cha', 'ka', 'ta', 'pa', 'ha'
];
```

When timestamps differ, select one parent code only if the reference has an exact family prefix and the entire remaining suffix is in `mission_keys`:

```sql
if new.reference_code like 'ko.word-chain.mission.%'
   and pg_catalog.substr(
       new.reference_code,
       pg_catalog.length('ko.word-chain.mission.') + 1
   ) = any(mission_keys) then
    parent_code := 'ko.word-chain.mission';
elsif new.reference_code like 'ko.reverse-word-chain.mission.%'
   and pg_catalog.substr(
       new.reference_code,
       pg_catalog.length('ko.reverse-word-chain.mission.') + 1
   ) = any(mission_keys) then
    parent_code := 'ko.reverse-word-chain.mission';
elsif new.reference_code like 'ko.kkungkkungtta.mission.%'
   and pg_catalog.substr(
       new.reference_code,
       pg_catalog.length('ko.kkungkkungtta.mission.') + 1
   ) = any(mission_keys) then
    parent_code := 'ko.kkungkkungtta.mission';
end if;
```

When `parent_code` is non-null, resolve it with context `public.sync_parent_last_update:UPDATE` and update only that ID to `pg_catalog.now()`. Parents, long docs, arbitrary future codes, and null references cause no update. Use `SECURITY DEFINER SET search_path = ''`, qualify all objects, return `NEW`, and revoke direct execution.

- [ ] **Step 4: Reset and verify GREEN plus full characterization**

Run:

```bash
npx supabase db reset --local
npx supabase test db --local supabase/tests/database/docs-reference-schema.integration.sql
npx supabase test db --local supabase/tests/database/docs-reference-trigger-characterization.integration.sql
```

Expected: source/search-path/grant assertions pass and all three parent timestamp characterizations remain green.

- [ ] **Step 5: Scan all final trigger bodies and commit**

Run:

```bash
npx supabase stop
git diff --check
rg -n "\b201\b|\b202\b|\b208\b|\b223\b|\b238\b|209 \+|224 \+|239 \+|between 209|between 224|between 239" supabase/migrations/20260826110000_convert_long_word_docs_trigger.sql supabase/migrations/20260826120000_convert_mission_word_docs_trigger.sql supabase/migrations/20260826130000_convert_mission_parent_trigger.sql
```

Expected: no matches. Commit:

```bash
git add supabase/migrations/20260826130000_convert_mission_parent_trigger.sql supabase/tests/database/docs-reference-schema.integration.sql
git commit -m "refactor: resolve mission parents by semantic code"
```

---

### Task 8: Prove varying primary keys, stable failures, and rollback

**Files:**
- Create: `supabase/tests/database/docs-semantic-reference.integration.sql`

**Interfaces:**
- Consumes: all five Phase 0B migrations and all three converted trigger functions.
- Produces: end-to-end proof that reference IDs may differ while codes and effects remain stable.
- Produces: missing long-child, mission-child, and mission-parent rollback coverage for `DOCS_REQUIRED_REFERENCE_MISSING`.
- Preserves: the disposable DB through a surrounding transaction and final rollback.

- [ ] **Step 1: Establish RED for the absent integration deliverable**

Run before creating the file:

```bash
npx supabase start
npx supabase status
npx supabase test db --local supabase/tests/database/docs-semantic-reference.integration.sql
```

Expected: nonzero exit because the required integration test path does not exist.

- [ ] **Step 2: Build a varying-PK fixture inside one transaction**

Create the test with `begin`, `no_plan`, and a temporary full backup. Before recording any effects, clear the reserved word rows and then their trigger-created log history in this order:

```sql
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
```

Deleting words first deliberately permits any eligible DELETE trigger to run; deleting their logs second establishes a zero-history baseline. Then create the backup:

```sql
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
```

Assert all 47 IDs are now greater than `900000` and none equals an original ID.

- [ ] **Step 3: Prove long, mission, and parent effects use the new IDs**

Insert the successful varying-PK reserved words `힣힣힣힣힣힣힣힣힣` and `가나힣`. Assert:

- exactly two long `add` logs join to `ko.word-chain.long` and `ko.reverse-word-chain.long`;
- exactly six length-three mission logs join to the `ga` and `na` child codes across all three families;
- every resulting `docs_logs.docs_id` is greater than `900000`;
- the two word-chain children, two reverse children, two Kkungkkungtta children, and all three parents receive timestamps later than a `2000-01-01` baseline;
- deletion emits the same number of `delete` logs at the new IDs.

Use joins on `reference_code` for every expected result; do not reconstruct a target ID with arithmetic in the assertions.

- [ ] **Step 4: Add exact missing-reference and rollback cases**

For each case, copy the target docs row to a temporary one-row table, delete it, call `throws_ok`, assert no partial word/log/timestamp effect, and restore the row before the next case.

Long reference case: copy `ko.word-chain.long` to its one-row temporary restore table, delete that reference, and then run:

```sql
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
select is(
    (select count(*)::integer from public.docs_logs
      where word = '봄봄봄봄봄봄봄봄봄'),
    0,
    'the failed missing-long insert leaves no log for either long reference'
);
```

Also assert `봄봄봄봄봄봄봄봄봄` is absent from `public.words`. This word is deliberately distinct from Step 3's successful `힣힣힣힣힣힣힣힣힣` fixture, and the two zero-count assertions prevent its result from being confused with historical logs or cascade effects. While the reference is still missing, `lives_ok` the unrelated short word `옴옴` to prove unused references are resolved lazily. Restore the copied long reference before starting the mission-child case.

Mission child case: delete `ko.word-chain.mission.ga`, attempt to insert `가힣힣`, expect the same stable error, and assert the word, all mission logs, and observed child/parent timestamps remain at their baselines.

Mission parent case: delete `ko.word-chain.mission`, attempt the same insert, expect the stable error from parent propagation, and assert the initiating word, child update, other parent updates, and all logs roll back.

- [ ] **Step 5: Finish, run GREEN, and run the complete Phase 0B DB set**

End with:

```sql
select * from finish();
rollback;
```

Run:

```bash
npx supabase test db --local supabase/tests/database/docs-semantic-reference.integration.sql
npx supabase test db --local supabase/tests/database/docs-reference-trigger-characterization.integration.sql supabase/tests/database/docs-reference-schema.integration.sql supabase/tests/database/docs-semantic-reference.integration.sql
```

Expected: all files pass with zero failed pgTAP assertions.

- [ ] **Step 6: Inspect and commit**

Run:

```bash
npx supabase stop
git diff --check
git diff -- supabase/tests/database/docs-semantic-reference.integration.sql
```

Confirm every fixture is transaction-scoped and no cloud command or production connection appears. Commit:

```bash
git add supabase/tests/database/docs-semantic-reference.integration.sql
git commit -m "test: verify docs references across primary keys"
```

---

### Task 9: Automate fresh local bootstrap and document DB verification

**Files:**
- Create: `scripts/verify-local-supabase.mjs`
- Modify: `package.json`
- Create: `docs/testing/docs-semantic-reference-integration.md`
- Modify: `docs/testing/word-approval-rpc-integration.md`

**Interfaces:**
- Produces: `npm run test:docs-reference-db` for the three new pgTAP files.
- Produces: `npm run verify:local-db` for local start/status/reset/all-DB-tests/stop.
- Guarantees: `db reset` and `test db` always use `--local`; no linked/remote/push/repair command exists.
- Consumes: Task 2's port remap and Tasks 3–8 migration/test chain.

- [ ] **Step 1: Establish RED for missing automation**

Run:

```bash
npm run verify:local-db
```

Expected: FAIL with `Missing script: "verify:local-db"`.

- [ ] **Step 2: Add the exact package scripts**

Add without changing existing scripts:

```json
"test:docs-reference-db": "supabase test db --local supabase/tests/database/docs-reference-trigger-characterization.integration.sql supabase/tests/database/docs-reference-schema.integration.sql supabase/tests/database/docs-semantic-reference.integration.sql",
"verify:local-db": "node scripts/verify-local-supabase.mjs"
```

- [ ] **Step 3: Implement a fail-fast local-only lifecycle script**

Use `node:child_process` `spawnSync` with `shell: false`, inherited stdio, and `npx.cmd` on Windows or `npx` elsewhere. The command allowlist and order are exact:

```js
const commands = [
    ['supabase', 'start'],
    ['supabase', 'status'],
    ['supabase', 'db', 'reset', '--local'],
    ['supabase', 'test', 'db', '--local'],
];
const stopCommand = ['supabase', 'stop', '--no-backup'];
```

Run each command sequentially and throw with its exit code when it fails. In `finally`, always execute `stopCommand`; preserve the first failure, but make a stop failure fail an otherwise successful run. The script must not accept arbitrary command-line arguments and must not contain `link`, `--linked`, `db push`, a project ref, or a database URL.

- [ ] **Step 4: Write current bootstrap and test documentation**

`docs/testing/docs-semantic-reference-integration.md` must state:

- Docker Desktop/Podman and Supabase CLI prerequisites;
- local ports are `55320..55329` because `54320..54329` overlaps the Windows excluded range;
- `npm run test:docs-reference-db` assumes an already running/reset local stack;
- `npm run verify:local-db` performs a disposable fresh reset, every DB test, and cleanup;
- characterization, schema/resolver, varying-PK, missing-reference, rollback, search-path, and grants coverage;
- cloud and linked databases are forbidden;
- cloud rollout remains a separate operator action.

Update `docs/testing/word-approval-rpc-integration.md` to remove the stale claim that the repository lacks a base schema and the stale `20260820000000` migration path. Point its prerequisites to `npm run verify:local-db` or `npx supabase db reset --local`, and retain its existing behavior/concurrency assertion descriptions.

- [ ] **Step 5: Run the bootstrap automation and verify GREEN**

Run:

```bash
npm run verify:local-db
```

Expected: local start/status/reset succeeds on the remapped ports, every SQL file under `supabase/tests` passes, and the stack is stopped before the script exits 0.

- [ ] **Step 6: Prove the script is remote-safe and commit**

Run:

```bash
rg -n -- "--linked|db push|migration repair|project-ref|postgres(ql)?://|supabase link" scripts/verify-local-supabase.mjs docs/testing/docs-semantic-reference-integration.md
git diff --check
```

Expected: no forbidden command appears in the script; documentation occurrences, if any, only say they are forbidden. Commit:

```bash
git add scripts/verify-local-supabase.mjs package.json docs/testing/docs-semantic-reference-integration.md docs/testing/word-approval-rpc-integration.md
git commit -m "test: automate local database bootstrap"
```

---

### Task 10: Migrate `WordsDocsHome` letter duplicate and creation request boundaries

**Files:**
- Create: `src/modules/docs/application/letter-docs-duplicate-query-ports.ts`
- Create: `src/modules/docs/application/check-letter-docs-duplicate.ts`
- Create: `src/modules/docs/application/docs-creation-request-types.ts`
- Create: `src/modules/docs/application/docs-creation-request-ports.ts`
- Create: `src/modules/docs/application/request-docs-creation.ts`
- Create: `src/modules/docs/infrastructure/browser/supabase-letter-docs-duplicate-query-gateway.ts`
- Create: `src/modules/docs/infrastructure/browser/supabase-docs-creation-request-gateway.ts`
- Create: `src/modules/docs/presentation/use-letter-docs-duplicate.ts`
- Create: `src/modules/docs/presentation/use-docs-creation-request.ts`
- Create: `src/__tests__/modules/docs/application/check-letter-docs-duplicate.test.ts`
- Create: `src/__tests__/modules/docs/application/request-docs-creation.test.ts`
- Create: `src/__tests__/modules/docs/infrastructure/browser/supabase-letter-docs-duplicate-query-gateway.test.ts`
- Create: `src/__tests__/modules/docs/infrastructure/browser/supabase-docs-creation-request-gateway.test.ts`
- Create: `src/__tests__/modules/docs/presentation/use-letter-docs-duplicate.test.tsx`
- Create: `src/__tests__/modules/docs/presentation/use-docs-creation-request.test.tsx`
- Modify: `src/modules/docs/infrastructure/browser/browser-docs-services.ts`
- Modify: `src/modules/docs/presentation/docs-query-keys.ts`
- Modify: `src/modules/docs/index.ts`
- Modify: `src/app/words-docs/WordsDocsHome.tsx`
- Modify: `src/__tests__/words-docs/WordsDocsHome.test.tsx`
- Modify: `src/__tests__/modules/docs/infrastructure/browser/browser-docs-services.test.ts`
- Modify: `src/app/lib/supabase/ISupabaseClientManager.ts`
- Modify: `src/app/lib/supabase/SupabaseClientManager.ts`
- Modify: `docs/architecture/ddd-lite-migration-roadmap.md`

**Interfaces:**
- Produces: `LetterDocsDuplicateQueryGateway.existsByName(docsName): Promise<Result<boolean>>`.
- Produces: `CheckLetterDocsDuplicateService.check(docsName): Promise<Result<boolean>>`.
- Produces: `DocsCreationRequestCommand = { docsName: string; requesterId: string }`.
- Produces: `DocsCreationRequestGateway.request(command): Promise<Result<void>>`.
- Produces: `RequestDocsCreationService.request(command): Promise<Result<void>>`.
- Produces: `useLetterDocsDuplicate(docsName)` at `docsQueryKeys.letterDuplicate(docsName)`, disabled until submit-time `refetch()`.
- Produces: `useLetterDocsDuplicate(docsName): UseQueryResult<boolean, ApplicationError>`.
- Produces: `useDocsCreationRequest()` returning `{ request(command): Promise<Result<void>>; isPending: boolean; error: ApplicationError | null; clearError(): void }`. Its `error` is hook-local state: every submission and `clearError()` reset it to null, a fulfilled `Result.err` or caught throw sets it, and only `Result.ok` invalidates `docsQueryKeys.pendingRequests`.
- Consumes: existing `usePendingDocsRequests().refetch()`, `browserSupabaseClient`, `Result`, `ApplicationError`, `retryDocsQuery`, and `unwrapDocsQuery`.
- Removes: `SCM` import from `WordsDocsHome`, `IGetManager.letterDocs`, `SupabaseGetManager.letterDocs`, `IAddManager.waitDocs`, and `SupabaseAddManager.waitDocs` only after zero-consumer checks.

- [ ] **Step 1: Write failing Application and Infrastructure tests**

Application query tests must prove exact one-code-unit names call the gateway unchanged, while empty or multi-unit names return a validation error without calling it. Command tests prove `{ docsName: '가', requesterId: 'user-7' }` is passed unchanged and empty/multi-unit names or empty requester IDs fail before Infrastructure.

Duplicate adapter tests use an injected fake builder and assert this exact chain:

```ts
client
    .from('docs')
    .select('id')
    .eq('typez', 'letter')
    .eq('name', '가')
    .limit(1);
```

An empty data array maps to `ok(false)` and one well-formed `{ id: 280 }` row maps to `ok(true)`. Supabase error, throw, malformed array, or malformed row maps to:

```ts
err({
    kind: 'infrastructure',
    message: '문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
})
```

Creation adapter tests assert:

```ts
expect(client.from).toHaveBeenCalledWith('docs_wait');
expect(insert).toHaveBeenCalledWith({
    docs_name: '가',
    req_by: 'user-7',
});
```

Successful `{ error: null }` maps to `ok(undefined)`; error, throw, or malformed response maps to the same stable Korean infrastructure error with no raw details.

- [ ] **Step 2: Run service/adapter tests and verify RED**

Run:

```bash
npx jest src/__tests__/modules/docs/application/check-letter-docs-duplicate.test.ts src/__tests__/modules/docs/application/request-docs-creation.test.ts src/__tests__/modules/docs/infrastructure/browser/supabase-letter-docs-duplicate-query-gateway.test.ts src/__tests__/modules/docs/infrastructure/browser/supabase-docs-creation-request-gateway.test.ts --runInBand
```

Expected: FAIL because the contracts and adapters do not exist.

- [ ] **Step 3: Implement the two small Application boundaries and adapters**

Define the exact interfaces above. Validate with `docsName.length === 1` to preserve current JavaScript behavior; do not trim, normalize, or add a Hangul-only rule. Return a validation `ApplicationError` with the same stable request failure message.

`SupabaseLetterDocsDuplicateQueryGateway` narrows the complete response and row from `unknown`, selects only `id`, and treats more than one returned row as infrastructure corruption even though docs name uniqueness should prevent it. `SupabaseDocsCreationRequestGateway` inserts only `docs_name` and `req_by`. Neither adapter exports a Supabase response type.

- [ ] **Step 4: Run service/adapter tests and verify GREEN**

Run the Step 2 command.

Expected: all Application and Infrastructure tests pass.

- [ ] **Step 5: Write failing React Query and composition tests**

Add `docsQueryKeys.letterDuplicate = (docsName: string) => ['docs', 'letter', 'duplicate', docsName] as const` expectations. Hook tests use a real `QueryClient` and mocked `createBrowserDocsServices` to prove:

- the duplicate service is not called on initial render;
- `refetch()` calls `check('가')` and caches the boolean under the exact key;
- validation errors are not retried and infrastructure errors use `retryDocsQuery`;
- the command hook returns a fulfilled service `Result` without relying on React Query rejection state;
- a fulfilled `Result.err` and a caught unexpected throw both set the hook-local `error`;
- `clearError()` sets the local error to null, and starting the next submission clears an earlier error before that submission settles;
- a fulfilled `Result.ok` leaves the local error null and invalidates `['docs','requests','pending']`, while `Result.err` does not invalidate it;
- `isPending` is true while the service promise is unresolved.

Extend `browser-docs-services.test.ts` to require fresh `CheckLetterDocsDuplicateService` and `RequestDocsCreationService` instances wired to their corresponding adapters.

- [ ] **Step 6: Run hook/composition tests and verify RED**

Run:

```bash
npx jest src/__tests__/modules/docs/presentation/use-letter-docs-duplicate.test.tsx src/__tests__/modules/docs/presentation/use-docs-creation-request.test.tsx src/__tests__/modules/docs/infrastructure/browser/browser-docs-services.test.ts --runInBand
```

Expected: FAIL because the hooks, key, services, and composition properties are absent.

- [ ] **Step 7: Compose and export the query and command hooks**

Add these properties to `BrowserDocsServices`:

```ts
letterDocsDuplicateQueryService: CheckLetterDocsDuplicateService;
docsCreationRequestService: RequestDocsCreationService;
```

Construct a new adapter/service pair on each `createBrowserDocsServices()` call, matching current docs composition behavior. `useLetterDocsDuplicate(docsName)` uses `useQuery` with `enabled: false`, `unwrapDocsQuery`, and `retryDocsQuery`.

Implement `useDocsCreationRequest()` with the same fulfilled-`Result` state model as the existing moderation hook:

```ts
const requestInfrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
});

const queryClient = useQueryClient();
const [error, setError] = useState<ApplicationError | null>(null);
const [resolvedService] = useState(
    () => createBrowserDocsServices().docsCreationRequestService,
);
const mutation = useMutation<Result<void>, never, DocsCreationRequestCommand>({
    mutationFn: async (command) => {
        try {
            return await resolvedService.request(command);
        } catch {
            return err(requestInfrastructureError());
        }
    },
    onMutate: () => {
        setError(null);
    },
    onSuccess: async (requestResult) => {
        if (!requestResult.ok) {
            setError(requestResult.error);
            return;
        }
        await queryClient.invalidateQueries({
            queryKey: docsQueryKeys.pendingRequests,
        });
    },
});

return {
    request: (command) => mutation.mutateAsync(command),
    isPending: mutation.isPending,
    error,
    clearError: () => setError(null),
};
```

`requestInfrastructureError()` returns the exact stable Korean infrastructure error asserted in Step 1. `onMutate` is the single new-submission reset point, React Query's `mutation.error` is intentionally unused because the mutation catches throws and fulfills with `Result`, and `clearError()` does not reset cache or mutation state. Export the command type and both hooks from `src/modules/docs/index.ts`.

- [ ] **Step 8: Run hook/composition tests and verify GREEN**

Run the Step 6 command.

Expected: all hook and composition tests pass.

- [ ] **Step 9: Rewrite `WordsDocsHome` tests against the feature hooks and verify RED**

Remove the legacy SCM mock and mock these module exports:

```ts
usePendingDocsRequests,
useLetterDocsDuplicate,
useDocsCreationRequest,
```

Keep the existing pending duplicate and pending query error cases. Add tests for:

- duplicate query `data: true` showing `이미 존재하는 문서명입니다.` and not calling the command;
- duplicate query error showing `문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.`;
- successful request calling `{ docsName: '가', requesterId: 'user-7' }`, closing the request modal, and opening the existing completion modal;
- command failure showing only the stable Korean message and no fake raw `message/details`;
- a missing Redux UUID opening `LoginRequiredModal` without either query or command call.

Run:

```bash
npx jest src/__tests__/words-docs/WordsDocsHome.test.tsx --runInBand
```

Expected: FAIL because the component still calls `SCM.get().letterDocs()` and `SCM.add().waitDocs()`.

- [ ] **Step 10: Migrate the submit orchestration without changing presentation behavior**

At component render, obtain:

```ts
const { refetch: refetchLetterDocsDuplicate } =
    useLetterDocsDuplicate(newDocName);
const { request: requestDocsCreation } = useDocsCreationRequest();
const { refetch: refetchPendingDocsRequests } = usePendingDocsRequests();
```

Keep `newDocLoading`, `newDocError`, and the current three-second clear timers so the button copy and inline error lifetime do not change. In `handleAddDocRequest`, execute the exact order:

1. set loading and clear error;
2. `await refetchLetterDocsDuplicate()`;
3. `await refetchPendingDocsRequests()`;
4. map duplicate-query failure/undefined to the stable request failure copy;
5. map pending-query failure/undefined to `문서 요청 목록을 불러오는 중 오류가 발생했습니다.`;
6. check existing letter boolean, then pending `docsName` equality;
7. `await requestDocsCreation({ docsName: newDocName, requesterId: user.uuid })`;
8. on `!result.ok`, show `result.error.message` only;
9. on success, call the existing `closeAddModal()` and `setShowComplete(true)`.

Remove the SCM import. Do not change search, sorting, grouping, motion, input length, modal markup, button labels, login checks, or `CompleteModal` behavior.

- [ ] **Step 11: Prove zero consumers, then remove only the replaced SCM methods**

Run:

```bash
git grep -n -E "SCM\.get\(\)\.letterDocs\(|SCM\.add\(\)\.waitDocs\(" -- src/app src/modules src/__tests__
```

Expected: no matches. Then delete only:

- `IGetManager.letterDocs()` and `SupabaseGetManager.letterDocs()`;
- `IAddManager.waitDocs()` and `SupabaseAddManager.waitDocs()`.

Do not remove `allDocs`, `addWaitDocs`, moderation RPCs, or any similarly named method with another consumer.

- [ ] **Step 12: Run focused Jest and verify GREEN**

Run:

```bash
npx jest src/__tests__/words-docs/WordsDocsHome.test.tsx src/__tests__/words-docs/WordsDocsHomePage.test.tsx src/__tests__/modules/docs --runInBand
```

Expected: all suites pass; messages and modals match the existing assertions; no test mocks legacy `letterDocs` or `waitDocs`.

- [ ] **Step 13: Update the roadmap to actual final state**

Update the roadmap summary, Phase 0B section, Phase 4/docs notes, progress table, and immediate-work list to state:

- semantic references and varying-PK local tests are complete;
- local bootstrap is reproducible on the remapped ports;
- cloud migrations remain unapplied until the user/operator performs rollout;
- `WordsDocsHome` duplicate query and creation request now use the docs module;
- the component's SCM import and the two replaced manager methods are gone;
- the remaining docs boundaries are the best-effort `docView` mutation, `starDocs`/`startDocs` favorite mutations, and the marker-card `docsLastUpdate(id)` helper read; no uninspected next boundary is guessed.

Do not mark cloud rollout complete.

- [ ] **Step 14: Run final static, Jest, database, and optional build verification**

Run:

```bash
npm run lint
npx tsc --noEmit
npm test -- --runInBand
npm run verify:local-db
git diff --check
git status --short
```

Expected: lint and TypeScript exit 0; all Jest suites pass; fresh local reset and all pgTAP tests pass; the local stack stops; diff check exits 0; status contains only Task 10 files.

Optionally run:

```bash
npm run build
```

Expected if run: production build exits 0. If not run, record `not run; no Next.js build boundary changed` in the task report.

- [ ] **Step 15: Run final boundary scans and commit**

Run:

```bash
git grep -n -E "letterDocs\(|waitDocs\(" -- src/app src/modules src/__tests__
git grep -n -E "SCM|@supabase|database\.types|\.from\(" -- src/app/words-docs/WordsDocsHome.tsx src/modules/docs/application src/modules/docs/presentation
rg -n "\b201\b|\b202\b|\b208\b|\b223\b|\b238\b|209 \+|224 \+|239 \+|between 209|between 224|between 239" supabase/migrations/20260826110000_convert_long_word_docs_trigger.sql supabase/migrations/20260826120000_convert_mission_word_docs_trigger.sql supabase/migrations/20260826130000_convert_mission_parent_trigger.sql
```

Expected: no replaced SCM declaration/call, no presentation/Application Supabase boundary leak, and no numeric reference logic in converted triggers. Commit:

```bash
git add docs/architecture/ddd-lite-migration-roadmap.md src/app/words-docs/WordsDocsHome.tsx src/app/lib/supabase/ISupabaseClientManager.ts src/app/lib/supabase/SupabaseClientManager.ts src/modules/docs src/__tests__/modules/docs src/__tests__/words-docs/WordsDocsHome.test.tsx
git commit -m "refactor: migrate docs creation request boundary"
```

## Completion criteria

- Tasks 2–10 each have one independently reviewable commit and their RED/GREEN evidence recorded.
- Fresh local reset applies the untouched baseline, every existing migration, the five new forward migrations, and the versioned seed without manual restore or remote access.
- All 47 codes match the design; ordinary docs remain null; assigned codes cannot be changed or cleared.
- Valid references resolve at production IDs and deliberately different IDs.
- Missing long, mission-child, or mission-parent references produce `DOCS_REQUIRED_REFERENCE_MISSING`, server diagnostics, and no partial transaction effects.
- The three converted trigger functions have hardened search paths, least-privilege grants, and no numeric docs business identifiers.
- `WordsDocsHome` uses docs feature query/command hooks, preserves Korean messages and modal behavior, and has no SCM import.
- `letterDocs` and `waitDocs` are absent from production code, interfaces, implementations, and tests; unrelated SCM methods remain intact.
- Lint, TypeScript, related/full Jest, fresh bootstrap, and all database tests pass. Build status is explicitly recorded.
- No cloud database action occurred; rollout remains user/operator controlled.

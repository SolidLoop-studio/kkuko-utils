# Exact Word Letter Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/word/stats`가 두음법칙 파생 글자를 제외하고 단어에 실제로 적힌 첫·끝 글자 수를 표시하게 한다.

**Architecture:** 기존 `k_count`, `n_count`, `len3_*`는 게임 연결성용 두음 포함 read model로 유지한다. 같은 집계 행에 `exact_*` 컬럼을 추가하고 기존 통계 트리거 함수가 두 read model을 원자적으로 갱신하며, `/word/stats` 게이트웨이만 새 컬럼을 읽는다.

**Tech Stack:** PostgreSQL/Supabase migrations, pgTAP, TypeScript, Supabase JS, Jest

**Spec:** `docs/superpowers/specs/2026-08-31-exact-word-letter-statistics-design.md`

## Global Constraints

- 기존 두음 포함 카운트와 이를 사용하는 통계 외 소비자의 동작을 변경하지 않는다.
- `src/app/types/database.types.ts`는 수동 편집하지 않는다.
- DB 마이그레이션을 애플리케이션보다 먼저 배포한다.
- 새 프로덕션 동작은 실패하는 테스트를 먼저 확인한 뒤 구현한다.

---

### Task 1: 정확한 글자 통계 DB 계약

**Files:**
- Create: `supabase/tests/database/word-letter-statistics.integration.sql`
- Modify: `package.json`

**Interfaces:**
- Consumes: `public.words`, `public.word_first_letter_counts`, `public.word_last_letter_counts`, `public.revers_duem(text)`
- Produces: `npm run test:word-letter-statistics-db`

- [ ] **Step 1: 실패하는 pgTAP 테스트 작성**

테스트 트랜잭션에서 대상 글자의 기존 값을 임시 테이블에 저장한 뒤 고유한 단어를 직접 삽입한다. `여름`, `가녀`, `녀름새`처럼 두음 파생 여부와 3글자 여부가 드러나는 fixture를 사용하고 다음 차이를 assertion 한다.

```sql
select is(
    (select exact_k_count - before_count
       from public.word_first_letter_counts
      where first_letter = '여'),
    1,
    'the literal first letter receives the exact count'
);
select is(
    (select exact_k_count - before_count
       from public.word_first_letter_counts
      where first_letter = '려'),
    0,
    'a reverse-duem first letter does not receive the exact count'
);
```

INSERT 외에도 DELETE, `k_canuse`, `noin_canuse`, 단어 문자열 UPDATE와 3글자 집계를 각각 검증하고 마지막에 `rollback`한다.

- [ ] **Step 2: DB 테스트가 스키마 부재로 실패하는지 확인**

Run: `npx supabase test db --local supabase/tests/database/word-letter-statistics.integration.sql`

Expected: `exact_k_count` 또는 관련 `exact_*` 컬럼이 존재하지 않아 FAIL.

- [ ] **Step 3: 전용 npm script 추가**

```json
"test:word-letter-statistics-db": "supabase test db --local supabase/tests/database/word-letter-statistics.integration.sql"
```

테스트 script 추가는 동작을 구현하지 않으므로 RED 상태를 유지한다.

### Task 2: 정확한 통계 컬럼, 백필, 트리거 유지

**Files:**
- Create: `supabase/migrations/20260831120000_add_exact_word_letter_statistics.sql`
- Test: `supabase/tests/database/word-letter-statistics.integration.sql`

**Interfaces:**
- Consumes: 기존 `increase_word_stats(character, character, boolean, boolean, integer)`와 `decrease_word_stats(...)`
- Produces: 스펙 4절의 `exact_*` 컬럼과 동일한 시그니처의 교체 함수

- [ ] **Step 1: 정확한 컬럼을 추가하고 원본 단어로 백필**

첫 글자 테이블에 `exact_k_count`, `exact_n_count`, `exact_len3_k_count`, `exact_len3_n_count`와 각 타임스탬프를 추가하고, 끝 글자 테이블에는 `exact_k_count`, `exact_n_count`와 각 타임스탬프를 추가한다. 모든 카운트는 `not null default 0`, 타임스탬프는 nullable이다.

```sql
with exact_first as (
    select upper(left(word, 1))::character(1) as letter,
           count(*) filter (where k_canuse)::integer as k_count,
           count(*) filter (where noin_canuse)::integer as n_count,
           count(*) filter (where length(word) = 3 and k_canuse)::integer as len3_k_count,
           count(*) filter (where length(word) = 3 and noin_canuse)::integer as len3_n_count
      from public.words
     group by upper(left(word, 1))
)
update public.word_first_letter_counts as target
   set exact_k_count = source.k_count,
       exact_n_count = source.n_count,
       exact_len3_k_count = source.len3_k_count,
       exact_len3_n_count = source.len3_n_count
  from exact_first as source
 where target.first_letter = source.letter;
```

끝 글자는 `upper(right(word, 1))`로 같은 방식으로 집계한다. 양수인 카운트의 타임스탬프는 하나의 migration timestamp로 설정한다.

- [ ] **Step 2: 증가 함수에서 정확한 원래 글자만 한 번 갱신**

기존 `FOREACH ... revers_duem(...)` 블록은 그대로 유지한다. 각 블록이 끝난 후 원래 `p_first_letter`, `p_last_letter` 행의 `exact_*`를 조건부 증가시키고, 실제로 증가한 카운트의 타임스탬프만 `v_now`로 바꾼다.

```sql
update public.word_first_letter_counts
   set exact_k_count = exact_k_count + case when p_k_canuse then 1 else 0 end,
       exact_k_count_updated_at = case when p_k_canuse then v_now else exact_k_count_updated_at end,
       exact_n_count = exact_n_count + case when p_noin_canuse then 1 else 0 end,
       exact_n_count_updated_at = case when p_noin_canuse then v_now else exact_n_count_updated_at end
 where first_letter = p_first_letter;
```

같은 UPDATE에 3글자 조건 컬럼을 포함하고 끝 글자 행도 갱신한다.

- [ ] **Step 3: 감소 함수에서 정확한 원래 글자만 한 번 갱신**

증가 함수와 같은 위치에서 `greatest(0, exact_* - delta)`를 사용한다. 기존 두음 포함 감소 루프와 함수 시그니처·소유자·권한은 유지한다.

- [ ] **Step 4: DB 테스트 통과 확인**

Run: `npm run test:word-letter-statistics-db`

Expected: 모든 pgTAP assertion PASS.

### Task 3: `/word/stats` 조회를 정확한 컬럼으로 전환

**Files:**
- Modify: `src/__tests__/modules/word-catalog/infrastructure/browser/supabase-word-statistics-query-gateway.test.ts`
- Modify: `src/modules/word-catalog/infrastructure/browser/supabase-word-statistics-query-gateway.ts`

**Interfaces:**
- Consumes: Task 2의 `exact_*` 컬럼
- Produces: 변경 없는 `WordStatisticsQueryGateway.load(): Promise<Result<WordStatistics>>`

- [ ] **Step 1: 정확한 컬럼 계약을 요구하도록 Jest fixture와 assertion 변경**

fixture의 기존 두음 포함 값과 정확한 값을 다르게 둔다.

```ts
const firstLetterRow = {
    first_letter: '가',
    k_count: 99,
    exact_k_count: 11,
    exact_n_count: 7,
    exact_k_count_updated_at: '2026-08-24T00:00:00Z',
    exact_n_count_updated_at: null,
    exact_len3_k_count: 5,
    exact_len3_n_count: 3,
    exact_len3_k_count_updated_at: '2026-08-23T00:00:00Z',
    exact_len3_n_count_updated_at: null,
};
```

select operation이 정확한 컬럼만 요청하는지와 DTO 값이 `exact_*`에서 오는지 검증한다.

- [ ] **Step 2: Jest 테스트가 기존 컬럼 선택 때문에 실패하는지 확인**

Run: `npx jest src/__tests__/modules/word-catalog/infrastructure/browser/supabase-word-statistics-query-gateway.test.ts --runInBand`

Expected: DTO 값 또는 select column assertion mismatch로 FAIL.

- [ ] **Step 3: 게이트웨이의 select와 parser column mapping 변경**

첫 글자 일반 통계는 `exact_k_count`, `exact_n_count`, 쿵쿵따는 `exact_len3_k_count`, `exact_len3_n_count`, 끝 글자는 `exact_k_count`, `exact_n_count`를 `parseStatisticEntry`에 전달한다. application DTO와 UI는 변경하지 않는다.

- [ ] **Step 4: 대상 Jest 테스트 통과 확인**

Run: `npx jest src/__tests__/modules/word-catalog/infrastructure/browser/supabase-word-statistics-query-gateway.test.ts src/__tests__/word/stats/WordStatsHome.test.tsx --runInBand`

Expected: 두 스위트 모두 PASS.

### Task 4: 전체 검증과 배포 준비

**Files:**
- Verify: `docs/superpowers/specs/2026-08-31-exact-word-letter-statistics-design.md`
- Verify: `docs/superpowers/plans/2026-08-31-exact-word-letter-statistics.md`
- Verify: all modified production and test files

**Interfaces:**
- Consumes: Tasks 1–3의 DB와 애플리케이션 변경
- Produces: DB 우선 배포가 가능한 검증된 변경 세트

- [ ] **Step 1: 스펙과 diff 대조**

기존 카운트를 변경하거나 다른 소비자를 `exact_*`로 전환한 코드가 없는지 확인한다. `database.types.ts`가 변경되지 않았는지도 확인한다.

- [ ] **Step 2: 정적 검증 실행**

Run: `npm run lint`

Expected: exit code 0.

Run: `npx tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 3: 전체 Jest 실행**

Run: `npm test -- --runInBand`

Expected: 모든 스위트 PASS.

- [ ] **Step 4: 로컬 DB 검증 실행 또는 환경 제한 기록**

Run: `npm run verify:local-db`

Expected: 로컬 Supabase 시작, reset, 전체 pgTAP PASS, 정상 종료. Docker 또는 로컬 Supabase를 사용할 수 없으면 실행하지 못한 정확한 이유와 Task 2의 대상 DB 테스트 상태를 최종 보고한다.

- [ ] **Step 5: diff 무결성 확인**

Run: `git diff --check`

Expected: 출력 없이 exit code 0.

Run: `git status --short`

Expected: 이 기능의 스펙, 계획, migration, DB 테스트, package script, 통계 gateway/test만 표시된다.

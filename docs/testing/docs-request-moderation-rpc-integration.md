# 관리자 docs 요청 moderation RPC 통합 테스트

관리자 docs 요청의 승인·반려 mutation은 다음 migration에 정의되어 있다.

```text
supabase/migrations/20260822130000_admin_docs_request_moderation.sql
```

## 전제 조건과 범위

- Docker를 실행할 수 있어야 하며, Supabase CLI와 프로젝트 의존성이 설치되어 있어야 한다.
- 테스트 대상은 `public.approve_docs_requests(jsonb)`와
  `public.reject_docs_requests(jsonb)`이다.
- behavior pgTAP suite는
  `supabase/tests/database/docs-request-moderation.integration.sql`이고,
  real-session `dblink` concurrency suite는
  `supabase/tests/database/docs-request-moderation-concurrency.integration.sql`이다.
- migration history가 현재 worktree보다 앞서 있거나 migration이 아직 local DB에 적용되지
  않았으면 아래의 local migration 명령을 먼저 실행한다. 전체 local reset은 관련 없는
  개발 데이터를 지울 수 있으므로 명시적 승인 없이 사용하지 않는다.

로컬 Supabase Docker stack에서만 다음 순서로 실행한다.

```bash
npx supabase start
npx supabase migration up --local
npm run test:docs-request-moderation-db
npx supabase stop
```

이미 local DB에 해당 migration이 적용되었으면 `npx supabase migration up --local`은
생략할 수 있다. 테스트 또는 migration이 실패해도 cleanup으로
`npx supabase stop`을 반드시 실행한다.

`--linked`, project reference, remote Supabase project를 이 테스트에 사용해서는 안 된다.
원격/linked target은 local verification의 대체 수단이 아니며, cloud migration rollout은
사용자 또는 운영자가 별도로 통제한다.

## 기대 검증 범위

`npm run test:docs-request-moderation-db`는 두 pgTAP suite를 차례로 실행한다.

- behavior suite는 인증·관리자 권한·RPC execute 권한·고정 `search_path`, 입력 형식과
  최대 개수 검증, 누락 요청 conflict, 승인 시 docs 생성과 wait row 삭제, 반려 결과,
  중간 실패 시 rollback을 검증한다.
- concurrency suite는 두 인증된 관리자 session이 같은 요청을 승인·반려하려 할 때 실제
  lock contention을 만들고, 정확히 한 transaction만 성공하며 다른 하나는 stable conflict를
  받고, wait row와 docs side effect가 중복되지 않는지 검증한다.

테스트는 자체 fixture와 synchronization function을 정리한다. 그러나 Docker stack 자체는
정리하지 않으므로 명령 종료 상태와 관계없이 마지막 `npx supabase stop`을 실행해야 한다.

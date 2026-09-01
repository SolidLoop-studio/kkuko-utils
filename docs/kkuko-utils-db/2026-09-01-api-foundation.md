# Kkuko Utils DB API Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 가칭 `kkuko-utils-db` NestJS 저장소에 PostgreSQL 연결, SQL migration, 표준 오류, 관측성, Supabase 임시 인증·role 확인 기반을 구축한다.

**Architecture:** NestJS는 유일한 PostgreSQL client이며 `pg` pool과 Kysely를 사용한다. 인증은 port 뒤에 격리된 Supabase HTTP adapter가 수행하고, application/domain은 NestJS·Supabase·Kysely를 모른다. Migration은 checksum과 advisory lock을 가진 SQL-first runner가 별도 배포 job에서 실행한다.

**Tech Stack:** Node.js, TypeScript, NestJS, `pg`, Kysely, Jest, Supertest, class-validator, `@nestjs/config`, Helmet

**Spec:** `../superpowers/specs/2026-09-01-pg-api-strangler-migration-design.md`

## Global Constraints

- 이 문서의 `src/`, `test/`, `migrations/` 경로는 향후 별도 `kkuko-utils-db` 저장소 루트 기준이다.
- 현재 `kkuko-utils` 저장소 안에 NestJS 프로젝트를 생성하지 않는다.
- PostgreSQL credential은 NestJS runtime과 migration job에만 둔다.
- Runtime과 migrator DB credential을 분리한다.
- ORM schema sync를 사용하지 않고 versioned SQL migration만 사용한다.
- API 오류는 `{ error: { code, message, details, requestId } }` 형식을 사용한다.
- Access token, service key, DB URL과 사용자 payload 원문을 로그에 남기지 않는다.
- 구현 완료 후 `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`를 실행한다.

---

## File Map

### 신규 백엔드 저장소

- `package.json`: 실행·검증·migration script와 고정 dependency
- `src/main.ts`: validation, Helmet, CORS, request ID, graceful shutdown
- `src/app.module.ts`: Config/Common module 조합
- `src/common/config/environment.ts`: 환경변수 검증과 typed config
- `src/common/database/*`: pg pool, Kysely provider, transaction runner, DB types
- `scripts/migrate.ts`: SQL migration lock/checksum/apply
- `migrations/0001_foundation.sql`: role 전제와 migration 외 application baseline
- `src/common/errors/*`: application 오류와 HTTP exception filter
- `src/common/observability/*`: request context와 구조화 logger
- `src/common/auth/*`: identity/role port, Supabase adapter, bearer/role guards
- `src/common/health/*`: liveness/readiness
- `test/*`: e2e와 실제 PostgreSQL test harness

## Task 1: NestJS Strict Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `nest-cli.json`
- Create: `eslint.config.mjs`
- Create: `src/main.ts`
- Create: `src/app.module.ts`
- Create: `src/app.controller.ts`
- Test: `src/app.controller.spec.ts`

**Interfaces:**
- Produces: `AppModule`, `GET /` 임시 boot probe, `npm run typecheck`

- [ ] **Step 1: 저장소를 별도 위치에 strict NestJS로 scaffold한다**

Run from the future parent directory:

```bash
npx @nestjs/cli new kkuko-utils-db --package-manager npm --strict --skip-git
cd kkuko-utils-db
git init
```

Expected: `kkuko-utils-db/package.json`과 `src/`가 생성되고 현재 `kkuko-utils`에는 생성되지 않는다.

- [ ] **Step 2: PostgreSQL/API 기반 dependency와 script를 추가한다**

Run:

```bash
npm install @nestjs/config @nestjs/swagger class-transformer class-validator helmet kysely pg
npm install -D @testcontainers/postgresql @types/pg supertest @types/supertest tsx
```

Add scripts:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "migrate": "tsx scripts/migrate.ts",
    "test:integration": "jest --config ./test/jest-integration.json --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json --runInBand"
  }
}
```

- [ ] **Step 3: 기본 controller test를 실패 상태로 확인한다**

```ts
it('returns the service identity', () => {
  expect(controller.getService()).toEqual({ service: 'kkuko-utils-db' });
});
```

Run: `npm test -- app.controller.spec.ts`

Expected: FAIL because `getService` does not exist.

- [ ] **Step 4: 임시 boot probe를 구현한다**

```ts
@Controller()
export class AppController {
  @Get()
  getService(): { service: string } {
    return { service: 'kkuko-utils-db' };
  }
}
```

- [ ] **Step 5: 기본 검증을 실행한다**

Run: `npm run lint && npm run typecheck && npm test -- app.controller.spec.ts`

Expected: PASS.

- [ ] **Step 6: 커밋한다**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.build.json nest-cli.json eslint.config.mjs src
git commit -m "chore: scaffold database api"
```

## Task 2: Typed Environment Configuration

**Files:**
- Create: `src/common/config/environment.ts`
- Create: `src/common/config/environment.spec.ts`
- Modify: `src/app.module.ts`
- Create: `.env.example`

**Interfaces:**
- Produces: `Environment`, `validateEnvironment(input: Record<string, unknown>): Environment`
- Required keys: `NODE_ENV`, `PORT`, `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `CORS_ORIGINS`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`

- [ ] **Step 1: 누락 secret을 거부하는 test를 작성한다**

```ts
it('rejects a missing database URL', () => {
  expect(() => validateEnvironment({ NODE_ENV: 'test', PORT: '3001' }))
    .toThrow('DATABASE_URL');
});
```

- [ ] **Step 2: test가 실패하는지 확인한다**

Run: `npm test -- environment.spec.ts`

Expected: FAIL because the validator is absent.

- [ ] **Step 3: 명시적 parser를 구현한다**

`validateEnvironment`는 다음을 보장한다.

```ts
export interface Environment {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  migrationDatabaseUrl: string;
  corsOrigins: string[];
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
}
```

- URL은 `postgres:`, `postgresql:`, `http:`, `https:` scheme을 용도에 맞게 검사한다.
- `CORS_ORIGINS`는 comma 분리 후 trim하고 빈 값과 `*`를 거부한다.
- production에서 placeholder 문자열과 동일한 anon/service key를 거부한다.

- [ ] **Step 4: ConfigModule에 연결한다**

```ts
ConfigModule.forRoot({
  isGlobal: true,
  validate: validateEnvironment,
});
```

- [ ] **Step 5: `.env.example`을 secret 없는 값으로 작성하고 test한다**

```dotenv
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://kkuko_api:change-me@127.0.0.1:5432/kkuko
MIGRATION_DATABASE_URL=postgresql://kkuko_migrator:change-me@127.0.0.1:5432/kkuko
CORS_ORIGINS=http://localhost:3000
SUPABASE_URL=https://project.supabase.co
SUPABASE_ANON_KEY=replace-me
SUPABASE_SERVICE_KEY=replace-me
```

Run: `npm test -- environment.spec.ts && npm run typecheck`

- [ ] **Step 6: 커밋한다**

```bash
git add src/common/config src/app.module.ts .env.example
git commit -m "feat: validate api environment"
```

## Task 3: pg Pool, Kysely Provider, and Transaction Runner

**Files:**
- Create: `src/common/database/database.types.ts`
- Create: `src/common/database/database.constants.ts`
- Create: `src/common/database/database.module.ts`
- Create: `src/common/database/kysely.provider.ts`
- Create: `src/common/database/transaction-runner.ts`
- Create: `src/common/database/transaction-runner.spec.ts`
- Create: `test/database-test-harness.ts`
- Create: `test/jest-integration.json`

**Interfaces:**
- Produces: `DATABASE` injection token, `Database`, `TransactionRunner.run<T>(work): Promise<T>`

```ts
export interface DatabaseSchema {}
export type Database = Kysely<DatabaseSchema>;

export interface TransactionRunner {
  run<T>(work: (transaction: Transaction<DatabaseSchema>) => Promise<T>): Promise<T>;
}
```

- [ ] **Step 1: commit/rollback test를 작성한다**

```ts
it('rolls back when the callback throws', async () => {
  await expect(runner.run(async (trx) => {
    await sql`select 1`.execute(trx);
    throw new Error('rollback');
  })).rejects.toThrow('rollback');
});
```

- [ ] **Step 2: test 실패를 확인한다**

Run: `npm test -- transaction-runner.spec.ts`

- [ ] **Step 3: pg/Kysely provider를 구현한다**

- Config의 `DATABASE_URL`만 runtime provider에 사용한다.
- `application_name=kkuko-utils-db`를 설정한다.
- pool error event를 logger에 전달하되 connection string은 기록하지 않는다.
- shutdown hook에서 `database.destroy()`를 호출한다.

- [ ] **Step 4: 실제 PostgreSQL test harness를 구현한다**

`@testcontainers/postgresql`로 suite당 PostgreSQL container를 시작하고, test별 schema를
초기화한 뒤 SQL migration runner를 적용한다. `CI`에서 Docker를 사용할 수 없는 경우를
조용히 skip하지 말고 명시적으로 실패시킨다. `test/jest-integration.json`은
`test/database/**/*.integration-spec.ts`를 실행한다.

- [ ] **Step 5: transaction runner를 구현한다**

```ts
run<T>(work: (transaction: Transaction<DatabaseSchema>) => Promise<T>): Promise<T> {
  return this.database.transaction().execute(work);
}
```

- [ ] **Step 6: test/typecheck를 실행한다**

Run: `npm test -- transaction-runner.spec.ts && npm run test:integration && npm run typecheck`

- [ ] **Step 7: 커밋한다**

```bash
git add src/common/database test/database-test-harness.ts test/jest-integration.json
git commit -m "feat: add typed postgres access"
```

## Task 4: SQL Migration Runner

**Files:**
- Create: `scripts/migrate.ts`
- Create: `scripts/migration-runner.ts`
- Create: `scripts/migration-runner.spec.ts`
- Create: `migrations/0001_foundation.sql`

**Interfaces:**
- Produces: `runMigrations(pool, directory): Promise<void>`
- Migration table: `schema_migrations(name text primary key, checksum text not null, applied_at timestamptz not null)`

- [ ] **Step 1: 순서·checksum 변경 거부 test를 작성한다**

```ts
it('rejects a changed migration that was already applied', async () => {
  await runMigrations(pool, fixtures.original);
  await expect(runMigrations(pool, fixtures.changed))
    .rejects.toThrow('MIGRATION_CHECKSUM_MISMATCH');
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- migration-runner.spec.ts`

- [ ] **Step 3: runner를 구현한다**

Runner requirements:

- `MIGRATION_DATABASE_URL`만 사용한다.
- 파일명 `/^\d{4}_[a-z0-9_]+\.sql$/`만 허용한다.
- 이름순 정렬한다.
- SHA-256 checksum을 계산한다.
- `pg_advisory_lock(hashtext('kkuko-utils-db:migrations'))`을 잡는다.
- migration 하나와 history insert를 같은 transaction에서 실행한다.
- 적용된 파일이 사라졌거나 checksum이 달라지면 실패한다.
- 성공/실패 로그에 SQL 본문이나 URL을 출력하지 않는다.
- finally에서 advisory lock과 pool을 정리한다.

- [ ] **Step 4: foundation migration을 작성한다**

```sql
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
```

DB role 생성은 managed provider의 권한 차이가 있으므로 application migration에 넣지 않고 provisioning runbook에서 수행한다.

- [ ] **Step 5: test와 빈 DB 적용을 검증한다**

Run: `npm test -- migration-runner.spec.ts && npm run migrate`

Expected: 첫 실행은 0001 적용, 두 번째 실행은 no-op.

- [ ] **Step 6: 커밋한다**

```bash
git add scripts migrations package.json
git commit -m "feat: add sql migration runner"
```

## Task 5: Request Context and Stable Error Envelope

**Files:**
- Create: `src/common/errors/application-error.ts`
- Create: `src/common/errors/http-error.filter.ts`
- Create: `src/common/errors/http-error.filter.spec.ts`
- Create: `src/common/observability/request-context.middleware.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces: `ApplicationError`, `HttpErrorFilter`, `request.id`

```ts
export interface ApplicationError {
  code: string;
  message: string;
  status: number;
  details?: Readonly<Record<string, unknown>> | null;
}
```

- [ ] **Step 1: 오류 envelope test를 작성한다**

```ts
expect(response.body).toEqual({
  error: {
    code: 'INTERNAL_ERROR',
    message: '요청을 처리하지 못했습니다.',
    details: null,
    requestId: expect.any(String),
  },
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- http-error.filter.spec.ts`

- [ ] **Step 3: middleware/filter를 구현한다**

- 유효한 inbound `x-request-id`는 길이와 문자 allowlist 검사 후 사용한다.
- 없거나 잘못되면 `crypto.randomUUID()`를 사용한다.
- response `x-request-id`와 오류 body가 같은 값을 사용한다.
- 예상하지 못한 오류는 production에서 stack/message를 노출하지 않는다.
- validation 오류는 `VALIDATION_FAILED`와 안전한 field details로 변환한다.

- [ ] **Step 4: main bootstrap을 harden한다**

```ts
app.use(helmet());
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: false,
}));
app.enableCors({ origin: environment.corsOrigins });
app.enableShutdownHooks();
```

- [ ] **Step 5: test한다**

Run: `npm test -- http-error.filter.spec.ts && npm run typecheck`

- [ ] **Step 6: 커밋한다**

```bash
git add src/common/errors src/common/observability src/main.ts
git commit -m "feat: standardize api errors"
```

## Task 6: Supabase Identity and Role Adapters

**Files:**
- Create: `src/common/auth/application/auth-ports.ts`
- Create: `src/common/auth/application/auth-types.ts`
- Create: `src/common/auth/infrastructure/supabase/supabase-identity-verifier.ts`
- Create: `src/common/auth/infrastructure/supabase/supabase-role-reader.ts`
- Test: `src/common/auth/infrastructure/supabase/*.spec.ts`

**Interfaces:**
- Produces: `IdentityVerifier.verifyAccessToken`, `UserAuthorizationReader.getRole`

```ts
export type UserRole = 'r1' | 'r2' | 'r3' | 'r4' | 'admin';
export interface AuthenticatedIdentity { userId: string }
```

- [ ] **Step 1: token/user parsing test를 작성한다**

```ts
it('returns only the verified user id', async () => {
  fetchMock.mockResolvedValue(jsonResponse({ id: actorId }));
  await expect(verifier.verifyAccessToken('token'))
    .resolves.toEqual({ userId: actorId });
});
```

또한 401, 5xx, timeout, malformed body, invalid UUID와 unknown role을 각각 test한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- supabase-identity-verifier.spec.ts supabase-role-reader.spec.ts`

- [ ] **Step 3: identity verifier를 구현한다**

- `GET {SUPABASE_URL}/auth/v1/user`
- Header: `apikey: SUPABASE_ANON_KEY`, `Authorization: Bearer <user token>`
- 401/403은 `AUTH_TOKEN_INVALID`, timeout/5xx는 `IDENTITY_PROVIDER_UNAVAILABLE`
- response에서 검증된 UUID `id`만 반환

- [ ] **Step 4: role reader를 구현한다**

- `GET {SUPABASE_URL}/rest/v1/users?id=eq.<encoded UUID>&select=id,role&limit=1`
- `apikey`와 `Authorization: Bearer <SUPABASE_SERVICE_KEY>`는 NestJS 내부에서만 설정
- 결과 0건은 null, 중복/malformed/unknown role은 infrastructure 오류
- AbortController timeout을 적용하고 token/key를 오류에 포함하지 않음

- [ ] **Step 5: test/typecheck를 실행한다**

Run: `npm test -- src/common/auth && npm run typecheck`

- [ ] **Step 6: 커밋한다**

```bash
git add src/common/auth
git commit -m "feat: verify users with supabase"
```

## Task 7: Bearer Authentication and Role Guards

**Files:**
- Create: `src/common/auth/presentation/http/authenticated-user.decorator.ts`
- Create: `src/common/auth/presentation/http/bearer-auth.guard.ts`
- Create: `src/common/auth/presentation/http/roles.decorator.ts`
- Create: `src/common/auth/presentation/http/roles.guard.ts`
- Test: corresponding `*.spec.ts`

**Interfaces:**
- Produces: `@AuthenticatedUser()`, `@Roles('admin', 'r4')`, `BearerAuthGuard`, `RolesGuard`

- [ ] **Step 1: 인증·role matrix test를 작성한다**

```ts
it.each([
  ['admin', true],
  ['r4', true],
  ['r1', false],
  ['r2', false],
  ['r3', false],
] as const)('checks role %s', async (role, allowed) => {
  roleReader.getRole.mockResolvedValue(role);
  expect(await evaluateGuard()).toBe(allowed);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- bearer-auth.guard.spec.ts roles.guard.spec.ts`

- [ ] **Step 3: guards를 구현한다**

- Bearer scheme은 대소문자 규칙을 명확히 하고 token 공백/중복 header를 거부한다.
- verifier 결과의 userId만 request auth context에 저장한다.
- role은 별도 reader로 조회한다.
- token 없음 `AUTH_TOKEN_REQUIRED`, invalid `AUTH_TOKEN_INVALID`, role 부족 `INSUFFICIENT_ROLE`.

- [ ] **Step 4: decorator를 구현하고 test한다**

Run: `npm test -- src/common/auth && npm run typecheck`

- [ ] **Step 5: 커밋한다**

```bash
git add src/common/auth/presentation
git commit -m "feat: enforce api roles"
```

## Task 8: Liveness, Readiness, and Foundation E2E

**Files:**
- Create: `src/common/health/health.controller.ts`
- Create: `src/common/health/health.service.ts`
- Create: `src/common/health/health.module.ts`
- Modify: `src/app.module.ts`
- Create: `test/foundation.e2e-spec.ts`
- Create: `test/jest-e2e.json`

**Interfaces:**
- Produces: `GET /health/live`, `GET /health/ready`

- [ ] **Step 1: e2e test를 작성한다**

```ts
await request(app.getHttpServer())
  .get('/health/ready')
  .expect(200)
  .expect({ status: 'ready' });
```

DB가 실패하도록 주입한 경우 503과 `DATABASE_UNAVAILABLE`을 기대한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npm run test:e2e -- foundation.e2e-spec.ts`

- [ ] **Step 3: health endpoints를 구현한다**

- liveness는 process event loop가 응답 가능한지만 확인한다.
- readiness는 `select 1`을 짧은 timeout으로 실행한다.
- readiness 응답에 DB URL, host, version을 노출하지 않는다.

- [ ] **Step 4: 전체 foundation 검증을 실행한다**

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run migrate
```

Expected: 모두 PASS, migration 두 번째 실행 no-op, git diff 없음.

- [ ] **Step 5: 커밋한다**

```bash
git add src/common/health src/app.module.ts test
git commit -m "feat: expose api health checks"
```

## Plan Completion Gate

- [ ] Runtime과 migration URL이 분리되었다.
- [ ] SQL migration checksum/advisory lock test가 통과한다.
- [ ] 실제 PostgreSQL에서 transaction/health test가 통과한다.
- [ ] Supabase identity와 role 장애가 401/403/503으로 구분된다.
- [ ] token과 secret이 log/error에 노출되지 않는다.
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`가 모두 통과한다.
- [ ] notification 계획을 시작하기 전에 foundation PR이 독립적으로 review 가능하다.

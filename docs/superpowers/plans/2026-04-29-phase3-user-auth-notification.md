# Phase 3: User + Auth + Notification 도메인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `SupabaseClientManager`의 User·Auth·Notification 관련 메서드를 DDD-Lite 3계층(Domain → Application → Infrastructure)으로 분리하고, `WordServiceContainer`의 인라인 `SupabaseUserContributionUpdater`를 정식 `UserService`로 교체한다.

**Architecture:** 기존 Phase 1·2와 동일한 패턴 — Domain(Entity + Repository interface) → Application(Service) → Infrastructure(SupabaseRepository) → ServiceContainer. Strangler Fig 원칙에 따라 SCM은 그대로 유지하며 새 서비스와 공존. 테스트는 Repository mock으로 Application Service만 단위 테스트.

**Tech Stack:** TypeScript, Supabase JS v2, Jest, `@supabase/supabase-js` Session type, axios(setNickname API만)

---

## 현재 상태 점검 (Phase 1·2 완료 확인)

- `src/lib/services/domain/word/`, `docs/` — 완료
- `src/lib/services/application/word/`, `docs/` — 완료
- `src/lib/services/infrastructure/supabase/SupabaseWordRepository.ts` 외 5개 — 완료
- `src/lib/services/WordServiceContainer.ts` — 완료 (`SupabaseUserContributionUpdater` 인라인 포함)
- `src/lib/services/DocsServiceContainer.ts` — 완료
- 테스트 8개 파일 완료

**Phase 3에서 신규 생성 파일 (17개):**

| 레이어 | 파일 | 역할 |
|--------|------|------|
| Domain | `domain/user/UserEntity.ts` | UserEntity, StarredDocsItem, MonthlyContribution 타입 |
| Domain | `domain/user/UserRepository.ts` | IUserRepository 인터페이스 |
| Domain | `domain/user/index.ts` | export barrel |
| Domain | `domain/notification/NotificationEntity.ts` | NotificationEntity, NewNotification, UpdateNotification 타입 |
| Domain | `domain/notification/NotificationRepository.ts` | INotificationRepository, IStorageRepository 인터페이스 |
| Domain | `domain/notification/index.ts` | export barrel |
| Domain | `domain/auth/AuthRepository.ts` | IAuthRepository 인터페이스 |
| Domain | `domain/auth/index.ts` | export barrel |
| Application | `application/user/UserService.ts` | User 조회·명령 유즈케이스 |
| Application | `application/user/index.ts` | export barrel |
| Application | `application/notification/NotificationService.ts` | Notification CRUD + Storage |
| Application | `application/notification/index.ts` | export barrel |
| Application | `application/auth/AuthService.ts` | Auth 래퍼 |
| Application | `application/auth/index.ts` | export barrel |
| Infrastructure | `infrastructure/supabase/SupabaseUserRepository.ts` | IUserRepository Supabase 구현 |
| Infrastructure | `infrastructure/supabase/SupabaseNotificationRepository.ts` | INotificationRepository Supabase 구현 |
| Infrastructure | `infrastructure/supabase/SupabaseStorageRepository.ts` | IStorageRepository Supabase 구현 |
| Infrastructure | `infrastructure/supabase/SupabaseAuthRepository.ts` | IAuthRepository Supabase 구현 |
| Container | `UserServiceContainer.ts` | User 도메인 서비스 컨테이너 |
| Container | `NotificationServiceContainer.ts` | Notification 도메인 서비스 컨테이너 |
| Container | `AuthServiceContainer.ts` | Auth 도메인 서비스 컨테이너 |

**수정 파일 (2개):**
- `domain/errors.ts` — `userNotFoundError`, `notificationNotFoundError` 추가
- `WordServiceContainer.ts` — `SupabaseUserContributionUpdater` → `UserService` 교체

**테스트 파일 (3개):**
- `src/__tests__/lib/services/application/user/UserService.test.ts`
- `src/__tests__/lib/services/application/notification/NotificationService.test.ts`
- `src/__tests__/lib/services/application/auth/AuthService.test.ts`

---

## Task 1: User 도메인 타입 + Repository 인터페이스 정의

**Files:**
- Create: `src/lib/services/domain/user/UserEntity.ts`
- Create: `src/lib/services/domain/user/UserRepository.ts`
- Create: `src/lib/services/domain/user/index.ts`

- [ ] **Step 1: `UserEntity.ts` 작성**

```ts
// src/lib/services/domain/user/UserEntity.ts

export type RoleLevel = 'r1' | 'r2' | 'r3' | 'r4' | 'admin';
export type UserSortField = 'contribution' | 'month_contribution' | 'nickname';

export interface UserEntity {
    id: string;
    nickname: string;
    role: RoleLevel;
    contribution: number;
    monthContribution: number;
}

export interface UserStarredDocs {
    userId: string;
    docsId: number;
    createdAt: string;
    docs: { id: number; name: string; typez: string };
}

export interface UserMonthlyContribution {
    id: number;
    userId: string;
    month: string;
    contribution: number;
}

export interface UserWaitWordRequest {
    id: number;
    word: string;
    requestType: 'add' | 'delete';
    requestedAt: string;
}

export interface UserWordLog {
    id: number;
    word: string;
    rType: 'add' | 'delete';
    state: 'approved' | 'rejected' | 'pending';
    createdAt: string;
}
```

- [ ] **Step 2: `UserRepository.ts` 작성**

```ts
// src/lib/services/domain/user/UserRepository.ts
import type { Result, CustomError } from '../result';
import type {
    UserEntity,
    UserSortField,
    UserStarredDocs,
    UserMonthlyContribution,
    UserWaitWordRequest,
    UserWordLog,
} from './UserEntity';

export interface IUserRepository {
    findById(userId: string): Promise<Result<UserEntity | null, CustomError>>;
    findByNickname(nickname: string): Promise<Result<UserEntity | null, CustomError>>;
    findByNicknameExact(nickname: string): Promise<Result<UserEntity[], CustomError>>;
    searchByNickname(query: string): Promise<Result<UserEntity[], CustomError>>;
    findAll(sort?: { field: UserSortField; ascending: boolean }): Promise<Result<UserEntity[], CustomError>>;
    findMonthlyRank(userId: string): Promise<Result<number, CustomError>>;
    findMonthlyContributions(userId: string): Promise<Result<UserMonthlyContribution[], CustomError>>;
    findStarredDocs(userId: string): Promise<Result<UserStarredDocs[], CustomError>>;
    findWaitWordRequests(userId: string): Promise<Result<UserWaitWordRequest[], CustomError>>;
    findWordLogs(userId: string): Promise<Result<UserWordLog[], CustomError>>;
    incrementContribution(userId: string, amount?: number): Promise<Result<void, CustomError>>;
    addStarDocs(userId: string, docsId: number): Promise<Result<void, CustomError>>;
    removeStarDocs(userId: string, docsId: number): Promise<Result<void, CustomError>>;
    setNickname(nickname: string): Promise<Result<void, CustomError>>;
}
```

- [ ] **Step 3: `domain/user/index.ts` 작성**

```ts
// src/lib/services/domain/user/index.ts
export type {
    RoleLevel,
    UserSortField,
    UserEntity,
    UserStarredDocs,
    UserMonthlyContribution,
    UserWaitWordRequest,
    UserWordLog,
} from './UserEntity';
export type { IUserRepository } from './UserRepository';
```

- [ ] **Step 4: 커밋**

```bash
git add src/lib/services/domain/user/
git commit -m "feat: user 도메인 엔티티 및 Repository 인터페이스 정의"
```

---

## Task 2: Notification 도메인 타입 + Repository 인터페이스 정의

**Files:**
- Create: `src/lib/services/domain/notification/NotificationEntity.ts`
- Create: `src/lib/services/domain/notification/NotificationRepository.ts`
- Create: `src/lib/services/domain/notification/index.ts`

- [ ] **Step 1: `NotificationEntity.ts` 작성**

```ts
// src/lib/services/domain/notification/NotificationEntity.ts

export interface NotificationEntity {
    id: number;
    title: string;
    body: string;
    img: string | null;
    endAt: string;
    isImportant: boolean;
    isModal: boolean;
    createdAt: string;
}

export interface NewNotification {
    title: string;
    body: string;
    img?: string | null;
    endAt: string;
    isImportant?: boolean;
    isModal?: boolean;
}

export interface UpdateNotification {
    title?: string;
    body?: string;
    img?: string | null;
    endAt: string;
    isImportant?: boolean;
    isModal?: boolean;
}
```

- [ ] **Step 2: `NotificationRepository.ts` 작성**

```ts
// src/lib/services/domain/notification/NotificationRepository.ts
import type { Result, CustomError } from '../result';
import type { NotificationEntity, NewNotification, UpdateNotification } from './NotificationEntity';

export interface INotificationRepository {
    findAll(): Promise<Result<NotificationEntity[], CustomError>>;
    findById(id: number): Promise<Result<NotificationEntity | null, CustomError>>;
    findActiveModal(): Promise<Result<NotificationEntity | null, CustomError>>;
    save(data: NewNotification): Promise<Result<NotificationEntity, CustomError>>;
    update(id: number, data: UpdateNotification): Promise<Result<NotificationEntity, CustomError>>;
    deleteById(id: number): Promise<Result<void, CustomError>>;
}

export interface IStorageRepository {
    uploadImage(file: File, path: string): Promise<Result<string, CustomError>>;
    deleteImage(path: string): Promise<Result<void, CustomError>>;
    getPublicUrl(path: string): string;
}
```

- [ ] **Step 3: `domain/notification/index.ts` 작성**

```ts
// src/lib/services/domain/notification/index.ts
export type {
    NotificationEntity,
    NewNotification,
    UpdateNotification,
} from './NotificationEntity';
export type { INotificationRepository, IStorageRepository } from './NotificationRepository';
```

- [ ] **Step 4: 커밋**

```bash
git add src/lib/services/domain/notification/
git commit -m "feat: notification 도메인 엔티티 및 Repository 인터페이스 정의"
```

---

## Task 3: Auth Repository 인터페이스 정의

**Files:**
- Create: `src/lib/services/domain/auth/AuthRepository.ts`
- Create: `src/lib/services/domain/auth/index.ts`

- [ ] **Step 1: `AuthRepository.ts` 작성**

```ts
// src/lib/services/domain/auth/AuthRepository.ts
import type { Session } from '@supabase/supabase-js';
import type { Result, CustomError } from '../result';

export interface IAuthRepository {
    getSession(): Promise<Result<Session | null, CustomError>>;
    getJWT(): Promise<Result<string | null, CustomError>>;
    loginByGoogle(originUrl: string): Promise<Result<void, CustomError>>;
    logout(): Promise<Result<void, CustomError>>;
    onAuthStateChange(
        callback: (session: Session | null) => Promise<void>
    ): { unsubscribe: () => void };
}
```

- [ ] **Step 2: `domain/auth/index.ts` 작성**

```ts
// src/lib/services/domain/auth/index.ts
export type { IAuthRepository } from './AuthRepository';
```

- [ ] **Step 3: 커밋**

```bash
git add src/lib/services/domain/auth/
git commit -m "feat: auth 도메인 Repository 인터페이스 정의"
```

---

## Task 4: domain/errors.ts에 Phase 3 에러 추가

**Files:**
- Modify: `src/lib/services/domain/errors.ts`

- [ ] **Step 1: 두 에러 함수 추가**

`src/lib/services/domain/errors.ts` 파일 끝에 추가:

```ts
/**
 * 사용자를 찾을 수 없을 때 발생하는 에러
 *
 * @param identifier - 사용자 식별자 (ID 또는 닉네임)
 * @returns CustomError
 */
export function userNotFoundError(identifier: string): CustomError {
    return createDomainError(
        'UserNotFoundError',
        `사용자 '${identifier}'를 찾을 수 없습니다.`,
        404,
        { code: 'USER_NOT_FOUND' }
    );
}

/**
 * 공지을 찾을 수 없을 때 발생하는 에러
 *
 * @param id - 공지 ID
 * @returns CustomError
 */
export function notificationNotFoundError(id: number): CustomError {
    return createDomainError(
        'NotificationNotFoundError',
        `공지 '${id}'를 찾을 수 없습니다.`,
        404,
        { code: 'NOTIFICATION_NOT_FOUND' }
    );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/services/domain/errors.ts
git commit -m "feat: user, notification 도메인 에러 타입 추가"
```

---

## Task 5: UserService 실패 테스트 작성

**Files:**
- Create: `src/__tests__/lib/services/application/user/UserService.test.ts`

- [ ] **Step 1: 테스트 파일 작성**

```ts
// src/__tests__/lib/services/application/user/UserService.test.ts
import { UserService } from '@/src/lib/services/application/user/UserService';
import type { IUserRepository } from '@/src/lib/services/domain/user/UserRepository';
import type { UserEntity, UserStarredDocs, UserMonthlyContribution, UserWaitWordRequest, UserWordLog } from '@/src/lib/services/domain/user/UserEntity';
import { success, failure } from '@/src/lib/services/domain/result';
import { userNotFoundError, infrastructureError } from '@/src/lib/services/domain/errors';

const mockUser: UserEntity = {
    id: 'user-1',
    nickname: 'tester',
    role: 'r1',
    contribution: 10,
    monthContribution: 5,
};

const mockStarredDocs: UserStarredDocs[] = [
    { userId: 'user-1', docsId: 1, createdAt: '2024-01-01', docs: { id: 1, name: '가', typez: 'letter' } },
];

const mockMonthlyContributions: UserMonthlyContribution[] = [
    { id: 1, userId: 'user-1', month: '2024-01', contribution: 5 },
];

const mockWaitWordRequests: UserWaitWordRequest[] = [
    { id: 1, word: '사과', requestType: 'add', requestedAt: '2024-01-01' },
];

const mockWordLogs: UserWordLog[] = [
    { id: 1, word: '사과', rType: 'add', state: 'approved', createdAt: '2024-01-01' },
];

function makeMockRepo(overrides: Partial<IUserRepository> = {}): IUserRepository {
    return {
        findById: jest.fn().mockResolvedValue(success(mockUser)),
        findByNickname: jest.fn().mockResolvedValue(success(mockUser)),
        findByNicknameExact: jest.fn().mockResolvedValue(success([mockUser])),
        searchByNickname: jest.fn().mockResolvedValue(success([mockUser])),
        findAll: jest.fn().mockResolvedValue(success([mockUser])),
        findMonthlyRank: jest.fn().mockResolvedValue(success(1)),
        findMonthlyContributions: jest.fn().mockResolvedValue(success(mockMonthlyContributions)),
        findStarredDocs: jest.fn().mockResolvedValue(success(mockStarredDocs)),
        findWaitWordRequests: jest.fn().mockResolvedValue(success(mockWaitWordRequests)),
        findWordLogs: jest.fn().mockResolvedValue(success(mockWordLogs)),
        incrementContribution: jest.fn().mockResolvedValue(success(undefined)),
        addStarDocs: jest.fn().mockResolvedValue(success(undefined)),
        removeStarDocs: jest.fn().mockResolvedValue(success(undefined)),
        setNickname: jest.fn().mockResolvedValue(success(undefined)),
        ...overrides,
    };
}

describe('UserService', () => {
    describe('getUserById', () => {
        it('존재하는 유저를 반환한다', async () => {
            const service = new UserService(makeMockRepo());
            const result = await service.getUserById('user-1');
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toEqual(mockUser);
        });

        it('유저가 없으면 null을 반환한다', async () => {
            const repo = makeMockRepo({ findById: jest.fn().mockResolvedValue(success(null)) });
            const service = new UserService(repo);
            const result = await service.getUserById('unknown');
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toBeNull();
        });

        it('인프라 에러를 그대로 전달한다', async () => {
            const err = infrastructureError({ message: 'DB error' });
            const repo = makeMockRepo({ findById: jest.fn().mockResolvedValue(failure(err)) });
            const service = new UserService(repo);
            const result = await service.getUserById('user-1');
            expect(result.success).toBe(false);
        });
    });

    describe('getUserByNickname', () => {
        it('존재하는 유저를 반환한다', async () => {
            const service = new UserService(makeMockRepo());
            const result = await service.getUserByNickname('tester');
            expect(result.success).toBe(true);
            if (result.success) expect(result.data?.nickname).toBe('tester');
        });
    });

    describe('getAllUsers', () => {
        it('정렬 없이 전체 유저를 반환한다', async () => {
            const service = new UserService(makeMockRepo());
            const result = await service.getAllUsers();
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toHaveLength(1);
        });

        it('정렬 옵션을 repository에 전달한다', async () => {
            const repo = makeMockRepo();
            const service = new UserService(repo);
            await service.getAllUsers({ field: 'contribution', ascending: false });
            expect(repo.findAll).toHaveBeenCalledWith({ field: 'contribution', ascending: false });
        });
    });

    describe('incrementContribution', () => {
        it('기여도 1 증가', async () => {
            const repo = makeMockRepo();
            const service = new UserService(repo);
            const result = await service.incrementContribution('user-1');
            expect(result.success).toBe(true);
            expect(repo.incrementContribution).toHaveBeenCalledWith('user-1', 1);
        });

        it('기여도 커스텀 amount 증가', async () => {
            const repo = makeMockRepo();
            const service = new UserService(repo);
            await service.incrementContribution('user-1', 5);
            expect(repo.incrementContribution).toHaveBeenCalledWith('user-1', 5);
        });
    });

    describe('addStarDocs / removeStarDocs', () => {
        it('별표 추가 성공', async () => {
            const repo = makeMockRepo();
            const service = new UserService(repo);
            const result = await service.addStarDocs('user-1', 1);
            expect(result.success).toBe(true);
            expect(repo.addStarDocs).toHaveBeenCalledWith('user-1', 1);
        });

        it('별표 제거 성공', async () => {
            const repo = makeMockRepo();
            const service = new UserService(repo);
            const result = await service.removeStarDocs('user-1', 1);
            expect(result.success).toBe(true);
            expect(repo.removeStarDocs).toHaveBeenCalledWith('user-1', 1);
        });
    });

    describe('getUserStarredDocs', () => {
        it('별표한 단어장 목록 반환', async () => {
            const service = new UserService(makeMockRepo());
            const result = await service.getUserStarredDocs('user-1');
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toHaveLength(1);
        });
    });

    describe('setNickname', () => {
        it('닉네임 설정 성공', async () => {
            const repo = makeMockRepo();
            const service = new UserService(repo);
            const result = await service.setNickname('newName');
            expect(result.success).toBe(true);
            expect(repo.setNickname).toHaveBeenCalledWith('newName');
        });
    });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx jest src/__tests__/lib/services/application/user/UserService.test.ts --no-coverage
```

Expected: `FAIL` — `Cannot find module '@/src/lib/services/application/user/UserService'`

---

## Task 6: UserService 구현

**Files:**
- Create: `src/lib/services/application/user/UserService.ts`
- Create: `src/lib/services/application/user/index.ts`

- [ ] **Step 1: `UserService.ts` 작성**

```ts
// src/lib/services/application/user/UserService.ts
import type { IUserRepository } from '../../domain/user/UserRepository';
import type { Result, CustomError } from '../../domain/result';
import type {
    UserEntity,
    UserSortField,
    UserStarredDocs,
    UserMonthlyContribution,
    UserWaitWordRequest,
    UserWordLog,
} from '../../domain/user/UserEntity';

export class UserService {
    constructor(private readonly userRepo: IUserRepository) {}

    async getUserById(userId: string): Promise<Result<UserEntity | null, CustomError>> {
        return this.userRepo.findById(userId);
    }

    async getUserByNickname(nickname: string): Promise<Result<UserEntity | null, CustomError>> {
        return this.userRepo.findByNickname(nickname);
    }

    async getUsersByNicknameExact(nickname: string): Promise<Result<UserEntity[], CustomError>> {
        return this.userRepo.findByNicknameExact(nickname);
    }

    async searchUsersByNickname(query: string): Promise<Result<UserEntity[], CustomError>> {
        return this.userRepo.searchByNickname(query);
    }

    async getAllUsers(
        sort?: { field: UserSortField; ascending: boolean }
    ): Promise<Result<UserEntity[], CustomError>> {
        return this.userRepo.findAll(sort);
    }

    async getUserMonthlyRank(userId: string): Promise<Result<number, CustomError>> {
        return this.userRepo.findMonthlyRank(userId);
    }

    async getUserMonthlyContributions(
        userId: string
    ): Promise<Result<UserMonthlyContribution[], CustomError>> {
        return this.userRepo.findMonthlyContributions(userId);
    }

    async getUserStarredDocs(userId: string): Promise<Result<UserStarredDocs[], CustomError>> {
        return this.userRepo.findStarredDocs(userId);
    }

    async getUserWaitWordRequests(
        userId: string
    ): Promise<Result<UserWaitWordRequest[], CustomError>> {
        return this.userRepo.findWaitWordRequests(userId);
    }

    async getUserWordLogs(userId: string): Promise<Result<UserWordLog[], CustomError>> {
        return this.userRepo.findWordLogs(userId);
    }

    async incrementContribution(
        userId: string,
        amount: number = 1
    ): Promise<Result<void, CustomError>> {
        return this.userRepo.incrementContribution(userId, amount);
    }

    async addStarDocs(userId: string, docsId: number): Promise<Result<void, CustomError>> {
        return this.userRepo.addStarDocs(userId, docsId);
    }

    async removeStarDocs(userId: string, docsId: number): Promise<Result<void, CustomError>> {
        return this.userRepo.removeStarDocs(userId, docsId);
    }

    async setNickname(nickname: string): Promise<Result<void, CustomError>> {
        return this.userRepo.setNickname(nickname);
    }
}
```

- [ ] **Step 2: `application/user/index.ts` 작성**

```ts
// src/lib/services/application/user/index.ts
export { UserService } from './UserService';
```

- [ ] **Step 3: 테스트 실행 — 통과 확인**

```bash
npx jest src/__tests__/lib/services/application/user/UserService.test.ts --no-coverage
```

Expected: `PASS` — 모든 테스트 통과

- [ ] **Step 4: 커밋**

```bash
git add src/lib/services/application/user/ src/__tests__/lib/services/application/user/
git commit -m "feat: UserService 구현 및 단위 테스트 추가"
```

---

## Task 7: NotificationService 실패 테스트 작성

**Files:**
- Create: `src/__tests__/lib/services/application/notification/NotificationService.test.ts`

- [ ] **Step 1: 테스트 파일 작성**

```ts
// src/__tests__/lib/services/application/notification/NotificationService.test.ts
import { NotificationService } from '@/src/lib/services/application/notification/NotificationService';
import type { INotificationRepository, IStorageRepository } from '@/src/lib/services/domain/notification/NotificationRepository';
import type { NotificationEntity, NewNotification, UpdateNotification } from '@/src/lib/services/domain/notification/NotificationEntity';
import { success, failure } from '@/src/lib/services/domain/result';
import { notificationNotFoundError, infrastructureError } from '@/src/lib/services/domain/errors';

const mockNotification: NotificationEntity = {
    id: 1,
    title: '공지',
    body: '내용입니다',
    img: null,
    endAt: '2099-12-31',
    isImportant: false,
    isModal: true,
    createdAt: '2024-01-01',
};

function makeMockNotificationRepo(
    overrides: Partial<INotificationRepository> = {}
): INotificationRepository {
    return {
        findAll: jest.fn().mockResolvedValue(success([mockNotification])),
        findById: jest.fn().mockResolvedValue(success(mockNotification)),
        findActiveModal: jest.fn().mockResolvedValue(success(mockNotification)),
        save: jest.fn().mockResolvedValue(success(mockNotification)),
        update: jest.fn().mockResolvedValue(success(mockNotification)),
        deleteById: jest.fn().mockResolvedValue(success(undefined)),
        ...overrides,
    };
}

function makeMockStorageRepo(overrides: Partial<IStorageRepository> = {}): IStorageRepository {
    return {
        uploadImage: jest.fn().mockResolvedValue(success('https://example.com/img.png')),
        deleteImage: jest.fn().mockResolvedValue(success(undefined)),
        getPublicUrl: jest.fn().mockReturnValue('https://example.com/img.png'),
        ...overrides,
    };
}

describe('NotificationService', () => {
    describe('getActiveModal', () => {
        it('활성 모달 공지 반환', async () => {
            const service = new NotificationService(makeMockNotificationRepo(), makeMockStorageRepo());
            const result = await service.getActiveModal();
            expect(result.success).toBe(true);
            if (result.success) expect(result.data?.isModal).toBe(true);
        });

        it('활성 공지 없으면 null 반환', async () => {
            const repo = makeMockNotificationRepo({ findActiveModal: jest.fn().mockResolvedValue(success(null)) });
            const service = new NotificationService(repo, makeMockStorageRepo());
            const result = await service.getActiveModal();
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toBeNull();
        });
    });

    describe('getAll', () => {
        it('전체 공지 목록 반환', async () => {
            const service = new NotificationService(makeMockNotificationRepo(), makeMockStorageRepo());
            const result = await service.getAll();
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toHaveLength(1);
        });
    });

    describe('getById', () => {
        it('ID로 공지 반환', async () => {
            const service = new NotificationService(makeMockNotificationRepo(), makeMockStorageRepo());
            const result = await service.getById(1);
            expect(result.success).toBe(true);
            if (result.success) expect(result.data?.id).toBe(1);
        });

        it('존재하지 않는 공지는 null 반환', async () => {
            const repo = makeMockNotificationRepo({ findById: jest.fn().mockResolvedValue(success(null)) });
            const service = new NotificationService(repo, makeMockStorageRepo());
            const result = await service.getById(999);
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toBeNull();
        });
    });

    describe('create', () => {
        it('새 공지 생성 성공', async () => {
            const repo = makeMockNotificationRepo();
            const service = new NotificationService(repo, makeMockStorageRepo());
            const newNotif: NewNotification = { title: '공지', body: '내용', endAt: '2099-12-31' };
            const result = await service.create(newNotif);
            expect(result.success).toBe(true);
            expect(repo.save).toHaveBeenCalledWith(newNotif);
        });
    });

    describe('update', () => {
        it('공지 수정 성공', async () => {
            const repo = makeMockNotificationRepo();
            const service = new NotificationService(repo, makeMockStorageRepo());
            const updateData: UpdateNotification = { title: '변경', endAt: '2099-12-31' };
            const result = await service.update(1, updateData);
            expect(result.success).toBe(true);
            expect(repo.update).toHaveBeenCalledWith(1, updateData);
        });

        it('인프라 에러 전달', async () => {
            const err = infrastructureError({ message: 'DB error' });
            const repo = makeMockNotificationRepo({ update: jest.fn().mockResolvedValue(failure(err)) });
            const service = new NotificationService(repo, makeMockStorageRepo());
            const result = await service.update(1, { endAt: '2099-12-31' });
            expect(result.success).toBe(false);
        });
    });

    describe('deleteById', () => {
        it('공지 삭제 성공', async () => {
            const repo = makeMockNotificationRepo();
            const service = new NotificationService(repo, makeMockStorageRepo());
            const result = await service.deleteById(1);
            expect(result.success).toBe(true);
            expect(repo.deleteById).toHaveBeenCalledWith(1);
        });
    });

    describe('uploadImage', () => {
        it('이미지 업로드 성공 — URL 반환', async () => {
            const storageRepo = makeMockStorageRepo();
            const service = new NotificationService(makeMockNotificationRepo(), storageRepo);
            const file = new File(['content'], 'test.png', { type: 'image/png' });
            const result = await service.uploadImage(file, 'notifications/test.png');
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toBe('https://example.com/img.png');
        });
    });

    describe('deleteImage', () => {
        it('이미지 삭제 성공', async () => {
            const storageRepo = makeMockStorageRepo();
            const service = new NotificationService(makeMockNotificationRepo(), storageRepo);
            const result = await service.deleteImage('notifications/test.png');
            expect(result.success).toBe(true);
        });
    });

    describe('getPublicUrl', () => {
        it('공개 URL 반환', () => {
            const storageRepo = makeMockStorageRepo();
            const service = new NotificationService(makeMockNotificationRepo(), storageRepo);
            const url = service.getPublicUrl('notifications/test.png');
            expect(url).toBe('https://example.com/img.png');
        });
    });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx jest src/__tests__/lib/services/application/notification/NotificationService.test.ts --no-coverage
```

Expected: `FAIL` — `Cannot find module '@/src/lib/services/application/notification/NotificationService'`

---

## Task 8: NotificationService 구현

**Files:**
- Create: `src/lib/services/application/notification/NotificationService.ts`
- Create: `src/lib/services/application/notification/index.ts`

- [ ] **Step 1: `NotificationService.ts` 작성**

```ts
// src/lib/services/application/notification/NotificationService.ts
import type { INotificationRepository, IStorageRepository } from '../../domain/notification/NotificationRepository';
import type { Result, CustomError } from '../../domain/result';
import type { NotificationEntity, NewNotification, UpdateNotification } from '../../domain/notification/NotificationEntity';

export class NotificationService {
    constructor(
        private readonly notificationRepo: INotificationRepository,
        private readonly storageRepo: IStorageRepository,
    ) {}

    async getActiveModal(): Promise<Result<NotificationEntity | null, CustomError>> {
        return this.notificationRepo.findActiveModal();
    }

    async getAll(): Promise<Result<NotificationEntity[], CustomError>> {
        return this.notificationRepo.findAll();
    }

    async getById(id: number): Promise<Result<NotificationEntity | null, CustomError>> {
        return this.notificationRepo.findById(id);
    }

    async create(data: NewNotification): Promise<Result<NotificationEntity, CustomError>> {
        return this.notificationRepo.save(data);
    }

    async update(id: number, data: UpdateNotification): Promise<Result<NotificationEntity, CustomError>> {
        return this.notificationRepo.update(id, data);
    }

    async deleteById(id: number): Promise<Result<void, CustomError>> {
        return this.notificationRepo.deleteById(id);
    }

    async uploadImage(file: File, path: string): Promise<Result<string, CustomError>> {
        return this.storageRepo.uploadImage(file, path);
    }

    async deleteImage(path: string): Promise<Result<void, CustomError>> {
        return this.storageRepo.deleteImage(path);
    }

    getPublicUrl(path: string): string {
        return this.storageRepo.getPublicUrl(path);
    }
}
```

- [ ] **Step 2: `application/notification/index.ts` 작성**

```ts
// src/lib/services/application/notification/index.ts
export { NotificationService } from './NotificationService';
```

- [ ] **Step 3: 테스트 실행 — 통과 확인**

```bash
npx jest src/__tests__/lib/services/application/notification/NotificationService.test.ts --no-coverage
```

Expected: `PASS`

- [ ] **Step 4: 커밋**

```bash
git add src/lib/services/application/notification/ src/__tests__/lib/services/application/notification/
git commit -m "feat: NotificationService 구현 및 단위 테스트 추가"
```

---

## Task 9: AuthService 실패 테스트 작성

**Files:**
- Create: `src/__tests__/lib/services/application/auth/AuthService.test.ts`

- [ ] **Step 1: 테스트 파일 작성**

```ts
// src/__tests__/lib/services/application/auth/AuthService.test.ts
import { AuthService } from '@/src/lib/services/application/auth/AuthService';
import type { IAuthRepository } from '@/src/lib/services/domain/auth/AuthRepository';
import { success, failure } from '@/src/lib/services/domain/result';
import { infrastructureError } from '@/src/lib/services/domain/errors';
import type { Session } from '@supabase/supabase-js';

const mockSession = { access_token: 'test-token' } as Session;

function makeMockAuthRepo(overrides: Partial<IAuthRepository> = {}): IAuthRepository {
    return {
        getSession: jest.fn().mockResolvedValue(success(mockSession)),
        getJWT: jest.fn().mockResolvedValue(success('test-token')),
        loginByGoogle: jest.fn().mockResolvedValue(success(undefined)),
        logout: jest.fn().mockResolvedValue(success(undefined)),
        onAuthStateChange: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
        ...overrides,
    };
}

describe('AuthService', () => {
    describe('getSession', () => {
        it('세션 반환', async () => {
            const service = new AuthService(makeMockAuthRepo());
            const result = await service.getSession();
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toEqual(mockSession);
        });

        it('세션 없으면 null 반환', async () => {
            const repo = makeMockAuthRepo({ getSession: jest.fn().mockResolvedValue(success(null)) });
            const service = new AuthService(repo);
            const result = await service.getSession();
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toBeNull();
        });
    });

    describe('getJWT', () => {
        it('JWT 토큰 반환', async () => {
            const service = new AuthService(makeMockAuthRepo());
            const result = await service.getJWT();
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toBe('test-token');
        });

        it('세션 없으면 null 반환', async () => {
            const repo = makeMockAuthRepo({ getJWT: jest.fn().mockResolvedValue(success(null)) });
            const service = new AuthService(repo);
            const result = await service.getJWT();
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toBeNull();
        });
    });

    describe('loginByGoogle', () => {
        it('구글 로그인 성공', async () => {
            const repo = makeMockAuthRepo();
            const service = new AuthService(repo);
            const result = await service.loginByGoogle('https://example.com');
            expect(result.success).toBe(true);
            expect(repo.loginByGoogle).toHaveBeenCalledWith('https://example.com');
        });

        it('로그인 실패 시 에러 반환', async () => {
            const err = infrastructureError({ message: 'OAuth error' });
            const repo = makeMockAuthRepo({ loginByGoogle: jest.fn().mockResolvedValue(failure(err)) });
            const service = new AuthService(repo);
            const result = await service.loginByGoogle('https://example.com');
            expect(result.success).toBe(false);
        });
    });

    describe('logout', () => {
        it('로그아웃 성공', async () => {
            const repo = makeMockAuthRepo();
            const service = new AuthService(repo);
            const result = await service.logout();
            expect(result.success).toBe(true);
            expect(repo.logout).toHaveBeenCalled();
        });
    });

    describe('onAuthStateChange', () => {
        it('구독 객체 반환', () => {
            const repo = makeMockAuthRepo();
            const service = new AuthService(repo);
            const callback = jest.fn();
            const sub = service.onAuthStateChange(callback);
            expect(sub).toHaveProperty('unsubscribe');
            expect(repo.onAuthStateChange).toHaveBeenCalledWith(callback);
        });
    });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx jest src/__tests__/lib/services/application/auth/AuthService.test.ts --no-coverage
```

Expected: `FAIL` — `Cannot find module '@/src/lib/services/application/auth/AuthService'`

---

## Task 10: AuthService 구현

**Files:**
- Create: `src/lib/services/application/auth/AuthService.ts`
- Create: `src/lib/services/application/auth/index.ts`

- [ ] **Step 1: `AuthService.ts` 작성**

```ts
// src/lib/services/application/auth/AuthService.ts
import type { Session } from '@supabase/supabase-js';
import type { IAuthRepository } from '../../domain/auth/AuthRepository';
import type { Result, CustomError } from '../../domain/result';

export class AuthService {
    constructor(private readonly authRepo: IAuthRepository) {}

    async getSession(): Promise<Result<Session | null, CustomError>> {
        return this.authRepo.getSession();
    }

    async getJWT(): Promise<Result<string | null, CustomError>> {
        return this.authRepo.getJWT();
    }

    async loginByGoogle(originUrl: string): Promise<Result<void, CustomError>> {
        return this.authRepo.loginByGoogle(originUrl);
    }

    async logout(): Promise<Result<void, CustomError>> {
        return this.authRepo.logout();
    }

    onAuthStateChange(
        callback: (session: Session | null) => Promise<void>
    ): { unsubscribe: () => void } {
        return this.authRepo.onAuthStateChange(callback);
    }
}
```

- [ ] **Step 2: `application/auth/index.ts` 작성**

```ts
// src/lib/services/application/auth/index.ts
export { AuthService } from './AuthService';
```

- [ ] **Step 3: 테스트 실행 — 통과 확인**

```bash
npx jest src/__tests__/lib/services/application/auth/AuthService.test.ts --no-coverage
```

Expected: `PASS`

- [ ] **Step 4: 커밋**

```bash
git add src/lib/services/application/auth/ src/__tests__/lib/services/application/auth/
git commit -m "feat: AuthService 구현 및 단위 테스트 추가"
```

---

## Task 11: SupabaseUserRepository 구현

**Files:**
- Create: `src/lib/services/infrastructure/supabase/SupabaseUserRepository.ts`

SCM에서 이관하는 메서드: `userById`, `userByNickname`, `usersByNickname`, `usersLikeByNickname`, `monthlyConRankByUserId`, `monthlyContributionsByUserId`, `starredDocsById`, `requestsListById`, `logsListById`, `allUser`, `userContribution`, `starDocs(add)`, `startDocs(delete)`, `nickname(setNickname)`

- [ ] **Step 1: `SupabaseUserRepository.ts` 작성**

```ts
// src/lib/services/infrastructure/supabase/SupabaseUserRepository.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import type { IUserRepository } from '../../domain/user/UserRepository';
import type { Result, CustomError } from '../../domain/result';
import type {
    UserEntity,
    UserSortField,
    UserStarredDocs,
    UserMonthlyContribution,
    UserWaitWordRequest,
    UserWordLog,
} from '../../domain/user/UserEntity';
import { success, failure } from '../../domain/result';
import { infrastructureError } from '../../domain/errors';
import axios from 'axios';

type UserRow = Database['public']['Tables']['users']['Row'];

function toUserEntity(row: UserRow): UserEntity {
    return {
        id: row.id,
        nickname: row.nickname,
        role: row.role,
        contribution: row.contribution,
        monthContribution: row.month_contribution,
    };
}

export class SupabaseUserRepository implements IUserRepository {
    constructor(private readonly supabase: SupabaseClient<Database>) {}

    async findById(userId: string): Promise<Result<UserEntity | null, CustomError>> {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
        if (error) return failure(infrastructureError(error));
        return success(data ? toUserEntity(data) : null);
    }

    async findByNickname(nickname: string): Promise<Result<UserEntity | null, CustomError>> {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .eq('nickname', nickname)
            .maybeSingle();
        if (error) return failure(infrastructureError(error));
        return success(data ? toUserEntity(data) : null);
    }

    async findByNicknameExact(nickname: string): Promise<Result<UserEntity[], CustomError>> {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .eq('nickname', nickname.trim());
        if (error) return failure(infrastructureError(error));
        return success((data ?? []).map(toUserEntity));
    }

    async searchByNickname(query: string): Promise<Result<UserEntity[], CustomError>> {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .ilike('nickname', `%${query}%`);
        if (error) return failure(infrastructureError(error));
        return success((data ?? []).map(toUserEntity));
    }

    async findAll(
        sort: { field: UserSortField; ascending: boolean } = { field: 'contribution', ascending: false }
    ): Promise<Result<UserEntity[], CustomError>> {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .order(sort.field, { ascending: sort.ascending });
        if (error) return failure(infrastructureError(error));
        return success((data ?? []).map(toUserEntity));
    }

    async findMonthlyRank(userId: string): Promise<Result<number, CustomError>> {
        const { data, error } = await this.supabase.rpc('get_user_monthly_rank', { uid: userId });
        if (error) return failure(infrastructureError(error));
        return success(data ?? 0);
    }

    async findMonthlyContributions(
        userId: string
    ): Promise<Result<UserMonthlyContribution[], CustomError>> {
        const { data, error } = await this.supabase
            .from('user_month_contributions')
            .select('*')
            .eq('user_id', userId)
            .limit(4);
        if (error) return failure(infrastructureError(error));
        return success(
            (data ?? []).map((row) => ({
                id: row.id,
                userId: row.user_id,
                month: row.month,
                contribution: row.contribution,
            }))
        );
    }

    async findStarredDocs(userId: string): Promise<Result<UserStarredDocs[], CustomError>> {
        const { data, error } = await this.supabase
            .from('user_star_docs')
            .select('*, docs(*)')
            .eq('user_id', userId);
        if (error) return failure(infrastructureError(error));
        return success(
            (data ?? []).map((row) => ({
                userId: row.user_id,
                docsId: row.docs_id,
                createdAt: row.created_at,
                docs: {
                    id: row.docs.id,
                    name: row.docs.name,
                    typez: row.docs.typez,
                },
            }))
        );
    }

    async findWaitWordRequests(
        userId: string
    ): Promise<Result<UserWaitWordRequest[], CustomError>> {
        const { data, error } = await this.supabase
            .from('wait_words')
            .select('*')
            .eq('requested_by', userId)
            .order('requested_at', { ascending: false })
            .limit(30);
        if (error) return failure(infrastructureError(error));
        return success(
            (data ?? []).map((row) => ({
                id: row.id,
                word: row.word,
                requestType: row.request_type,
                requestedAt: row.requested_at,
            }))
        );
    }

    async findWordLogs(userId: string): Promise<Result<UserWordLog[], CustomError>> {
        const { data, error } = await this.supabase
            .from('logs')
            .select('*')
            .eq('make_by', userId)
            .order('created_at', { ascending: false })
            .limit(30);
        if (error) return failure(infrastructureError(error));
        return success(
            (data ?? []).map((row) => ({
                id: row.id,
                word: row.word,
                rType: row.r_type,
                state: row.state,
                createdAt: row.created_at,
            }))
        );
    }

    async incrementContribution(userId: string, amount: number = 1): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.rpc('increment_contribution', {
            target_id: userId,
            inc_amount: amount,
        });
        if (error) return failure(infrastructureError(error));
        return success(undefined);
    }

    async addStarDocs(userId: string, docsId: number): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase
            .from('user_star_docs')
            .insert({ docs_id: docsId, user_id: userId });
        if (error) return failure(infrastructureError(error));
        return success(undefined);
    }

    async removeStarDocs(userId: string, docsId: number): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase
            .from('user_star_docs')
            .delete()
            .eq('docs_id', docsId)
            .eq('user_id', userId);
        if (error) return failure(infrastructureError(error));
        return success(undefined);
    }

    async setNickname(nickname: string): Promise<Result<void, CustomError>> {
        try {
            await axios.post('/api/auth/set_nickname', { nickname: nickname.trim() });
            return success(undefined);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return failure(infrastructureError({ message }));
        }
    }
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/services/infrastructure/supabase/SupabaseUserRepository.ts
git commit -m "feat: SupabaseUserRepository 구현"
```

---

## Task 12: SupabaseNotificationRepository + SupabaseStorageRepository 구현

**Files:**
- Create: `src/lib/services/infrastructure/supabase/SupabaseNotificationRepository.ts`
- Create: `src/lib/services/infrastructure/supabase/SupabaseStorageRepository.ts`

- [ ] **Step 1: `SupabaseNotificationRepository.ts` 작성**

```ts
// src/lib/services/infrastructure/supabase/SupabaseNotificationRepository.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import type { INotificationRepository } from '../../domain/notification/NotificationRepository';
import type { Result, CustomError } from '../../domain/result';
import type { NotificationEntity, NewNotification, UpdateNotification } from '../../domain/notification/NotificationEntity';
import { success, failure } from '../../domain/result';
import { infrastructureError } from '../../domain/errors';

type NotificationRow = Database['public']['Tables']['notification']['Row'];

function toNotificationEntity(row: NotificationRow): NotificationEntity {
    return {
        id: row.id,
        title: row.title,
        body: row.body,
        img: row.img,
        endAt: row.end_at,
        isImportant: row.is_important,
        isModal: row.is_modal,
        createdAt: row.created_at,
    };
}

export class SupabaseNotificationRepository implements INotificationRepository {
    constructor(private readonly supabase: SupabaseClient<Database>) {}

    async findAll(): Promise<Result<NotificationEntity[], CustomError>> {
        const { data, error } = await this.supabase
            .from('notification')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) return failure(infrastructureError(error));
        return success((data ?? []).map(toNotificationEntity));
    }

    async findById(id: number): Promise<Result<NotificationEntity | null, CustomError>> {
        const { data, error } = await this.supabase
            .from('notification')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error) return failure(infrastructureError(error));
        return success(data ? toNotificationEntity(data) : null);
    }

    async findActiveModal(): Promise<Result<NotificationEntity | null, CustomError>> {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const { data, error } = await this.supabase
            .from('notification')
            .select('*')
            .gte('end_at', today.toISOString())
            .eq('is_modal', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) return failure(infrastructureError(error));
        return success(data ? toNotificationEntity(data) : null);
    }

    async save(data: NewNotification): Promise<Result<NotificationEntity, CustomError>> {
        const { data: row, error } = await this.supabase
            .from('notification')
            .insert({
                title: data.title,
                body: data.body,
                img: data.img ?? null,
                end_at: data.endAt,
                is_important: data.isImportant ?? false,
                is_modal: data.isModal ?? false,
            })
            .select('*')
            .single();
        if (error) return failure(infrastructureError(error));
        return success(toNotificationEntity(row));
    }

    async update(id: number, data: UpdateNotification): Promise<Result<NotificationEntity, CustomError>> {
        const { data: row, error } = await this.supabase
            .from('notification')
            .update({
                ...(data.title !== undefined && { title: data.title }),
                ...(data.body !== undefined && { body: data.body }),
                ...(data.img !== undefined && { img: data.img }),
                end_at: data.endAt,
                ...(data.isImportant !== undefined && { is_important: data.isImportant }),
                ...(data.isModal !== undefined && { is_modal: data.isModal }),
            })
            .eq('id', id)
            .select('*')
            .single();
        if (error) return failure(infrastructureError(error));
        return success(toNotificationEntity(row));
    }

    async deleteById(id: number): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.from('notification').delete().eq('id', id);
        if (error) return failure(infrastructureError(error));
        return success(undefined);
    }
}
```

- [ ] **Step 2: `SupabaseStorageRepository.ts` 작성**

```ts
// src/lib/services/infrastructure/supabase/SupabaseStorageRepository.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import type { IStorageRepository } from '../../domain/notification/NotificationRepository';
import type { Result, CustomError } from '../../domain/result';
import { success, failure } from '../../domain/result';
import { infrastructureError } from '../../domain/errors';

const BUCKET = 'public_img';

export class SupabaseStorageRepository implements IStorageRepository {
    constructor(private readonly supabase: SupabaseClient<Database>) {}

    async uploadImage(file: File, path: string): Promise<Result<string, CustomError>> {
        const { error } = await this.supabase.storage
            .from(BUCKET)
            .upload(path, file, { cacheControl: '3600', upsert: false });
        if (error) return failure(infrastructureError({ message: error.message }));
        return success(this.getPublicUrl(path));
    }

    async deleteImage(path: string): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.storage.from(BUCKET).remove([path]);
        if (error) return failure(infrastructureError({ message: error.message }));
        return success(undefined);
    }

    getPublicUrl(path: string): string {
        return this.supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/lib/services/infrastructure/supabase/SupabaseNotificationRepository.ts \
        src/lib/services/infrastructure/supabase/SupabaseStorageRepository.ts
git commit -m "feat: SupabaseNotificationRepository, SupabaseStorageRepository 구현"
```

---

## Task 13: SupabaseAuthRepository 구현

**Files:**
- Create: `src/lib/services/infrastructure/supabase/SupabaseAuthRepository.ts`

- [ ] **Step 1: `SupabaseAuthRepository.ts` 작성**

```ts
// src/lib/services/infrastructure/supabase/SupabaseAuthRepository.ts
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import type { IAuthRepository } from '../../domain/auth/AuthRepository';
import type { Result, CustomError } from '../../domain/result';
import { success, failure } from '../../domain/result';
import { infrastructureError } from '../../domain/errors';

export class SupabaseAuthRepository implements IAuthRepository {
    constructor(private readonly supabase: SupabaseClient<Database>) {}

    async getSession(): Promise<Result<Session | null, CustomError>> {
        const { data, error } = await this.supabase.auth.getSession();
        if (error) return failure(infrastructureError({ message: error.message }));
        return success(data.session);
    }

    async getJWT(): Promise<Result<string | null, CustomError>> {
        const { data, error } = await this.supabase.auth.getSession();
        if (error) return failure(infrastructureError({ message: error.message }));
        return success(data.session?.access_token ?? null);
    }

    async loginByGoogle(originUrl: string): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${originUrl}/api/auth/callback` },
        });
        if (error) return failure(infrastructureError({ message: error.message }));
        return success(undefined);
    }

    async logout(): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.auth.signOut();
        if (error) return failure(infrastructureError({ message: error.message }));
        return success(undefined);
    }

    onAuthStateChange(
        callback: (session: Session | null) => Promise<void>
    ): { unsubscribe: () => void } {
        const { data } = this.supabase.auth.onAuthStateChange(async (_event, session) => {
            try {
                await callback(session);
            } finally {}
        });
        return { unsubscribe: () => data.subscription.unsubscribe() };
    }
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/services/infrastructure/supabase/SupabaseAuthRepository.ts
git commit -m "feat: SupabaseAuthRepository 구현"
```

---

## Task 14: Service Container 생성 (User, Notification, Auth)

**Files:**
- Create: `src/lib/services/UserServiceContainer.ts`
- Create: `src/lib/services/NotificationServiceContainer.ts`
- Create: `src/lib/services/AuthServiceContainer.ts`

- [ ] **Step 1: `UserServiceContainer.ts` 작성**

```ts
// src/lib/services/UserServiceContainer.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import { SupabaseUserRepository } from './infrastructure/supabase/SupabaseUserRepository';
import { UserService } from './application/user/UserService';

export class UserServiceContainer {
    public readonly userService: UserService;

    constructor(supabase: SupabaseClient<Database>) {
        const userRepo = new SupabaseUserRepository(supabase);
        this.userService = new UserService(userRepo);
    }
}

export function createUserServiceContainer(
    supabase: SupabaseClient<Database>
): UserServiceContainer {
    return new UserServiceContainer(supabase);
}
```

- [ ] **Step 2: `NotificationServiceContainer.ts` 작성**

```ts
// src/lib/services/NotificationServiceContainer.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import { SupabaseNotificationRepository } from './infrastructure/supabase/SupabaseNotificationRepository';
import { SupabaseStorageRepository } from './infrastructure/supabase/SupabaseStorageRepository';
import { NotificationService } from './application/notification/NotificationService';

export class NotificationServiceContainer {
    public readonly notificationService: NotificationService;

    constructor(supabase: SupabaseClient<Database>) {
        const notificationRepo = new SupabaseNotificationRepository(supabase);
        const storageRepo = new SupabaseStorageRepository(supabase);
        this.notificationService = new NotificationService(notificationRepo, storageRepo);
    }
}

export function createNotificationServiceContainer(
    supabase: SupabaseClient<Database>
): NotificationServiceContainer {
    return new NotificationServiceContainer(supabase);
}
```

- [ ] **Step 3: `AuthServiceContainer.ts` 작성**

```ts
// src/lib/services/AuthServiceContainer.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import { SupabaseAuthRepository } from './infrastructure/supabase/SupabaseAuthRepository';
import { AuthService } from './application/auth/AuthService';

export class AuthServiceContainer {
    public readonly authService: AuthService;

    constructor(supabase: SupabaseClient<Database>) {
        const authRepo = new SupabaseAuthRepository(supabase);
        this.authService = new AuthService(authRepo);
    }
}

export function createAuthServiceContainer(
    supabase: SupabaseClient<Database>
): AuthServiceContainer {
    return new AuthServiceContainer(supabase);
}
```

- [ ] **Step 4: 커밋**

```bash
git add src/lib/services/UserServiceContainer.ts \
        src/lib/services/NotificationServiceContainer.ts \
        src/lib/services/AuthServiceContainer.ts
git commit -m "feat: User, Notification, Auth 서비스 컨테이너 생성"
```

---

## Task 15: WordServiceContainer의 SupabaseUserContributionUpdater를 UserService로 교체

**Files:**
- Modify: `src/lib/services/WordServiceContainer.ts`

현재 `SupabaseUserContributionUpdater` 인라인 클래스가 `WordServiceContainer.ts` 끝에 정의되어 있음. 이를 `UserService`로 교체한다.

- [ ] **Step 1: `createWordServiceContainer` 함수 수정**

`WordServiceContainer.ts`에서 `createWordServiceContainer` 함수를:

```ts
// 기존 (수정 전)
export function createWordServiceContainer(supabase: SupabaseClient<Database>): WordServiceContainer {
    const container = new WordServiceContainer(supabase);

    const docsContainer = createDocsServiceContainer(supabase);
    const docsLogWriter = docsContainer.commandService;
    const wordLogWriter = new SupabaseWordLogWriter(supabase);
    const userContributionUpdater = new SupabaseUserContributionUpdater(supabase);

    container.initCommandService(docsLogWriter, wordLogWriter, userContributionUpdater);

    return container;
}
```

다음으로 교체:

```ts
// 수정 후
import { createUserServiceContainer } from './UserServiceContainer';

export function createWordServiceContainer(supabase: SupabaseClient<Database>): WordServiceContainer {
    const container = new WordServiceContainer(supabase);

    const docsContainer = createDocsServiceContainer(supabase);
    const userContainer = createUserServiceContainer(supabase);

    container.initCommandService(
        docsContainer.commandService,
        new SupabaseWordLogWriter(supabase),
        userContainer.userService,
    );

    return container;
}
```

또한 `SupabaseUserContributionUpdater` 클래스 정의도 파일에서 제거한다 (더 이상 사용하지 않음).

- [ ] **Step 2: 전체 테스트 실행 — 통과 확인**

```bash
npm test -- --no-coverage
```

Expected: 모든 테스트 통과 (`PASS`)

- [ ] **Step 3: 커밋**

```bash
git add src/lib/services/WordServiceContainer.ts
git commit -m "refactor: WordServiceContainer의 SupabaseUserContributionUpdater를 UserService로 교체"
```

---

## Task 16: 최종 검증

- [ ] **Step 1: 전체 테스트 실행**

```bash
npm test -- --no-coverage
```

Expected: 전체 테스트 통과. 새로 추가된 테스트 파일 3개(`UserService`, `NotificationService`, `AuthService`) 포함 전부 `PASS`.

- [ ] **Step 2: 타입 검사**

```bash
npx tsc --noEmit
```

Expected: 타입 에러 없음.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: 경고 없음.

- [ ] **Step 4: 최종 커밋 (필요 시)**

```bash
git log --oneline -10
```

Phase 3 완료 커밋 확인.

---

## 참고: SCM 메서드 이관 대응표

| SCM 메서드 | 새 서비스 |
|-----------|----------|
| `get().userById(id)` | `UserService.getUserById(id)` |
| `get().userByNickname(n)` | `UserService.getUserByNickname(n)` |
| `get().usersByNickname(n)` | `UserService.getUsersByNicknameExact(n)` |
| `get().usersLikeByNickname(q)` | `UserService.searchUsersByNickname(q)` |
| `get().allUser(field, asc)` | `UserService.getAllUsers({ field, ascending: asc })` |
| `get().monthlyConRankByUserId(id)` | `UserService.getUserMonthlyRank(id)` |
| `get().monthlyContributionsByUserId(id)` | `UserService.getUserMonthlyContributions(id)` |
| `get().starredDocsById(id)` | `UserService.getUserStarredDocs(id)` |
| `get().requestsListById(id)` | `UserService.getUserWaitWordRequests(id)` |
| `get().logsListById(id)` | `UserService.getUserWordLogs(id)` |
| `update().userContribution({ userId, amount })` | `UserService.incrementContribution(userId, amount)` |
| `add().starDocs({ docsId, userId })` | `UserService.addStarDocs(userId, docsId)` |
| `delete().startDocs({ docsId, userId })` | `UserService.removeStarDocs(userId, docsId)` |
| `add().nickname(nick)` | `UserService.setNickname(nick)` |
| `get().notice()` | `NotificationService.getActiveModal()` |
| `get().allNotifications()` | `NotificationService.getAll()` |
| `get().notificationById(id)` | `NotificationService.getById(id)` |
| `add().notification(data)` | `NotificationService.create(data)` |
| `update().notification(id, data)` | `NotificationService.update(id, data)` |
| `delete().notificationById(id)` | `NotificationService.deleteById(id)` |
| `uploadImage(file, path)` | `NotificationService.uploadImage(file, path)` |
| `deleteImage(path)` | `NotificationService.deleteImage(path)` |
| `getPublicUrl(path)` | `NotificationService.getPublicUrl(path)` |
| `get().session()` | `AuthService.getSession()` |
| `getJWT()` | `AuthService.getJWT()` |
| `loginByGoogle(url)` | `AuthService.loginByGoogle(url)` |
| `logout()` | `AuthService.logout()` |
| `onAuthStateChange(fn)` | `AuthService.onAuthStateChange(fn)` |

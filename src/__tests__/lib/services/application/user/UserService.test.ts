import { UserService } from '@/src/lib/services/application/user/UserService';
import type { IUserRepository } from '@/src/lib/services/domain/user/UserRepository';
import type { UserEntity, UserStarredDocs, UserMonthlyContribution, UserWaitWordRequest, UserWordLog } from '@/src/lib/services/domain/user/UserEntity';
import { success, failure } from '@/src/lib/services/domain/result';
import { infrastructureError } from '@/src/lib/services/domain/errors';

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

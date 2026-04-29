import { DocsQueryService } from '@/src/lib/services/application/docs/DocsQueryService';
import type { IDocsRepository } from '@/src/lib/services/domain/docs/DocsRepository';
import type { IWaitDocsRepository } from '@/src/lib/services/domain/docs/WaitDocsRepository';
import { success, failure } from '@/src/lib/services/domain/result';
import { infrastructureError } from '@/src/lib/services/domain/errors';
import type {
    DocsWithUser,
    DocsEntity,
    DocsLogEntity,
    DocsLogWithDocs,
    WaitDocsWithUser,
} from '@/src/lib/services/domain/docs/DocsEntity';

function createMockDocsRepo(): jest.Mocked<IDocsRepository> {
    return {
        findAll: jest.fn(),
        findById: jest.fn(),
        findByType: jest.fn(),
        findByThemeNames: jest.fn(),
        findLastUpdate: jest.fn(),
        findWordCount: jest.fn(),
        findViewRank: jest.fn(),
        findStarCount: jest.fn(),
        findStarUsers: jest.fn(),
        findLogs: jest.fn(),
        findLogsByFilter: jest.fn(),
        saveLogs: jest.fn(),
        deleteLogsByIds: jest.fn(),
        saveStar: jest.fn(),
        deleteStar: jest.fn(),
        save: jest.fn(),
        updateLastUpdate: jest.fn(),
        incrementView: jest.fn(),
    };
}

function createMockWaitDocsRepo(): jest.Mocked<IWaitDocsRepository> {
    return {
        findAll: jest.fn(),
        save: jest.fn(),
        deleteByIds: jest.fn(),
    };
}

const mockDocsWithUser: DocsWithUser = {
    id: 1,
    name: '테스트문서',
    typez: 'letter',
    maker: 'user1',
    duem: false,
    isHidden: false,
    views: 100,
    createdAt: '2025-01-01',
    lastUpdate: '2025-01-10',
    userNickname: 'user1Nick',
};

const mockDocsEntity: DocsEntity = {
    id: 2,
    name: '동물문서',
    typez: 'theme',
    maker: 'user2',
    duem: false,
    isHidden: false,
    views: 50,
    createdAt: '2025-01-01',
    lastUpdate: '2025-01-05',
};

const mockWaitDocsWithUser: WaitDocsWithUser = {
    id: 1,
    docsName: '요청문서',
    reqBy: 'user3',
    reqAt: '2025-01-01',
    userNickname: 'user3Nick',
};

describe('DocsQueryService', () => {
    let docsRepo: jest.Mocked<IDocsRepository>;
    let waitDocsRepo: jest.Mocked<IWaitDocsRepository>;
    let service: DocsQueryService;

    beforeEach(() => {
        docsRepo = createMockDocsRepo();
        waitDocsRepo = createMockWaitDocsRepo();
        service = new DocsQueryService(docsRepo, waitDocsRepo);
    });

    describe('getAllDocs', () => {
        it('전체 문서 목록을 반환한다', async () => {
            const mockDocs: DocsWithUser[] = [mockDocsWithUser];
            docsRepo.findAll.mockResolvedValue(success(mockDocs));

            const result = await service.getAllDocs();

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual(mockDocs);
            }
            expect(docsRepo.findAll).toHaveBeenCalledTimes(1);
        });

        it('인프라 에러를 전파한다', async () => {
            docsRepo.findAll.mockResolvedValue(failure(infrastructureError({ message: 'DB error' })));

            const result = await service.getAllDocs();

            expect(result.success).toBe(false);
        });
    });

    describe('getDocsById', () => {
        it('ID로 문서를 조회한다', async () => {
            docsRepo.findById.mockResolvedValue(success(mockDocsWithUser));

            const result = await service.getDocsById(1);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data?.id).toBe(1);
                expect(result.data?.name).toBe('테스트문서');
            }
            expect(docsRepo.findById).toHaveBeenCalledWith(1);
        });

        it('존재하지 않는 ID면 null을 반환한다', async () => {
            docsRepo.findById.mockResolvedValue(success(null));

            const result = await service.getDocsById(999);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBeNull();
            }
        });

        it('인프라 에러를 전파한다', async () => {
            docsRepo.findById.mockResolvedValue(failure(infrastructureError({ message: 'DB error' })));

            const result = await service.getDocsById(1);

            expect(result.success).toBe(false);
        });
    });

    describe('getLetterDocs', () => {
        it('letter 타입 문서 목록을 반환한다', async () => {
            const mockDocs: DocsEntity[] = [mockDocsEntity];
            docsRepo.findByType.mockResolvedValue(success(mockDocs));

            const result = await service.getLetterDocs();

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveLength(1);
            }
            expect(docsRepo.findByType).toHaveBeenCalledWith('letter');
        });

        it('인프라 에러를 전파한다', async () => {
            docsRepo.findByType.mockResolvedValue(failure(infrastructureError({ message: 'DB error' })));

            const result = await service.getLetterDocs();

            expect(result.success).toBe(false);
        });
    });

    describe('getDocsByThemeNames', () => {
        it('테마 이름 배열로 문서를 조회한다', async () => {
            const mockDocs: DocsEntity[] = [mockDocsEntity];
            docsRepo.findByThemeNames.mockResolvedValue(success(mockDocs));

            const result = await service.getDocsByThemeNames(['동물', '식물']);

            expect(result.success).toBe(true);
            expect(docsRepo.findByThemeNames).toHaveBeenCalledWith(['동물', '식물']);
        });
    });

    describe('getDocsLastUpdate', () => {
        it('문서의 마지막 업데이트 시각을 조회한다', async () => {
            docsRepo.findLastUpdate.mockResolvedValue(success('2025-01-10'));

            const result = await service.getDocsLastUpdate(1);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBe('2025-01-10');
            }
            expect(docsRepo.findLastUpdate).toHaveBeenCalledWith(1);
        });
    });

    describe('getDocsWordCount', () => {
        it('문서의 단어 개수를 조회한다', async () => {
            docsRepo.findWordCount.mockResolvedValue(success(42));

            const input = { name: '가', duem: false, typez: 'letter' as const };
            const result = await service.getDocsWordCount(input);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBe(42);
            }
            expect(docsRepo.findWordCount).toHaveBeenCalledWith(input);
        });
    });

    describe('getDocsViewRank', () => {
        it('문서의 조회수 랭킹을 조회한다', async () => {
            docsRepo.findViewRank.mockResolvedValue(success(3));

            const result = await service.getDocsViewRank(1);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBe(3);
            }
            expect(docsRepo.findViewRank).toHaveBeenCalledWith(1);
        });
    });

    describe('getDocsStarCount', () => {
        it('문서의 별 개수를 조회한다', async () => {
            docsRepo.findStarCount.mockResolvedValue(success(10));

            const result = await service.getDocsStarCount(1);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBe(10);
            }
            expect(docsRepo.findStarCount).toHaveBeenCalledWith(1);
        });
    });

    describe('getDocsStarUsers', () => {
        it('문서를 별표한 사용자 목록을 조회한다', async () => {
            docsRepo.findStarUsers.mockResolvedValue(success(['user1', 'user2']));

            const result = await service.getDocsStarUsers(1);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual(['user1', 'user2']);
            }
            expect(docsRepo.findStarUsers).toHaveBeenCalledWith(1);
        });
    });

    describe('getDocsLogs', () => {
        it('문서의 변경 로그를 조회한다', async () => {
            const mockLogs: DocsLogEntity[] = [
                {
                    id: 1,
                    docsId: 1,
                    word: '사과',
                    type: 'add',
                    addBy: 'user1',
                    date: '2025-01-01',
                },
            ];
            docsRepo.findLogs.mockResolvedValue(success(mockLogs));

            const result = await service.getDocsLogs(1);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveLength(1);
                expect(result.data[0].word).toBe('사과');
            }
            expect(docsRepo.findLogs).toHaveBeenCalledWith(1);
        });
    });

    describe('getDocsLogsByFilter', () => {
        it('필터 조건에 맞는 변경 로그를 조회한다', async () => {
            const mockLogsWithDocs: DocsLogWithDocs[] = [
                {
                    id: 1,
                    docsId: 1,
                    docsName: '테스트문서',
                    word: '사과',
                    type: 'add',
                    addBy: 'user1',
                    date: '2025-01-01',
                },
            ];
            docsRepo.findLogsByFilter.mockResolvedValue(success({ data: mockLogsWithDocs, count: 1 }));

            const filter = { logType: 'all' as const, from: 0, to: 10 };
            const result = await service.getDocsLogsByFilter(filter);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.data).toHaveLength(1);
                expect(result.data.count).toBe(1);
            }
            expect(docsRepo.findLogsByFilter).toHaveBeenCalledWith(filter);
        });

        it('인프라 에러를 전파한다', async () => {
            docsRepo.findLogsByFilter.mockResolvedValue(failure(infrastructureError({ message: 'DB error' })));

            const filter = { logType: 'all' as const, from: 0, to: 10 };
            const result = await service.getDocsLogsByFilter(filter);

            expect(result.success).toBe(false);
        });
    });

    describe('getAllWaitDocs', () => {
        it('전체 대기 문서 목록을 반환한다', async () => {
            const mockWaitDocs: WaitDocsWithUser[] = [mockWaitDocsWithUser];
            waitDocsRepo.findAll.mockResolvedValue(success(mockWaitDocs));

            const result = await service.getAllWaitDocs();

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveLength(1);
                expect(result.data[0].docsName).toBe('요청문서');
            }
            expect(waitDocsRepo.findAll).toHaveBeenCalledTimes(1);
        });

        it('인프라 에러를 전파한다', async () => {
            waitDocsRepo.findAll.mockResolvedValue(failure(infrastructureError({ message: 'DB error' })));

            const result = await service.getAllWaitDocs();

            expect(result.success).toBe(false);
        });
    });
});

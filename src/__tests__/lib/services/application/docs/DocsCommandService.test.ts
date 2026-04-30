import { DocsCommandService } from '@/src/lib/services/application/docs/DocsCommandService';
import type { IDocsRepository } from '@/src/lib/services/domain/docs/DocsRepository';
import type { IWaitDocsRepository } from '@/src/lib/services/domain/docs/WaitDocsRepository';
import type { LogService } from '@/src/lib/services/application/log/LogService';
import { success, failure } from '@/src/lib/services/domain/result';
import { infrastructureError } from '@/src/lib/services/domain/errors';
import type { DocsWithUser } from '@/src/lib/services/domain/docs/DocsEntity';

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

function createMockLogService(): jest.Mocked<LogService> {
    return {
        getWordLogsByFilter: jest.fn(),
        deleteWordLogsByIds: jest.fn(),
        deleteDocsLogsByIds: jest.fn(),
        writeWordLog: jest.fn(),
        writeDocsLog: jest.fn(),
    } as unknown as jest.Mocked<LogService>;
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

describe('DocsCommandService', () => {
    let docsRepo: jest.Mocked<IDocsRepository>;
    let waitDocsRepo: jest.Mocked<IWaitDocsRepository>;
    let logService: jest.Mocked<LogService>;
    let service: DocsCommandService;

    beforeEach(() => {
        docsRepo = createMockDocsRepo();
        waitDocsRepo = createMockWaitDocsRepo();
        logService = createMockLogService();
        service = new DocsCommandService(docsRepo, waitDocsRepo, logService);
    });

    describe('writeDocsLog', () => {
        it('logService.writeDocsLog에 위임한다', async () => {
            logService.writeDocsLog.mockResolvedValue(undefined);

            await service.writeDocsLog([
                { word: '사과', docs_id: 1, add_by: 'user1', type: 'add' },
            ]);

            expect(logService.writeDocsLog).toHaveBeenCalledWith([
                { word: '사과', docs_id: 1, add_by: 'user1', type: 'add' },
            ]);
        });

        it('여러 로그를 logService에 전달한다', async () => {
            logService.writeDocsLog.mockResolvedValue(undefined);

            await service.writeDocsLog([
                { word: '사과', docs_id: 1, add_by: 'user1', type: 'add' },
                { word: '바나나', docs_id: 2, add_by: null, type: 'delete' },
            ]);

            expect(logService.writeDocsLog).toHaveBeenCalledWith([
                { word: '사과', docs_id: 1, add_by: 'user1', type: 'add' },
                { word: '바나나', docs_id: 2, add_by: null, type: 'delete' },
            ]);
        });

        it('add_by가 null인 경우도 처리한다', async () => {
            logService.writeDocsLog.mockResolvedValue(undefined);

            await service.writeDocsLog([
                { word: '포도', docs_id: 3, add_by: null, type: 'add' },
            ]);

            expect(logService.writeDocsLog).toHaveBeenCalledWith([
                { word: '포도', docs_id: 3, add_by: null, type: 'add' },
            ]);
        });
    });

    describe('getAllDocs (IDocsLogWriter)', () => {
        it('문서 목록을 {id, name, typez}[] 형태로 반환한다', async () => {
            docsRepo.findAll.mockResolvedValue(success([mockDocsWithUser]));

            const result = await service.getAllDocs();

            expect(result).toEqual([
                { id: 1, name: '테스트문서', typez: 'letter' },
            ]);
        });

        it('여러 문서를 {id, name, typez}[] 형태로 반환한다', async () => {
            const mockDocs: DocsWithUser[] = [
                mockDocsWithUser,
                {
                    id: 2,
                    name: '동물문서',
                    typez: 'theme',
                    maker: 'user2',
                    duem: false,
                    isHidden: false,
                    views: 50,
                    createdAt: '2025-01-01',
                    lastUpdate: '2025-01-05',
                    userNickname: 'user2Nick',
                },
            ];
            docsRepo.findAll.mockResolvedValue(success(mockDocs));

            const result = await service.getAllDocs();

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ id: 1, name: '테스트문서', typez: 'letter' });
            expect(result[1]).toEqual({ id: 2, name: '동물문서', typez: 'theme' });
        });

        it('findAll 실패 시 빈 배열을 반환한다 (에러 전파 없음)', async () => {
            docsRepo.findAll.mockResolvedValue(failure(infrastructureError({ message: 'DB error' })));

            const result = await service.getAllDocs();

            expect(result).toEqual([]);
        });
    });

    describe('updateDocsLastUpdate', () => {
        it('docsRepo.updateLastUpdate에 위임한다', async () => {
            docsRepo.updateLastUpdate.mockResolvedValue(success(undefined));

            await service.updateDocsLastUpdate([1, 2, 3]);

            expect(docsRepo.updateLastUpdate).toHaveBeenCalledWith([1, 2, 3]);
        });
    });

    describe('addStar', () => {
        it('docsRepo.saveStar를 호출한다', async () => {
            docsRepo.saveStar.mockResolvedValue(success(undefined));

            const result = await service.addStar(1, 'user1');

            expect(result.success).toBe(true);
            expect(docsRepo.saveStar).toHaveBeenCalledWith(1, 'user1');
        });

        it('인프라 에러를 전파한다', async () => {
            docsRepo.saveStar.mockResolvedValue(failure(infrastructureError({ message: 'DB error' })));

            const result = await service.addStar(1, 'user1');

            expect(result.success).toBe(false);
        });
    });

    describe('removeStar', () => {
        it('docsRepo.deleteStar를 호출한다', async () => {
            docsRepo.deleteStar.mockResolvedValue(success(undefined));

            const result = await service.removeStar(1, 'user1');

            expect(result.success).toBe(true);
            expect(docsRepo.deleteStar).toHaveBeenCalledWith(1, 'user1');
        });

        it('인프라 에러를 전파한다', async () => {
            docsRepo.deleteStar.mockResolvedValue(failure(infrastructureError({ message: 'DB error' })));

            const result = await service.removeStar(1, 'user1');

            expect(result.success).toBe(false);
        });
    });

    describe('requestDocs', () => {
        it('waitDocsRepo.save에 위임한다', async () => {
            waitDocsRepo.save.mockResolvedValue(success(undefined));

            const result = await service.requestDocs('새문서', 'user1');

            expect(result.success).toBe(true);
            expect(waitDocsRepo.save).toHaveBeenCalledWith('새문서', 'user1');
        });

        it('userId가 null인 경우도 처리한다', async () => {
            waitDocsRepo.save.mockResolvedValue(success(undefined));

            const result = await service.requestDocs('익명문서', null);

            expect(result.success).toBe(true);
            expect(waitDocsRepo.save).toHaveBeenCalledWith('익명문서', null);
        });

        it('인프라 에러를 전파한다', async () => {
            waitDocsRepo.save.mockResolvedValue(failure(infrastructureError({ message: 'DB error' })));

            const result = await service.requestDocs('새문서', 'user1');

            expect(result.success).toBe(false);
        });
    });

    describe('approveWaitDocs', () => {
        it('waitDocsRepo.deleteByIds에 위임한다', async () => {
            waitDocsRepo.deleteByIds.mockResolvedValue(success(undefined));

            const result = await service.approveWaitDocs([1, 2, 3]);

            expect(result.success).toBe(true);
            expect(waitDocsRepo.deleteByIds).toHaveBeenCalledWith([1, 2, 3]);
        });

        it('인프라 에러를 전파한다', async () => {
            waitDocsRepo.deleteByIds.mockResolvedValue(failure(infrastructureError({ message: 'DB error' })));

            const result = await service.approveWaitDocs([1]);

            expect(result.success).toBe(false);
        });
    });

    describe('deleteDocsLogs', () => {
        it('logService.deleteDocsLogsByIds에 위임한다', async () => {
            logService.deleteDocsLogsByIds.mockResolvedValue(success(undefined));

            const result = await service.deleteDocsLogs([10, 20]);

            expect(result.success).toBe(true);
            expect(logService.deleteDocsLogsByIds).toHaveBeenCalledWith([10, 20]);
        });

        it('인프라 에러를 전파한다', async () => {
            logService.deleteDocsLogsByIds.mockResolvedValue(failure(infrastructureError({ message: 'DB error' })));

            const result = await service.deleteDocsLogs([10]);

            expect(result.success).toBe(false);
        });
    });

    describe('incrementView', () => {
        it('docsRepo.incrementView에 위임한다', async () => {
            docsRepo.incrementView.mockResolvedValue(success(undefined));

            const result = await service.incrementView(1);

            expect(result.success).toBe(true);
            expect(docsRepo.incrementView).toHaveBeenCalledWith(1);
        });

        it('인프라 에러를 전파한다', async () => {
            docsRepo.incrementView.mockResolvedValue(failure(infrastructureError({ message: 'DB error' })));

            const result = await service.incrementView(1);

            expect(result.success).toBe(false);
        });
    });
});

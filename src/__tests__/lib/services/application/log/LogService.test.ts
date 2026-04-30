import { LogService } from '@/src/lib/services/application/log/LogService';
import type { ILogRepository } from '@/src/lib/services/domain/log/LogRepository';
import type { WordLogEntity, WordLogFilter } from '@/src/lib/services/domain/log/LogEntity';
import { success, failure } from '@/src/lib/services/domain/result';

const mockLogRepo: jest.Mocked<ILogRepository> = {
    findWordLogsByFilter: jest.fn(),
    deleteWordLogsByIds: jest.fn(),
    deleteDocsLogsByIds: jest.fn(),
    saveWordLogs: jest.fn(),
    saveDocsLogs: jest.fn(),
};

const service = new LogService(mockLogRepo);

const sampleLog: WordLogEntity = {
    id: 1,
    word: '사과',
    state: 'approved',
    requestType: 'add',
    madeBy: 'user-uuid',
    processedBy: 'admin-uuid',
    createdAt: '2026-01-01T00:00:00Z',
    madeByUser: { nickname: '홍길동' },
    processedByUser: { nickname: '관리자' },
};

const filter: WordLogFilter = { filterState: 'all', filterType: 'all', from: 0, to: 29 };

beforeEach(() => jest.clearAllMocks());

test('getWordLogsByFilter — 성공 시 data와 count 반환', async () => {
    mockLogRepo.findWordLogsByFilter.mockResolvedValue(
        success({ data: [sampleLog], count: 1 })
    );
    const result = await service.getWordLogsByFilter(filter);
    expect(result.success).toBe(true);
    if (result.success) {
        expect(result.data.data).toHaveLength(1);
        expect(result.data.count).toBe(1);
    }
});

test('getWordLogsByFilter — 인프라 에러 전파', async () => {
    mockLogRepo.findWordLogsByFilter.mockResolvedValue(
        failure({ name: 'InfrastructureError', message: 'DB error', httpStatus: 500, code: 'INFRA' })
    );
    const result = await service.getWordLogsByFilter(filter);
    expect(result.success).toBe(false);
});

test('deleteWordLogsByIds — 성공', async () => {
    mockLogRepo.deleteWordLogsByIds.mockResolvedValue(success(undefined));
    const result = await service.deleteWordLogsByIds([1, 2, 3]);
    expect(result.success).toBe(true);
    expect(mockLogRepo.deleteWordLogsByIds).toHaveBeenCalledWith([1, 2, 3]);
});

test('deleteDocsLogsByIds — 성공', async () => {
    mockLogRepo.deleteDocsLogsByIds.mockResolvedValue(success(undefined));
    const result = await service.deleteDocsLogsByIds([5, 6]);
    expect(result.success).toBe(true);
    expect(mockLogRepo.deleteDocsLogsByIds).toHaveBeenCalledWith([5, 6]);
});

test('writeWordLog — repo 호출 후 에러 무시', async () => {
    mockLogRepo.saveWordLogs.mockResolvedValue(undefined);
    await service.writeWordLog([{ word: '사과', make_by: null, processed_by: null, r_type: 'add', state: 'approved' }]);
    expect(mockLogRepo.saveWordLogs).toHaveBeenCalledTimes(1);
});

test('writeDocsLog — repo 호출 후 에러 무시', async () => {
    mockLogRepo.saveDocsLogs.mockResolvedValue(undefined);
    await service.writeDocsLog([{ word: '사과', docs_id: 1, add_by: null, type: 'add' }]);
    expect(mockLogRepo.saveDocsLogs).toHaveBeenCalledTimes(1);
});

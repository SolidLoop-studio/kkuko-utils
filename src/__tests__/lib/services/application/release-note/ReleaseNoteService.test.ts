import { ReleaseNoteService } from '@/src/lib/services/application/release-note/ReleaseNoteService';
import type { IReleaseNoteRepository } from '@/src/lib/services/domain/release-note/ReleaseNoteRepository';
import type { ReleaseNoteEntity } from '@/src/lib/services/domain/release-note/ReleaseNoteEntity';
import { success, failure } from '@/src/lib/services/domain/result';

const mockRepo: jest.Mocked<IReleaseNoteRepository> = {
    findAll: jest.fn(),
};

const service = new ReleaseNoteService(mockRepo);

const sampleNote: ReleaseNoteEntity = {
    id: 1,
    title: 'v1.0.0',
    content: '최초 릴리즈',
    createdAt: '2026-01-01T00:00:00Z',
    link: null,
};

beforeEach(() => jest.clearAllMocks());

test('getAll — 성공 시 엔티티 배열 반환', async () => {
    mockRepo.findAll.mockResolvedValue(success([sampleNote]));
    const result = await service.getAll();
    expect(result.success).toBe(true);
    if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].title).toBe('v1.0.0');
    }
});

test('getAll — 인프라 에러 전파', async () => {
    mockRepo.findAll.mockResolvedValue(
        failure({ name: 'InfrastructureError', message: 'DB error', httpStatus: 500, code: 'INFRA' })
    );
    const result = await service.getAll();
    expect(result.success).toBe(false);
});

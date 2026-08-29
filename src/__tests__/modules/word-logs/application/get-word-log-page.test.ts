import { GetWordLogPageService } from '@/src/modules/word-logs/application/get-word-log-page';
import type { WordLogQueryGateway } from '@/src/modules/word-logs/application/word-log-query-ports';
import type {
    WordLogPageProjection,
    WordLogPageQuery,
} from '@/src/modules/word-logs/application/word-log-query-types';
import { err, ok, type Result } from '@/src/shared/application/result';

const query: WordLogPageQuery = {
    page: 2,
    pageSize: 30,
    state: 'approved',
    requestType: 'add',
};

const projection: WordLogPageProjection = {
    items: [{
        id: 31,
        createdAt: '2026-08-29T00:00:00.000Z',
        word: '가나',
        requesterId: 'requester-1',
        processorId: null,
        state: 'approved',
        requestType: 'add',
        requesterNickname: '신청자',
        processorNickname: null,
    }],
    totalCount: 61,
    page: 2,
    pageSize: 30,
};

const createGateway = (
    result: Result<WordLogPageProjection> = ok(projection),
): jest.Mocked<WordLogQueryGateway> => ({
    loadPage: jest.fn().mockResolvedValue(result),
});

describe('GetWordLogPageService', () => {
    test('returns the matching page projection for every public filter value', async () => {
        // Break caught: rejecting a visible state/type filter or changing the public projection shape.
        const gateway = createGateway();

        await expect(new GetWordLogPageService(gateway).get(query)).resolves.toEqual(ok(projection));
        expect(gateway.loadPage).toHaveBeenCalledWith(query);
    });

    test.each([
        { ...query, page: 0 },
        { ...query, page: 1.5 },
        { ...query, page: Number.MAX_SAFE_INTEGER + 1 },
        { ...query, pageSize: 29 } as unknown as WordLogPageQuery,
        { ...query, state: 'unknown' } as unknown as WordLogPageQuery,
        { ...query, requestType: 'unknown' } as unknown as WordLogPageQuery,
    ])('rejects an invalid query before Infrastructure is called', async (invalidQuery) => {
        // Break caught: unsafe page ranges or hidden filter values reaching the database adapter.
        const gateway = createGateway();

        await expect(new GetWordLogPageService(gateway).get(invalidQuery)).resolves.toEqual(err({
            kind: 'validation',
            message: '올바른 로그 조회 조건이 필요합니다.',
        }));
        expect(gateway.loadPage).not.toHaveBeenCalled();
    });

    test.each([
        { ...projection, page: 1 },
        { ...projection, pageSize: 29 } as unknown as WordLogPageProjection,
        { ...projection, totalCount: -1 },
    ])('maps a mismatched page projection to the stable public error', async (mismatch) => {
        // Break caught: rendering stale pagination metadata or a non-exact count from Infrastructure.
        const gateway = createGateway(ok(mismatch));

        await expect(new GetWordLogPageService(gateway).get(query)).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '로그를 불러오는 중 오류가 발생했습니다.',
        }));
    });

    test.each([
        ['returned', createGateway(err({ kind: 'infrastructure', message: 'private PostgREST detail' }))],
        ['thrown', { loadPage: jest.fn().mockRejectedValue(new Error('private Supabase detail')) }],
    ])('normalizes a %s gateway failure to the stable Korean error', async (_kind, gateway) => {
        // Break caught: leaking database diagnostics across the Application boundary.
        await expect(new GetWordLogPageService(gateway).get(query)).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '로그를 불러오는 중 오류가 발생했습니다.',
        }));
    });
});

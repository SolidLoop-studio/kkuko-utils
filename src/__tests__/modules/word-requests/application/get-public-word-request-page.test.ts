import { GetPublicWordRequestPageService } from '@/src/modules/word-requests/application/get-public-word-request-page';
import type { PublicWordRequestPageQueryGateway } from '@/src/modules/word-requests/application/public-word-request-query-ports';
import type {
    PublicWordRequestPageProjection,
    PublicWordRequestQueryInput,
} from '@/src/modules/word-requests/application/public-word-request-query-types';
import { err, ok, type Result } from '@/src/shared/application/result';

const page: PublicWordRequestPageProjection = {
    page: 2,
    pageSize: 30,
    totalCount: 31,
    items: [{
        id: 31,
        requestType: 'add',
        requestedAt: '2026-08-30T00:00:00.000Z',
        requestedBy: null,
        status: 'pending',
        word: '나비',
        wordId: null,
        requesterNickname: null,
    }],
};

const createGateway = (
    result: Result<PublicWordRequestPageProjection> = ok(page),
): jest.Mocked<PublicWordRequestPageQueryGateway> => ({
    load: jest.fn().mockResolvedValue(result),
});

describe('GetPublicWordRequestPageService', () => {
    test.each([
        [{ page: 0, status: 'all' }, 'page'],
        [{ page: -1, status: 'all' }, 'page'],
        [{ page: 1.5, status: 'all' }, 'page'],
        [{ page: Number.MAX_SAFE_INTEGER + 1, status: 'all' }, 'page'],
        [{ page: 1, status: 'unknown' }, 'status'],
    ])('rejects an invalid public request query (%o) before loading the gateway', async (input, field) => {
        // Break caught: an invalid page/status reaches Supabase or creates an unsafe inclusive range.
        const gateway = createGateway();

        await expect(new GetPublicWordRequestPageService(gateway).get(input as PublicWordRequestQueryInput))
            .resolves.toMatchObject({ ok: false, error: { kind: 'validation', field } });
        expect(gateway.load).not.toHaveBeenCalled();
    });

    test('rejects a page whose fixed-size inclusive range exceeds safe integers before loading the gateway', async () => {
        // Break caught: overflowing page ranges are sent to the database query builder.
        const gateway = createGateway();
        const overflowingPage = Math.floor(Number.MAX_SAFE_INTEGER / 30) + 2;

        await expect(new GetPublicWordRequestPageService(gateway).get({ page: overflowingPage, status: 'approved' }))
            .resolves.toMatchObject({ ok: false, error: { kind: 'validation', field: 'page' } });
        expect(gateway.load).not.toHaveBeenCalled();
    });

    test('returns the exact narrow page projection from a valid gateway query', async () => {
        // Break caught: altering page metadata or leaking a different row shape beyond the application boundary.
        const gateway = createGateway();

        await expect(new GetPublicWordRequestPageService(gateway).get({ page: 2, status: 'pending' }))
            .resolves.toEqual(ok(page));
        expect(gateway.load).toHaveBeenCalledWith({ page: 2, status: 'pending' });
    });

    test.each([
        ['a returned gateway failure', createGateway(err({ kind: 'infrastructure', message: 'private database detail' }))],
        ['a thrown gateway failure', { load: jest.fn().mockRejectedValue(new Error('private database detail')) }],
    ])('maps %s to a stable public application error', async (_description, gateway) => {
        // Break caught: returned or thrown infrastructure diagnostics are exposed to the public screen.
        await expect(new GetPublicWordRequestPageService(gateway).get({ page: 1, status: 'all' }))
            .resolves.toEqual(err({
                kind: 'infrastructure',
                message: '단어 요청 목록을 불러오는 중 오류가 발생했습니다.',
            }));
    });
});

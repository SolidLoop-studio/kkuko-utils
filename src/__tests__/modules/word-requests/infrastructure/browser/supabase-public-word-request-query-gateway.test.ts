jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: {},
}));

import { SupabasePublicWordRequestQueryGateway } from '@/src/modules/word-requests/infrastructure/browser/supabase-public-word-request-query-gateway';
import { err, ok } from '@/src/shared/application/result';

type QueryResponse = { data: unknown; error: unknown; count: unknown };

const stableError = err({
    kind: 'infrastructure' as const,
    message: '단어 요청 목록을 불러오는 중 오류가 발생했습니다.',
});

const validRow = {
    id: 31,
    request_type: 'add',
    requested_at: '2026-08-30T00:00:00.000Z',
    requested_by: 'user-1',
    status: 'pending',
    word: '나비',
    word_id: 7,
    users: { nickname: '요청자' },
};

const createGateway = ({
    response = { data: [validRow], error: null, count: 31 },
    throws = false,
}: { response?: QueryResponse; throws?: boolean } = {}) => {
    const range = jest.fn(() => (
        throws ? Promise.reject(new Error('private database detail')) : Promise.resolve(response)
    ));
    const order = jest.fn(() => ({ range }));
    const eq = jest.fn(() => ({ order }));
    const select = jest.fn(() => ({ eq, order }));
    const from = jest.fn(() => ({ select }));

    return {
        gateway: new SupabasePublicWordRequestQueryGateway({ from } as never),
        from,
        select,
        eq,
        order,
        range,
    };
};

describe('SupabasePublicWordRequestQueryGateway', () => {
    test('selects a narrow public projection, filters a requested status, counts exactly, and uses the inclusive page range', async () => {
        // Break caught: changing public field scope, filter/order/count, or page 2's 30-row inclusive range.
        const { gateway, from, select, eq, order, range } = createGateway();

        await expect(gateway.load({ page: 2, status: 'pending' })).resolves.toEqual(ok({
            page: 2,
            pageSize: 30,
            totalCount: 31,
            items: [{
                id: 31,
                requestType: 'add',
                requestedAt: '2026-08-30T00:00:00.000Z',
                requestedBy: 'user-1',
                status: 'pending',
                word: '나비',
                wordId: 7,
                requesterNickname: '요청자',
            }],
        }));
        expect(from).toHaveBeenCalledWith('wait_words');
        expect(select).toHaveBeenCalledWith(
            'id, request_type, requested_at, requested_by, status, word, word_id, users(nickname)',
            { count: 'exact' },
        );
        expect(eq).toHaveBeenCalledWith('status', 'pending');
        expect(order).toHaveBeenCalledWith('requested_at', { ascending: true });
        expect(range).toHaveBeenCalledWith(30, 59);
    });

    test('does not add a status equality filter for all statuses and preserves nullable values', async () => {
        // Break caught: excluding rows from the all-status view or converting database nulls to unsafe sentinel values.
        const { gateway, eq, range } = createGateway({
            response: {
                data: [{ ...validRow, requested_by: null, word_id: null, users: null }],
                error: null,
                count: 1,
            },
        });

        await expect(gateway.load({ page: 1, status: 'all' })).resolves.toEqual(ok({
            page: 1,
            pageSize: 30,
            totalCount: 1,
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
        }));
        expect(eq).not.toHaveBeenCalled();
        expect(range).toHaveBeenCalledWith(0, 29);
    });

    test.each([
        ['a returned SDK failure', { data: null, error: { message: 'private database detail' }, count: null }, false],
        ['a thrown SDK failure', undefined, true],
        ['a malformed row', { data: [{ ...validRow, id: 0 }], error: null, count: 1 }, false],
        ['a malformed joined user', { data: [{ ...validRow, users: { nickname: 3 } }], error: null, count: 1 }, false],
        ['a non-exact count', { data: [validRow], error: null, count: 1.5 }, false],
        ['a negative count', { data: [validRow], error: null, count: -1 }, false],
    ])('maps %s to one stable public error', async (_description, response, throws) => {
        // Break caught: malformed rows/counts or SDK diagnostics cross the infrastructure boundary.
        const { gateway } = createGateway({ response: response as QueryResponse, throws });

        await expect(gateway.load({ page: 1, status: 'all' })).resolves.toEqual(stableError);
    });
});

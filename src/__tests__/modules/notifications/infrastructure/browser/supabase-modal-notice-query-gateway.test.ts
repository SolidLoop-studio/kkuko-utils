jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn() },
}));

import {
    SupabaseModalNoticeQueryGateway,
    type ModalNoticeQueryClient,
} from '@/src/modules/notifications/infrastructure/browser/supabase-modal-notice-query-gateway';

type QueryCall = [string, ...unknown[]];

const createClient = (response: unknown) => {
    const calls: QueryCall[] = [];
    const query = {
        select(columns: string) {
            calls.push(['select', columns]);
            return this;
        },
        gte(column: string, value: string) {
            calls.push(['gte', column, value]);
            return this;
        },
        eq(column: string, value: boolean) {
            calls.push(['eq', column, value]);
            return this;
        },
        order(column: string, options: unknown) {
            calls.push(['order', column, options]);
            return this;
        },
        then<TResult1 = unknown, TResult2 = never>(
            onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) {
            return Promise.resolve(response).then(onfulfilled, onrejected);
        },
    };
    const client: ModalNoticeQueryClient = {
        from: jest.fn().mockReturnValue(query),
    };
    return { client, calls };
};

describe('SupabaseModalNoticeQueryGateway', () => {
    it('queries only active modal notices using a runtime-independent KST day-end cutoff', async () => {
        const { client, calls } = createClient({
            data: [{
                id: 2,
                title: '새 모달 공지',
                body: '일반',
                img: null,
                created_at: '2026-08-27T05:00:00.000Z',
                end_at: '2026-08-28T00:00:00.000Z',
            }],
            error: null,
        });
        const gateway = new SupabaseModalNoticeQueryGateway(
            client,
            () => new Date('2026-08-27T05:00:00.000Z'),
        );

        await expect(gateway.loadActive()).resolves.toEqual({
            ok: true,
            value: {
                id: 2,
                title: '새 모달 공지',
                body: '일반',
                imageUrl: null,
                createdAt: '2026-08-27T05:00:00.000Z',
                endsAt: '2026-08-28T00:00:00.000Z',
            },
        });
        expect(client.from).toHaveBeenCalledWith('notification');
        expect(calls).toContainEqual(['gte', 'end_at', '2026-08-27T14:59:59.999Z']);
        expect(calls).toContainEqual(['eq', 'is_modal', true]);
        expect(calls).toContainEqual(['order', 'created_at', { ascending: false }]);
        expect(calls).toContainEqual(['order', 'id', { ascending: false }]);
    });

    it('returns null when no active modal notice exists', async () => {
        const { client } = createClient({ data: [], error: null });
        await expect(new SupabaseModalNoticeQueryGateway(client).loadActive()).resolves.toEqual({
            ok: true,
            value: null,
        });
    });

    it.each([
        { data: null, error: { message: 'private db detail' } },
        { data: [{ id: 'bad row' }], error: null },
    ])('maps malformed or failed responses to one stable error', async (response) => {
        const { client } = createClient(response);
        const result = await new SupabaseModalNoticeQueryGateway(client).loadActive();

        expect(result).toEqual({
            ok: false,
            error: {
                kind: 'infrastructure',
                message: '공지사항을 불러오는 중 오류가 발생했습니다.',
            },
        });
        expect(JSON.stringify(result)).not.toContain('private db detail');
    });
});

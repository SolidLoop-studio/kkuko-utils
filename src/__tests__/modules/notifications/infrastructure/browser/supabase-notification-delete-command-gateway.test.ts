jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn() },
}));

import {
    SupabaseNotificationDeleteCommandGateway,
    type NotificationDeleteClient,
    type NotificationDeleteQuery,
} from '@/src/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway';

type DeleteResponse = { error: unknown };
type DeleteCall = ['from', 'notification'] | ['delete'] | ['eq', 'id', number];

const createClient = (response: unknown, shouldReject = false) => {
    const calls: DeleteCall[] = [];
    const query: NotificationDeleteQuery = {
        delete() {
            calls.push(['delete']);
            return query;
        },
        eq(column: 'id', value: number) {
            calls.push(['eq', column, value]);
            return query;
        },
        then<TResult1 = DeleteResponse, TResult2 = never>(
            onfulfilled?: ((value: DeleteResponse) => TResult1 | PromiseLike<TResult1>) | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ): PromiseLike<TResult1 | TResult2> {
            const promise = shouldReject
                ? Promise.reject(response)
                : Promise.resolve(response as DeleteResponse);
            return promise.then(onfulfilled, onrejected);
        },
    };
    const client: NotificationDeleteClient = {
        from(table: 'notification') {
            calls.push(['from', table]);
            return query;
        },
    };

    return { client, calls };
};

describe('SupabaseNotificationDeleteCommandGateway', () => {
    it('deletes one notification row by ID and returns success', async () => {
        const { client, calls } = createClient({ error: null });

        await expect(new SupabaseNotificationDeleteCommandGateway(client).deleteById(17)).resolves.toEqual({
            ok: true,
            value: undefined,
        });
        expect(calls).toEqual([
            ['from', 'notification'],
            ['delete'],
            ['eq', 'id', 17],
        ]);
    });

    it.each([
        { response: { error: { message: 'private db detail' } }, label: 'a returned database error' },
        { response: {}, label: 'a malformed response' },
    ])('maps $label to a stable infrastructure error', async ({ response }) => {
        const { client } = createClient(response);

        const result = await new SupabaseNotificationDeleteCommandGateway(client).deleteById(17);

        expect(result).toEqual({
            ok: false,
            error: {
                kind: 'infrastructure',
                message: '공지사항 삭제에 실패했습니다.',
            },
        });
        expect(JSON.stringify(result)).not.toContain('private db detail');
    });

    it('maps a rejected delete query to the same stable infrastructure error', async () => {
        const { client } = createClient(new Error('private transport detail'), true);

        await expect(new SupabaseNotificationDeleteCommandGateway(client).deleteById(17)).resolves.toEqual({
            ok: false,
            error: {
                kind: 'infrastructure',
                message: '공지사항 삭제에 실패했습니다.',
            },
        });
    });
});

import {
    SupabaseServerNotificationListQueryGateway,
    type ServerNotificationListQueryClient,
} from '@/src/modules/notifications/infrastructure/server/supabase-server-notification-list-query-gateway';

const createClient = (response: unknown): ServerNotificationListQueryClient => {
    const query = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then<TResult1 = unknown, TResult2 = never>(
            onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) {
            return Promise.resolve(response).then(onfulfilled, onrejected);
        },
    };
    return { from: jest.fn().mockReturnValue(query) };
};

describe('SupabaseServerNotificationListQueryGateway', () => {
    it('implements the same active projection contract as the browser adapter', async () => {
        const gateway = new SupabaseServerNotificationListQueryGateway(
            createClient({
                data: [{
                    id: 8,
                    title: '서버 공지',
                    body: '본문',
                    img: null,
                    created_at: '2026-08-27T01:00:00.000Z',
                    end_at: '2026-08-30T00:00:00.000Z',
                    is_important: false,
                    is_modal: false,
                }],
                error: null,
            }),
            () => new Date('2026-08-27T15:30:00.000Z'),
        );

        await expect(gateway.loadActive()).resolves.toEqual({
            ok: true,
            value: {
                notifications: [{
                    id: 8,
                    title: '서버 공지',
                    createdAt: '2026-08-27T01:00:00.000Z',
                    isImportant: false,
                }],
                modalNotice: null,
            },
        });
    });

    it('can be imported without evaluating the browser Supabase client', () => {
        jest.resetModules();
        jest.doMock('../../../../../shared/infrastructure/supabase/browser-client', () => {
            throw new Error('browser-only client evaluated');
        });

        expect(() => jest.isolateModules(() => {
            require('../../../../../modules/notifications/infrastructure/server/supabase-server-notification-list-query-gateway');
        })).not.toThrow();

        jest.dontMock('../../../../../shared/infrastructure/supabase/browser-client');
    });
});

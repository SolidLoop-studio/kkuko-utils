import {
    SupabaseNotificationDetailQueryGateway,
    type NotificationDetailQueryClient,
} from '@/src/modules/notifications/infrastructure/server/supabase-notification-detail-query-gateway';

const row = {
    id: 17,
    title: '점검 안내',
    body: '점검 본문',
    img: 'https://example.com/notice.png',
    created_at: '2026-08-27T01:00:00.000Z',
    end_at: '2026-08-30T00:00:00.000Z',
    is_important: true,
    is_modal: false,
    views: 40,
};

const createClient = (response: unknown) => {
    const query = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue(response),
    };
    const client: NotificationDetailQueryClient = {
        from: jest.fn().mockReturnValue(query),
    };
    return { client, query };
};

describe('SupabaseNotificationDetailQueryGateway', () => {
    it('projects the minimum detail and edit fields without exposing the database row', async () => {
        const { client, query } = createClient({ data: row, error: null });

        await expect(new SupabaseNotificationDetailQueryGateway(client).findById(17)).resolves.toEqual({
            ok: true,
            value: {
                id: 17,
                title: '점검 안내',
                body: '점검 본문',
                imageUrl: 'https://example.com/notice.png',
                createdAt: '2026-08-27T01:00:00.000Z',
                endsAt: '2026-08-30T00:00:00.000Z',
                isImportant: true,
                isModal: false,
                views: 40,
            },
        });
        expect(client.from).toHaveBeenCalledWith('notification');
        expect(query.select).toHaveBeenCalledWith(
            'id, title, body, img, created_at, end_at, is_important, is_modal, views',
        );
        expect(query.eq).toHaveBeenCalledWith('id', 17);
        expect(query.maybeSingle).toHaveBeenCalledTimes(1);
    });

    it('distinguishes an empty row from an infrastructure failure', async () => {
        const missing = createClient({ data: null, error: null });
        const failed = createClient({
            data: null,
            error: { code: 'PGRST500', message: 'raw database detail' },
        });

        await expect(new SupabaseNotificationDetailQueryGateway(missing.client).findById(17)).resolves.toEqual({
            ok: false,
            error: { kind: 'not-found', message: '공지사항을 찾을 수 없습니다.' },
        });
        await expect(new SupabaseNotificationDetailQueryGateway(failed.client).findById(17)).resolves.toEqual({
            ok: false,
            error: { kind: 'infrastructure', message: '공지사항을 불러오는 중 오류가 발생했습니다.' },
        });
    });

    it('maps malformed views and thrown responses to the stable infrastructure error', async () => {
        const malformedRows = [
            { ...row, views: -1 },
            { ...row, views: 1.5 },
            { ...row, views: Number.MAX_SAFE_INTEGER + 1 },
            { ...row, views: '40' },
        ];
        const thrownQuery = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockRejectedValue(new Error('network raw detail')),
        };
        const thrown: NotificationDetailQueryClient = {
            from: jest.fn().mockReturnValue(thrownQuery),
        };
        const expected = {
            ok: false,
            error: { kind: 'infrastructure', message: '공지사항을 불러오는 중 오류가 발생했습니다.' },
        };

        for (const data of malformedRows) {
            const malformed = createClient({ data, error: null });

            await expect(new SupabaseNotificationDetailQueryGateway(malformed.client).findById(17)).resolves.toEqual(expected);
        }
        await expect(new SupabaseNotificationDetailQueryGateway(thrown).findById(17)).resolves.toEqual(expected);
    });

    it('can be imported without evaluating the browser Supabase client or legacy SCM', () => {
        jest.resetModules();
        jest.doMock('../../../../../shared/infrastructure/supabase/browser-client', () => {
            throw new Error('browser-only client evaluated');
        });
        jest.doMock('../../../../../app/lib/supabaseClient', () => {
            throw new Error('legacy browser SCM evaluated');
        });

        expect(() => jest.isolateModules(() => {
            require('../../../../../modules/notifications/infrastructure/server/supabase-notification-detail-query-gateway');
        })).not.toThrow();

        jest.dontMock('../../../../../shared/infrastructure/supabase/browser-client');
        jest.dontMock('../../../../../app/lib/supabaseClient');
    });
});

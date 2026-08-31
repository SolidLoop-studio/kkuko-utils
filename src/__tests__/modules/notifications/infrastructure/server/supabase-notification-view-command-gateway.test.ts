import { err, ok } from '@/src/shared/application/result';
import {
    SupabaseNotificationViewCommandGateway,
    type NotificationViewCommandClient,
} from '@/src/modules/notifications/infrastructure/server/supabase-notification-view-command-gateway';

const infrastructure = err({
    kind: 'infrastructure',
    message: '공지사항 조회 수 기록에 실패했습니다.',
});

const createClient = (response: unknown) => {
    const client: NotificationViewCommandClient = {
        rpc: jest.fn().mockResolvedValue(response),
    };
    return client;
};

describe('SupabaseNotificationViewCommandGateway', () => {
    it('records a view through the notification RPC and returns its nonnegative count', async () => {
        const client = createClient({ data: 41, error: null });
        const gateway = new SupabaseNotificationViewCommandGateway(client);

        await expect(gateway.record(17)).resolves.toEqual(ok(41));
        expect(client.rpc).toHaveBeenCalledWith('increment_notification_views', {
            p_notification_id: 17,
        });
    });

    it('maps a null RPC result to not found', async () => {
        const client = createClient({ data: null, error: null });

        await expect(new SupabaseNotificationViewCommandGateway(client).record(17)).resolves.toEqual(err({
            kind: 'not-found',
            message: '공지사항을 찾을 수 없습니다.',
        }));
    });

    it.each([1.5, -1, Number.MAX_SAFE_INTEGER + 1, '41', undefined])(
        'maps malformed RPC count %p to a safe infrastructure error',
        async (data) => {
            const client = createClient({ data, error: null });

            await expect(new SupabaseNotificationViewCommandGateway(client).record(17)).resolves.toEqual(
                infrastructure,
            );
        },
    );

    it('keeps returned and thrown Supabase failures secret', async () => {
        const returned = createClient({ data: null, error: { message: 'raw RPC failure' } });
        const thrown: NotificationViewCommandClient = {
            rpc: jest.fn().mockRejectedValue(new Error('raw network failure')),
        };

        await expect(new SupabaseNotificationViewCommandGateway(returned).record(17)).resolves.toEqual(
            infrastructure,
        );
        await expect(new SupabaseNotificationViewCommandGateway(thrown).record(17)).resolves.toEqual(
            infrastructure,
        );
    });
});

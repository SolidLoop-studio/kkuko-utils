import { DeleteNotificationService } from '@/src/modules/notifications/application/delete-notification';
import type { NotificationDeleteCommandGateway } from '@/src/modules/notifications/application/notification-delete-command-ports';
import { err, ok, type Result } from '@/src/shared/application/result';

const createGateway = (): jest.Mocked<NotificationDeleteCommandGateway> => ({
    deleteById: jest.fn<Promise<Result<void>>, [number]>(),
});

describe('DeleteNotificationService', () => {
    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
        'rejects invalid id %p before the command gateway',
        async (id) => {
            // Break caught: allowing an unsafe notification ID to reach the database command boundary.
            const gateway = createGateway();
            const service = new DeleteNotificationService(gateway);

            await expect(service.delete(id)).resolves.toEqual(err({
                kind: 'validation',
                message: '올바른 공지사항 ID가 필요합니다.',
            }));
            expect(gateway.deleteById).not.toHaveBeenCalled();
        },
    );

    it('forwards a valid notification ID and successful result', async () => {
        // Break caught: discarding a valid deletion command or changing its notification ID.
        const gateway = createGateway();
        gateway.deleteById.mockResolvedValue(ok(undefined));
        const service = new DeleteNotificationService(gateway);

        await expect(service.delete(17)).resolves.toEqual(ok(undefined));
        expect(gateway.deleteById).toHaveBeenCalledWith(17);
    });

    it('preserves an infrastructure failure Result from the command gateway', async () => {
        // Break caught: hiding a gateway deletion failure from the presentation boundary.
        const gateway = createGateway();
        const gatewayFailure = err<void>({
            kind: 'infrastructure',
            message: '공지사항 삭제에 실패했습니다.',
        });
        gateway.deleteById.mockResolvedValue(gatewayFailure);
        const service = new DeleteNotificationService(gateway);

        await expect(service.delete(17)).resolves.toEqual(gatewayFailure);
    });

    it('maps a rejected command gateway promise to a stable infrastructure error', async () => {
        // Break caught: leaking a rejected database command beyond the application boundary.
        const gateway = createGateway();
        gateway.deleteById.mockRejectedValue(new Error('private database detail'));
        const service = new DeleteNotificationService(gateway);

        await expect(service.delete(17)).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '공지사항 삭제에 실패했습니다.',
        }));
    });
});

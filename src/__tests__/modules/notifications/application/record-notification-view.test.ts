import type { NotificationViewCommandGateway } from '@/src/modules/notifications/application/notification-view-command-ports';
import { RecordNotificationViewService } from '@/src/modules/notifications/application/record-notification-view';
import { err, ok, type Result } from '@/src/shared/application/result';

describe('RecordNotificationViewService', () => {
    it('delegates a valid notification ID and returns the gateway result', async () => {
        // Break caught: a valid detail view does not reach the view command gateway.
        const gateway: NotificationViewCommandGateway = {
            record: jest.fn().mockResolvedValue(ok(41)),
        };

        await expect(new RecordNotificationViewService(gateway).record(17)).resolves.toEqual(ok(41));
        expect(gateway.record).toHaveBeenCalledWith(17);
    });

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
        'rejects invalid notification ID %p before recording a view',
        async (id) => {
            // Break caught: invalid IDs reach the database command boundary.
            const gateway: NotificationViewCommandGateway = {
                record: jest.fn().mockResolvedValue(ok(41)),
            };

            await expect(new RecordNotificationViewService(gateway).record(id)).resolves.toEqual(err({
                kind: 'validation',
                message: '올바른 공지사항 ID가 필요합니다.',
            }));
            expect(gateway.record).not.toHaveBeenCalled();
        },
    );

    it('preserves a returned gateway error', async () => {
        // Break caught: stable gateway errors are replaced at the application boundary.
        const failure: Result<number> = err({
            kind: 'infrastructure',
            message: '공지사항 조회 수 기록에 실패했습니다.',
        });
        const gateway: NotificationViewCommandGateway = {
            record: jest.fn().mockResolvedValue(failure),
        };

        await expect(new RecordNotificationViewService(gateway).record(17)).resolves.toEqual(failure);
    });

    it('normalizes a thrown gateway failure', async () => {
        // Break caught: a rejected gateway promise leaks adapter details to callers.
        const gateway: NotificationViewCommandGateway = {
            record: jest.fn().mockRejectedValue(new Error('private adapter detail')),
        };

        await expect(new RecordNotificationViewService(gateway).record(17)).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '공지사항 조회 수 기록에 실패했습니다.',
        }));
    });
});

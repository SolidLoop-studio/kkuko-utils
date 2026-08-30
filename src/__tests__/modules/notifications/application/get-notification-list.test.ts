import { GetNotificationListService } from '@/src/modules/notifications/application/get-notification-list';
import type { NotificationListQueryGateway } from '@/src/modules/notifications/application/notification-list-query-ports';
import { err, ok } from '@/src/shared/application/result';

describe('GetNotificationListService', () => {
    const notifications = [{
            id: 1,
            title: '서비스 점검',
            createdAt: '2026-08-27T00:00:00.000Z',
            isImportant: true,
        }];

    it('returns every notification from the gateway unchanged', async () => {
        const loadAll = jest.fn().mockResolvedValue(ok(notifications));
        const gateway: NotificationListQueryGateway = { loadAll };

        await expect(new GetNotificationListService(gateway).get()).resolves.toEqual(ok(notifications));
        expect(loadAll).toHaveBeenCalledTimes(1);
    });

    it('preserves a stable gateway failure', async () => {
        const failure = {
            kind: 'infrastructure' as const,
            message: '공지사항을 불러오는 중 오류가 발생했습니다.',
        };
        const gateway: NotificationListQueryGateway = {
            loadAll: jest.fn().mockResolvedValue(err(failure)),
        };

        await expect(new GetNotificationListService(gateway).get()).resolves.toEqual(err(failure));
    });
});

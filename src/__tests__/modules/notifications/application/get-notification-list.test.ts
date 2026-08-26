import { GetNotificationListService } from '@/src/modules/notifications/application/get-notification-list';
import type { NotificationListQueryGateway } from '@/src/modules/notifications/application/notification-list-query-ports';
import type { NotificationListProjection } from '@/src/modules/notifications/application/notification-list-query-types';
import { err, ok } from '@/src/shared/application/result';

describe('GetNotificationListService', () => {
    const projection: NotificationListProjection = {
        notifications: [{
            id: 1,
            title: '서비스 점검',
            createdAt: '2026-08-27T00:00:00.000Z',
            isImportant: true,
        }],
        modalNotice: {
            id: 1,
            title: '서비스 점검',
            body: '점검 안내',
            imageUrl: null,
            createdAt: '2026-08-27T00:00:00.000Z',
            endsAt: '2026-08-30T00:00:00.000Z',
        },
    };

    it('returns the gateway active-notification projection unchanged', async () => {
        const loadActive = jest.fn().mockResolvedValue(ok(projection));
        const gateway: NotificationListQueryGateway = { loadActive };

        await expect(new GetNotificationListService(gateway).get()).resolves.toEqual(ok(projection));
        expect(loadActive).toHaveBeenCalledTimes(1);
    });

    it('preserves a stable gateway failure', async () => {
        const failure = {
            kind: 'infrastructure' as const,
            message: '공지사항을 불러오는 중 오류가 발생했습니다.',
        };
        const gateway: NotificationListQueryGateway = {
            loadActive: jest.fn().mockResolvedValue(err(failure)),
        };

        await expect(new GetNotificationListService(gateway).get()).resolves.toEqual(err(failure));
    });
});

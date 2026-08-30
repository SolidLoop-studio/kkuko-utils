import { GetNotificationDetailService } from '@/src/modules/notifications/application/get-notification-detail';
import type { NotificationDetailQueryGateway } from '@/src/modules/notifications/application/notification-detail-query-ports';
import type { NotificationDetailProjection } from '@/src/modules/notifications/application/notification-detail-query-types';
import { err, ok } from '@/src/shared/application/result';

const projection: NotificationDetailProjection = {
    id: 17,
    title: '점검 안내',
    body: '점검 본문',
    imageUrl: null,
    createdAt: '2026-08-27T01:00:00.000Z',
    endsAt: '2026-08-30T00:00:00.000Z',
    isImportant: true,
    isModal: false,
};

describe('GetNotificationDetailService', () => {
    it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
        'rejects invalid notification identity %s before querying',
        async (id) => {
            const findById = jest.fn().mockResolvedValue(ok(projection));
            const service = new GetNotificationDetailService({ findById });

            await expect(service.get(id)).resolves.toEqual({
                ok: false,
                error: {
                    kind: 'validation',
                    message: '유효한 공지사항 ID가 필요합니다.',
                    field: 'id',
                },
            });
            expect(findById).not.toHaveBeenCalled();
        },
    );

    it('returns the notification detail projection from the gateway', async () => {
        const gateway: NotificationDetailQueryGateway = {
            findById: jest.fn().mockResolvedValue(ok(projection)),
        };

        await expect(new GetNotificationDetailService(gateway).get(17)).resolves.toEqual(ok(projection));
    });

    it('normalizes a returned not-found failure without leaking adapter details', async () => {
        const gateway: NotificationDetailQueryGateway = {
            findById: jest.fn().mockResolvedValue(err({
                kind: 'not-found',
                message: 'JSON object requested, multiple rows returned',
                code: 'PGRST116',
            })),
        };

        await expect(new GetNotificationDetailService(gateway).get(17)).resolves.toEqual({
            ok: false,
            error: { kind: 'not-found', message: '공지사항을 찾을 수 없습니다.' },
        });
    });

    it('normalizes returned and thrown adapter failures to a stable infrastructure error', async () => {
        const returnedFailure: NotificationDetailQueryGateway = {
            findById: jest.fn().mockResolvedValue(err({
                kind: 'infrastructure',
                message: 'relation notification does not exist',
                code: '42P01',
            })),
        };
        const thrownFailure: NotificationDetailQueryGateway = {
            findById: jest.fn().mockRejectedValue(new Error('socket secret')),
        };
        const expected = {
            ok: false,
            error: { kind: 'infrastructure', message: '공지사항을 불러오는 중 오류가 발생했습니다.' },
        };

        await expect(new GetNotificationDetailService(returnedFailure).get(17)).resolves.toEqual(expected);
        await expect(new GetNotificationDetailService(thrownFailure).get(17)).resolves.toEqual(expected);
    });
});

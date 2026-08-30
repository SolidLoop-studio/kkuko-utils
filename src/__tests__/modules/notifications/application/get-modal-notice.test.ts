import { GetModalNoticeService } from '@/src/modules/notifications/application/get-modal-notice';
import type { ModalNoticeQueryGateway } from '@/src/modules/notifications/application/modal-notice-query-ports';
import { ok } from '@/src/shared/application/result';

describe('GetModalNoticeService', () => {
    it('returns the active modal notice from the gateway unchanged', async () => {
        const notice = {
            id: 1,
            title: '서비스 점검',
            body: '점검 안내',
            imageUrl: null,
            createdAt: '2026-08-27T00:00:00.000Z',
            endsAt: '2026-08-30T00:00:00.000Z',
        };
        const loadActive = jest.fn().mockResolvedValue(ok(notice));
        const gateway: ModalNoticeQueryGateway = { loadActive };

        await expect(new GetModalNoticeService(gateway).get()).resolves.toEqual(ok(notice));
        expect(loadActive).toHaveBeenCalledTimes(1);
    });
});

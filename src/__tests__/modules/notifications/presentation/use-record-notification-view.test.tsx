import { act, renderHook } from '@testing-library/react';

jest.mock('../../../../app/notification/actions', () => ({
    recordNotificationViewAction: jest.fn(),
}));

import { recordNotificationViewAction } from '@/src/app/notification/actions';
import { useRecordNotificationView } from '@/src/modules/notifications/presentation/use-record-notification-view';
import { err, ok } from '@/src/shared/application/result';

describe('useRecordNotificationView', () => {
    beforeEach(() => jest.clearAllMocks());

    it('records the exact ID and returns the action result', async () => {
        jest.mocked(recordNotificationViewAction).mockResolvedValue(ok(41));
        const { result } = renderHook(() => useRecordNotificationView());

        let recorded;
        await act(async () => {
            recorded = await result.current.record(17);
        });

        expect(recordNotificationViewAction).toHaveBeenCalledWith(17);
        expect(recorded).toEqual(ok(41));
    });

    it('normalizes a rejected action promise to the stable infrastructure result', async () => {
        jest.mocked(recordNotificationViewAction).mockRejectedValue(new Error('private RPC error'));
        const { result } = renderHook(() => useRecordNotificationView());

        let recorded;
        await act(async () => {
            recorded = await result.current.record(17);
        });

        expect(recorded).toEqual(err({
            kind: 'infrastructure',
            message: '공지사항 조회 수 기록에 실패했습니다.',
        }));
    });
});

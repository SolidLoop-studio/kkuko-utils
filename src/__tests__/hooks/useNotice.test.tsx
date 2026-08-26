import { renderHook } from '@testing-library/react';

jest.mock('../../modules/notifications', () => ({
    useModalNotice: jest.fn(),
}));

import { useNotice } from '@/src/app/hooks/useNotice';
import { useModalNotice } from '@/src/modules/notifications';

describe('useNotice', () => {
    it('keeps the existing provider contract while delegating to the notification module', () => {
        const dismiss = jest.fn();
        const notice = {
            id: 1,
            title: '공지',
            body: '본문',
            imageUrl: null,
            createdAt: '2026-08-27T00:00:00.000Z',
            endsAt: '2026-08-30T00:00:00.000Z',
        };
        (useModalNotice as jest.Mock).mockReturnValue({
            notice,
            isLoading: false,
            error: null,
            dismiss,
        });

        const { result } = renderHook(() => useNotice());

        expect(result.current).toEqual({
            notice: {
                id: 1,
                title: '공지',
                body: '본문',
                img: null,
                created_at: '2026-08-27T00:00:00.000Z',
                end_at: '2026-08-30T00:00:00.000Z',
            },
            showNoticeModal: true,
            closeNoticeModal: dismiss,
            loading: false,
            error: null,
        });
    });
});

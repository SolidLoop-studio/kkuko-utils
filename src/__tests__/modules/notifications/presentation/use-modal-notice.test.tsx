import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock('../../../../modules/notifications/infrastructure/browser/browser-notification-services', () => ({
    createBrowserNotificationServices: jest.fn(),
}));

import type { NotificationListProjection } from '@/src/modules/notifications/application/notification-list-query-types';
import { createBrowserNotificationServices } from '@/src/modules/notifications/infrastructure/browser/browser-notification-services';
import {
    notificationQueryKeys,
    useModalNotice,
} from '@/src/modules/notifications/presentation/use-modal-notice';
import { err, ok } from '@/src/shared/application/result';

const projection: NotificationListProjection = {
    notifications: [],
    modalNotice: {
        id: 4,
        title: '새 공지',
        body: '본문',
        imageUrl: null,
        createdAt: '2026-08-27T00:00:00.000Z',
        endsAt: '2026-08-30T00:00:00.000Z',
    },
};

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: Infinity } },
    });
    return {
        queryClient,
        QueryWrapper: ({ children }: PropsWithChildren) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
    };
};

describe('useModalNotice', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    it('shares one fresh cached projection across modal consumers', async () => {
        const get = jest.fn().mockResolvedValue(ok(projection));
        (createBrowserNotificationServices as jest.Mock).mockReturnValue({ notificationListQueryService: { get } });
        const { queryClient, QueryWrapper } = createWrapper();
        const first = renderHook(() => useModalNotice(), { wrapper: QueryWrapper });

        await waitFor(() => expect(first.result.current.notice).toEqual(projection.modalNotice));
        const second = renderHook(() => useModalNotice(), { wrapper: QueryWrapper });
        await waitFor(() => expect(second.result.current.notice).toEqual(projection.modalNotice));

        expect(get).toHaveBeenCalledTimes(1);
        expect(queryClient.getQueryData(notificationQueryKeys.activeList)).toEqual(projection);
    });

    it('does not select the latest modal when its id is in the existing hiddenNotices scope', async () => {
        localStorage.setItem('hiddenNotices', JSON.stringify([4]));
        const get = jest.fn().mockResolvedValue(ok(projection));
        (createBrowserNotificationServices as jest.Mock).mockReturnValue({ notificationListQueryService: { get } });
        const { QueryWrapper } = createWrapper();
        const { result } = renderHook(() => useModalNotice(), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.notice).toBeNull();
    });

    it('preserves cached data after a background failure and does not reopen the dismissed modal', async () => {
        const get = jest.fn()
            .mockResolvedValueOnce(ok(projection))
            .mockResolvedValueOnce(err({
                kind: 'infrastructure',
                message: '공지사항을 불러오는 중 오류가 발생했습니다.',
            }));
        (createBrowserNotificationServices as jest.Mock).mockReturnValue({ notificationListQueryService: { get } });
        const { queryClient, QueryWrapper } = createWrapper();
        const { result } = renderHook(() => useModalNotice(), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.notice?.id).toBe(4));
        act(() => result.current.dismiss());
        await act(async () => {
            await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.activeList });
        });

        expect(get).toHaveBeenCalledTimes(2);
        expect(queryClient.getQueryData(notificationQueryKeys.activeList)).toEqual(projection);
        expect(result.current.notice).toBeNull();
        await waitFor(() => expect(result.current.error).toEqual({
                kind: 'infrastructure',
                message: '공지사항을 불러오는 중 오류가 발생했습니다.',
            }));
    });
});

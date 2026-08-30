import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/admin-dashboard/infrastructure/browser/browser-admin-dashboard-services',
    () => ({ createBrowserAdminDashboardServices: jest.fn() }),
);

import type { AdminDashboardSummary } from '@/src/modules/admin-dashboard/application/admin-dashboard-query-types';
import { createBrowserAdminDashboardServices } from '@/src/modules/admin-dashboard/infrastructure/browser/browser-admin-dashboard-services';
import { adminDashboardQueryKeys } from '@/src/modules/admin-dashboard/presentation/admin-dashboard-query-keys';
import { useAdminDashboardSummary } from '@/src/modules/admin-dashboard/presentation/use-admin-dashboard-summary';
import { err, ok, type Result } from '@/src/shared/application/result';

const summary: AdminDashboardSummary = {
    totalWords: 321,
    pendingWordChanges: 4,
};

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: 3, retryDelay: 0, gcTime: Infinity } },
    });
    const QueryWrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { queryClient, QueryWrapper };
};

const mockService = (
    handler: () => Promise<Result<AdminDashboardSummary>>,
) => {
    const get = jest.fn(handler);
    jest.mocked(createBrowserAdminDashboardServices).mockReturnValue({
        adminDashboardSummaryService: { get },
    } as unknown as ReturnType<typeof createBrowserAdminDashboardServices>);
    return get;
};

describe('useAdminDashboardSummary', () => {
    test('unwraps and caches the projection under the stable summary key', async () => {
        // Break caught: exposing Result to AdminPage or caching the counts under an unstable key.
        const get = mockService(async () => ok(summary));
        const { queryClient, QueryWrapper } = createWrapper();
        const { result } = renderHook(() => useAdminDashboardSummary(), {
            wrapper: QueryWrapper,
        });

        await waitFor(() => expect(result.current.data).toEqual(summary));
        expect(get).toHaveBeenCalledTimes(1);
        expect(adminDashboardQueryKeys.summary()).toEqual(['admin-dashboard', 'summary']);
        expect(queryClient.getQueryData(adminDashboardQueryKeys.summary())).toEqual(summary);
    });

    test('exposes a returned Application failure without retrying', async () => {
        // Break caught: retrying a dashboard failure or replacing its stable public message.
        const failure = {
            kind: 'infrastructure' as const,
            message: '관리자 대시보드 정보를 불러오는 중 오류가 발생했습니다.',
        };
        const get = mockService(async () => err(failure));
        const { QueryWrapper } = createWrapper();
        const { result } = renderHook(() => useAdminDashboardSummary(), {
            wrapper: QueryWrapper,
        });

        await waitFor(() => expect(result.current.error).toEqual(failure));
        expect(get).toHaveBeenCalledTimes(1);
    });

    test('normalizes an unexpected service throw without exposing diagnostics', async () => {
        // Break caught: leaking a raw browser/database exception through the query hook.
        const get = mockService(async () => {
            throw new Error('private Supabase detail');
        });
        const { QueryWrapper } = createWrapper();
        const { result } = renderHook(() => useAdminDashboardSummary(), {
            wrapper: QueryWrapper,
        });

        await waitFor(() => expect(result.current.error).toEqual({
            kind: 'infrastructure',
            message: '관리자 대시보드 정보를 불러오는 중 오류가 발생했습니다.',
        }));
        expect(get).toHaveBeenCalledTimes(1);
    });
});

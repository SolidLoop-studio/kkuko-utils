import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/admin-logs/infrastructure/browser/browser-admin-logs-services',
    () => ({ createBrowserAdminLogsServices: jest.fn() }),
);

import type { AdminLogsInitialProjection } from '@/src/modules/admin-logs/application/admin-logs-initial-query-types';
import { createBrowserAdminLogsServices } from '@/src/modules/admin-logs/infrastructure/browser/browser-admin-logs-services';
import { useAdminLogsInitial } from '@/src/modules/admin-logs/presentation/use-admin-logs-initial';
import { err, ok, type Result } from '@/src/shared/application/result';

const projection: AdminLogsInitialProjection = {
    wordLogs: [],
    docsLogs: [],
    documentChoices: [{ id: 31, name: '주제 문서', type: 'theme' }],
};

const createQueryWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { gcTime: Infinity } },
    });
    const QueryWrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { queryClient, QueryWrapper };
};

const mockService = (handler: () => Promise<Result<AdminLogsInitialProjection>>) => {
    const get = jest.fn(handler);
    jest.mocked(createBrowserAdminLogsServices).mockReturnValue({
        adminLogsInitialQueryService: { get },
    } as unknown as ReturnType<typeof createBrowserAdminLogsServices>);
    return get;
};

describe('useAdminLogsInitial', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('loads the initial projection once under the stable admin-log cache key', async () => {
        // Break caught: bypassing the service or caching this screen under an unstable key.
        const get = mockService(async () => ok(projection));
        const { queryClient, QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useAdminLogsInitial(), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.data).toEqual(projection));
        expect(get).toHaveBeenCalledTimes(1);
        expect(queryClient.getQueryData(['admin-logs', 'initial'])).toEqual(projection);
    });

    test('exposes a stable service failure without retrying', async () => {
        // Break caught: retrying the three-query initial load or hiding its safe Application error.
        const failure = {
            kind: 'infrastructure' as const,
            message: '관리자 로그를 불러오는 중 오류가 발생했습니다.',
        };
        const get = mockService(async () => err(failure));
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useAdminLogsInitial(), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual(failure));
        expect(get).toHaveBeenCalledTimes(1);
    });

    test('normalizes an unexpected service throw before exposing it', async () => {
        // Break caught: leaking an unexpected raw service exception through the hook.
        const get = mockService(async () => {
            throw new Error('private database detail');
        });
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useAdminLogsInitial(), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual({
            kind: 'infrastructure',
            message: '관리자 로그를 불러오는 중 오류가 발생했습니다.',
        }));
        expect(get).toHaveBeenCalledTimes(1);
    });
});

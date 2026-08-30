import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/admin-logs/infrastructure/browser/browser-admin-logs-services',
    () => ({ createBrowserAdminLogsServices: jest.fn() }),
);

import type {
    AdminLogsPageProjection,
    AdminLogsPageQuery,
} from '@/src/modules/admin-logs/application/admin-logs-page-query-types';
import { createBrowserAdminLogsServices } from '@/src/modules/admin-logs/infrastructure/browser/browser-admin-logs-services';
import { adminLogsQueryKeys } from '@/src/modules/admin-logs/presentation/admin-logs-query-keys';
import { useAdminLogsPage } from '@/src/modules/admin-logs/presentation/use-admin-logs-page';
import { err, ok, type Result } from '@/src/shared/application/result';

const query: AdminLogsPageQuery = {
    page: 2,
    pageSize: 150,
    fromDate: '2026-08-01T00:00:00.000Z',
    toDate: '2026-08-31T23:59:59.999Z',
    filter: { kind: 'docs', documentName: '주제 문서', type: 'delete' },
};

const projection: AdminLogsPageProjection = {
    kind: 'docs',
    items: [{
        id: 21,
        word: '다라',
        documentName: '주제 문서',
        actorNickname: null,
        type: 'delete',
        occurredAt: '2026-08-28T00:00:00.000Z',
    }],
    totalCount: 151,
    page: 2,
    pageSize: 150,
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

const mockService = (handler: () => Promise<Result<AdminLogsPageProjection>>) => {
    const get = jest.fn(handler);
    jest.mocked(createBrowserAdminLogsServices).mockReturnValue({
        adminLogsPageQueryService: { get },
    } as unknown as ReturnType<typeof createBrowserAdminLogsServices>);
    return get;
};

describe('useAdminLogsPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('caches the unwrapped projection under every filter, page, and date input', async () => {
        // Break caught: omitting a query input from the cache key or exposing Result to the component.
        const get = mockService(async () => ok(projection));
        const { queryClient, QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useAdminLogsPage(query), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.data).toEqual(projection));
        expect(get).toHaveBeenCalledWith(query);
        expect(queryClient.getQueryData(adminLogsQueryKeys.page(query))).toEqual(projection);
        expect(adminLogsQueryKeys.page(query)).toEqual([
            'admin-logs',
            'page',
            {
                page: 2,
                pageSize: 150,
                fromDate: '2026-08-01T00:00:00.000Z',
                toDate: '2026-08-31T23:59:59.999Z',
                filter: { kind: 'docs', documentName: '주제 문서', type: 'delete' },
            },
        ]);
    });

    test('exposes a returned Application failure without retrying', async () => {
        // Break caught: retrying a page query or replacing its stable Application error.
        const failure = {
            kind: 'validation' as const,
            message: '올바른 관리자 로그 조회 조건이 필요합니다.',
        };
        const get = mockService(async () => err(failure));
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useAdminLogsPage(query), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual(failure));
        expect(get).toHaveBeenCalledTimes(1);
    });

    test('normalizes an unexpected service throw to one stable public error', async () => {
        // Break caught: leaking an unexpected raw exception through the page hook.
        const get = mockService(async () => {
            throw new Error('private database detail');
        });
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useAdminLogsPage(query), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual({
            kind: 'infrastructure',
            message: '관리자 로그를 불러오는 중 오류가 발생했습니다.',
        }));
        expect(get).toHaveBeenCalledTimes(1);
    });
});

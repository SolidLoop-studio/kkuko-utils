import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/word-logs/infrastructure/browser/browser-word-log-services',
    () => ({ createBrowserWordLogServices: jest.fn() }),
);

import type {
    WordLogPageProjection,
    WordLogPageQuery,
} from '@/src/modules/word-logs/application/word-log-query-types';
import { createBrowserWordLogServices } from '@/src/modules/word-logs/infrastructure/browser/browser-word-log-services';
import { wordLogQueryKeys } from '@/src/modules/word-logs/presentation/word-log-query-keys';
import { useWordLogPage } from '@/src/modules/word-logs/presentation/use-word-log-page';
import { err, ok, type Result } from '@/src/shared/application/result';

const query: WordLogPageQuery = {
    page: 2,
    pageSize: 30,
    state: 'pending',
    requestType: 'delete',
};

const projection: WordLogPageProjection = {
    items: [],
    totalCount: 31,
    page: 2,
    pageSize: 30,
};

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { gcTime: Infinity } },
    });
    const QueryWrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { queryClient, QueryWrapper };
};

const mockService = (handler: () => Promise<Result<WordLogPageProjection>>) => {
    const get = jest.fn(handler);
    jest.mocked(createBrowserWordLogServices).mockReturnValue({
        wordLogPageQueryService: { get },
    } as unknown as ReturnType<typeof createBrowserWordLogServices>);
    return get;
};

describe('useWordLogPage', () => {
    test('unwraps and caches each filter/page query through React Query', async () => {
        // Break caught: omitting a query field from the cache key or exposing Result to LogsHome.
        const get = mockService(async () => ok(projection));
        const { queryClient, QueryWrapper } = createWrapper();
        const { result } = renderHook(() => useWordLogPage(query), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.data).toEqual(projection));
        expect(get).toHaveBeenCalledWith(query);
        expect(wordLogQueryKeys.page(query)).toEqual(['word-logs', 'page', query]);
        expect(queryClient.getQueryData(wordLogQueryKeys.page(query))).toEqual(projection);
    });

    test('exposes an Application error without retrying', async () => {
        // Break caught: retrying invalid queries or replacing their stable Korean error.
        const failure = {
            kind: 'validation' as const,
            message: '올바른 로그 조회 조건이 필요합니다.',
        };
        const get = mockService(async () => err(failure));
        const { QueryWrapper } = createWrapper();
        const { result } = renderHook(() => useWordLogPage(query), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual(failure));
        expect(get).toHaveBeenCalledTimes(1);
    });

    test('normalizes an unexpected service throw to the stable Korean error', async () => {
        // Break caught: leaking a raw browser/database exception through the hook.
        const get = mockService(async () => {
            throw new Error('private Supabase detail');
        });
        const { QueryWrapper } = createWrapper();
        const { result } = renderHook(() => useWordLogPage(query), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual({
            kind: 'infrastructure',
            message: '로그를 불러오는 중 오류가 발생했습니다.',
        }));
        expect(get).toHaveBeenCalledTimes(1);
    });
});

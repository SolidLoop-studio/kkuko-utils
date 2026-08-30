import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/word-requests/infrastructure/browser/browser-word-request-services',
    () => ({ createBrowserWordRequestServices: jest.fn() }),
);

import type { PublicWordRequestPageProjection } from '@/src/modules/word-requests/application/public-word-request-query-types';
import { createBrowserWordRequestServices } from '@/src/modules/word-requests/infrastructure/browser/browser-word-request-services';
import { usePublicWordRequestPage } from '@/src/modules/word-requests/presentation/use-public-word-request-page';
import { err, ok, type Result } from '@/src/shared/application/result';

const projection: PublicWordRequestPageProjection = {
    page: 2,
    pageSize: 30,
    totalCount: 31,
    items: [],
};

const createQueryWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const QueryWrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { queryClient, QueryWrapper };
};

const mockService = (
    handler: (input: { page: number; status: 'all' | 'pending' | 'approved' | 'rejected' }) => Promise<Result<PublicWordRequestPageProjection>>,
) => {
    const get = jest.fn(handler);
    jest.mocked(createBrowserWordRequestServices).mockReturnValue({
        publicWordRequestPageQueryService: { get },
    } as unknown as ReturnType<typeof createBrowserWordRequestServices>);
    return get;
};

describe('usePublicWordRequestPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('uses page and status together for the public-request query and cache key', async () => {
        // Break caught: pages or statuses share a cache entry and render another query's result.
        const get = mockService(async () => ok(projection));
        const { queryClient, QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => usePublicWordRequestPage({ page: 2, status: 'pending' }), {
            wrapper: QueryWrapper,
        });

        await waitFor(() => expect(result.current.data).toEqual(projection));
        expect(get).toHaveBeenCalledWith({ page: 2, status: 'pending' });
        expect(queryClient.getQueryData(['word-requests', 'public-page', 2, 'pending']))
            .toEqual(projection);
    });

    test('exposes a stable application failure without retrying', async () => {
        // Break caught: retries hide a public request page failure or let unsafe errors escape the hook.
        const failure = { kind: 'infrastructure' as const, message: '단어 요청 목록을 불러오는 중 오류가 발생했습니다.' };
        const get = mockService(async () => err(failure));
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => usePublicWordRequestPage({ page: 1, status: 'all' }), {
            wrapper: QueryWrapper,
        });

        await waitFor(() => expect(result.current.error).toEqual(failure));
        expect(get).toHaveBeenCalledTimes(1);
    });
});

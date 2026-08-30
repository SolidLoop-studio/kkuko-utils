import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/identity/infrastructure/browser/browser-identity-services',
    () => ({ createBrowserIdentityServices: jest.fn() }),
);

import type { ProfileProcessedRequest } from '@/src/modules/identity/application/profile-processed-requests-query-types';
import { createBrowserIdentityServices } from '@/src/modules/identity/infrastructure/browser/browser-identity-services';
import { useProfileProcessedRequests } from '@/src/modules/identity/presentation/use-profile-processed-requests';
import { err, ok, type Result } from '@/src/shared/application/result';

const processedRequests: ProfileProcessedRequest[] = [{
    id: 43,
    word: '처리단어',
    createdAt: '2026-08-27T00:00:00.000Z',
    state: 'approved',
    requestType: 'delete',
}];

const createQueryWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const QueryWrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { queryClient, QueryWrapper };
};

const mockService = (handler: (userId: string) => Promise<Result<ProfileProcessedRequest[]>>) => {
    const get = jest.fn(handler);
    jest.mocked(createBrowserIdentityServices).mockReturnValue({
        profileProcessedRequestsQueryService: { get },
    } as unknown as ReturnType<typeof createBrowserIdentityServices>);
    return get;
};

describe('useProfileProcessedRequests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('uses the trimmed maker ID for the service and processed-history cache key', async () => {
        // Break caught: splitting one profile's processed history across whitespace-variant query keys.
        const get = mockService(async () => ok(processedRequests));
        const { queryClient, QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useProfileProcessedRequests('  user-1  '), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.data).toEqual(processedRequests));
        expect(get).toHaveBeenCalledWith('user-1');
        expect(queryClient.getQueryData(['identity', 'profile-processed-requests', 'user-1'])).toEqual(processedRequests);
    });

    test('does not request processed history for a blank maker ID', async () => {
        // Break caught: issuing a profile activity query before a profile user is available.
        const get = mockService(async () => ok(processedRequests));
        const { QueryWrapper } = createQueryWrapper();
        renderHook(() => useProfileProcessedRequests('   '), { wrapper: QueryWrapper });

        await waitFor(() => expect(get).not.toHaveBeenCalled());
    });

    test('exposes a stable application failure without retrying', async () => {
        // Break caught: hiding a safe processed-history failure or retrying the tab query.
        const failure = { kind: 'infrastructure' as const, message: '처리된 요청을 불러오는 중 오류가 발생했습니다.' };
        const get = mockService(async () => err(failure));
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useProfileProcessedRequests('user-1'), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual(failure));
        expect(get).toHaveBeenCalledTimes(1);
    });
});

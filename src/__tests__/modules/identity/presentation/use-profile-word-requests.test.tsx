import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/identity/infrastructure/browser/browser-identity-services',
    () => ({ createBrowserIdentityServices: jest.fn() }),
);

import type { ProfileWordRequest } from '@/src/modules/identity/application/profile-word-requests-query-types';
import { createBrowserIdentityServices } from '@/src/modules/identity/infrastructure/browser/browser-identity-services';
import { useProfileWordRequests } from '@/src/modules/identity/presentation/use-profile-word-requests';
import { err, ok, type Result } from '@/src/shared/application/result';

const wordRequests: ProfileWordRequest[] = [{
    id: 42,
    word: '테스트단어',
    requestType: 'add',
    requestedAt: '2026-08-27T00:00:00.000Z',
    status: 'pending',
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

const mockService = (handler: (userId: string) => Promise<Result<ProfileWordRequest[]>>) => {
    const get = jest.fn(handler);
    jest.mocked(createBrowserIdentityServices).mockReturnValue({
        profileWordRequestsQueryService: { get },
    } as unknown as ReturnType<typeof createBrowserIdentityServices>);
    return get;
};

describe('useProfileWordRequests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('uses the trimmed requester ID for the service and request-history cache key', async () => {
        // Break caught: splitting one profile's request history across whitespace-variant query keys.
        const get = mockService(async () => ok(wordRequests));
        const { queryClient, QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useProfileWordRequests('  user-1  '), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.data).toEqual(wordRequests));
        expect(get).toHaveBeenCalledWith('user-1');
        expect(queryClient.getQueryData(['identity', 'profile-word-requests', 'user-1'])).toEqual(wordRequests);
    });

    test('does not request word history for a blank requester ID', async () => {
        // Break caught: issuing a profile activity query before a profile user is available.
        const get = mockService(async () => ok(wordRequests));
        const { QueryWrapper } = createQueryWrapper();
        renderHook(() => useProfileWordRequests('   '), { wrapper: QueryWrapper });

        await waitFor(() => expect(get).not.toHaveBeenCalled());
    });

    test('exposes a stable application failure without retrying', async () => {
        // Break caught: hiding a safe request-history failure or retrying the tab query.
        const failure = { kind: 'infrastructure' as const, message: '단어 요청 내역을 불러오는 중 오류가 발생했습니다.' };
        const get = mockService(async () => err(failure));
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useProfileWordRequests('user-1'), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual(failure));
        expect(get).toHaveBeenCalledTimes(1);
    });
});

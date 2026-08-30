import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/identity/infrastructure/browser/browser-identity-services',
    () => ({ createBrowserIdentityServices: jest.fn() }),
);

import type { ProfileFavoriteDoc } from '@/src/modules/identity/application/profile-favorite-docs-query-types';
import { createBrowserIdentityServices } from '@/src/modules/identity/infrastructure/browser/browser-identity-services';
import { useProfileFavoriteDocs } from '@/src/modules/identity/presentation/use-profile-favorite-docs';
import { err, ok, type Result } from '@/src/shared/application/result';

const favoriteDocs: ProfileFavoriteDoc[] = [{
    id: 42,
    name: '테스트 문서',
    type: 'theme',
    lastUpdatedAt: '2026-08-27T00:00:00.000Z',
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

const mockService = (handler: (userId: string) => Promise<Result<ProfileFavoriteDoc[]>>) => {
    const get = jest.fn(handler);
    jest.mocked(createBrowserIdentityServices).mockReturnValue({
        profileFavoriteDocsQueryService: { get },
    } as unknown as ReturnType<typeof createBrowserIdentityServices>);
    return get;
};

describe('useProfileFavoriteDocs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('uses the trimmed user ID for the service and favorite-documents cache key', async () => {
        // Break caught: splitting one profile's favorites across whitespace-variant query keys.
        const get = mockService(async () => ok(favoriteDocs));
        const { queryClient, QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useProfileFavoriteDocs('  user-1  '), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.data).toEqual(favoriteDocs));
        expect(get).toHaveBeenCalledWith('user-1');
        expect(queryClient.getQueryData(['identity', 'profile-favorite-docs', 'user-1'])).toEqual(favoriteDocs);
    });

    test('does not request favorite documents for a blank user ID', async () => {
        // Break caught: issuing a profile activity query before a profile user is available.
        const get = mockService(async () => ok(favoriteDocs));
        const { QueryWrapper } = createQueryWrapper();
        renderHook(() => useProfileFavoriteDocs('   '), { wrapper: QueryWrapper });

        await waitFor(() => expect(get).not.toHaveBeenCalled());
    });

    test('exposes a stable application failure without retrying', async () => {
        // Break caught: hiding a safe favorite-documents failure or retrying the tab query.
        const failure = { kind: 'infrastructure' as const, message: '즐겨찾기한 문서를 불러오는 중 오류가 발생했습니다.' };
        const get = mockService(async () => err(failure));
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useProfileFavoriteDocs('user-1'), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual(failure));
        expect(get).toHaveBeenCalledTimes(1);
    });
});

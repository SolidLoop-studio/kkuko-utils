import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/identity/infrastructure/browser/browser-identity-services',
    () => ({ createBrowserIdentityServices: jest.fn() }),
);

import type { ProfileSummaryProjection } from '@/src/modules/identity/application/profile-summary-query-types';
import { createBrowserIdentityServices } from '@/src/modules/identity/infrastructure/browser/browser-identity-services';
import { useProfileSummary } from '@/src/modules/identity/presentation/use-profile-summary';
import { err, ok, type Result } from '@/src/shared/application/result';

const projection: ProfileSummaryProjection = {
    id: 'user-1',
    nickname: '테스터',
    role: 'r2',
    totalContribution: 120,
    monthlyContribution: 42,
    monthlyContributionRank: 3,
    recentMonthlyContributions: [{ month: '2026-08', contribution: 42 }],
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

const mockService = (handler: (nickname: string) => Promise<Result<ProfileSummaryProjection>>) => {
    const get = jest.fn(handler);
    jest.mocked(createBrowserIdentityServices).mockReturnValue({
        profileSummaryQueryService: { get },
    } as unknown as ReturnType<typeof createBrowserIdentityServices>);
    return get;
};

describe('useProfileSummary', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('uses a trimmed nickname for the service and profile-summary cache key', async () => {
        // Break caught: creating separate cache entries or lookup values from whitespace-only differences.
        const get = mockService(async () => ok(projection));
        const { queryClient, QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useProfileSummary('  테스터  '), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.data).toEqual(projection));
        expect(get).toHaveBeenCalledWith('테스터');
        expect(queryClient.getQueryData(['identity', 'profile-summary', '테스터'])).toEqual(projection);
    });

    test('does not request a blank nickname', async () => {
        // Break caught: sending an unbounded nickname lookup from a disabled profile route query.
        const get = mockService(async () => ok(projection));
        const { QueryWrapper } = createQueryWrapper();
        renderHook(() => useProfileSummary('   '), { wrapper: QueryWrapper });

        await waitFor(() => expect(get).not.toHaveBeenCalled());
        expect(get).not.toHaveBeenCalled();
    });

    test('exposes an application Result error without retrying', async () => {
        // Break caught: swallowing a stable summary error before ProfilePage can render it.
        const failure = { kind: 'not-found' as const, message: '사용자를 찾을 수 없습니다.' };
        const get = mockService(async () => err(failure));
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useProfileSummary('없는사용자'), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual(failure));
        expect(get).toHaveBeenCalledTimes(1);
    });

    test('maps a rejected service promise to the stable infrastructure error', async () => {
        // Break caught: rejected service details escaping React Query into the profile Modal.
        mockService(async () => {
            throw new Error('private service detail');
        });
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useProfileSummary('테스터'), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual({
            kind: 'infrastructure',
            message: '프로필 정보를 불러오는 중 오류가 발생했습니다.',
        }));
    });

    test('maps a private ApplicationError-shaped rejection to the stable infrastructure error', async () => {
        // Break caught: accepting a rejected object merely because it resembles an ApplicationError.
        mockService(async () => {
            throw { kind: 'infrastructure', message: 'private database detail' };
        });
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useProfileSummary('테스터'), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual({
            kind: 'infrastructure',
            message: '프로필 정보를 불러오는 중 오류가 발생했습니다.',
        }));
    });

    test('keeps distinct nicknames in distinct cache entries', async () => {
        // Break caught: reusing one public profile projection for another nickname.
        mockService(async (nickname) => ok({ ...projection, id: nickname, nickname }));
        const { queryClient, QueryWrapper } = createQueryWrapper();
        const { result, rerender } = renderHook(
            ({ nickname }: { nickname: string }) => useProfileSummary(nickname),
            { initialProps: { nickname: '첫번째' }, wrapper: QueryWrapper },
        );

        await waitFor(() => expect(result.current.data?.id).toBe('첫번째'));
        rerender({ nickname: '두번째' });
        await waitFor(() => expect(result.current.data?.id).toBe('두번째'));

        expect(queryClient.getQueryData(['identity', 'profile-summary', '첫번째']))
            .toMatchObject({ id: '첫번째' });
        expect(queryClient.getQueryData(['identity', 'profile-summary', '두번째']))
            .toMatchObject({ id: '두번째' });
    });
});

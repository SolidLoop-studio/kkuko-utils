import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/admin-users/infrastructure/browser/browser-admin-user-services',
    () => ({ createBrowserAdminUserServices: jest.fn() }),
);

import type {
    AdminUserListItem,
    AdminUserListSort,
} from '@/src/modules/admin-users/application/admin-user-list-types';
import { createBrowserAdminUserServices } from '@/src/modules/admin-users/infrastructure/browser/browser-admin-user-services';
import { adminUserQueryKeys } from '@/src/modules/admin-users/presentation/admin-user-query-keys';
import { useAdminUserList } from '@/src/modules/admin-users/presentation/use-admin-user-list';
import { err, ok, type Result } from '@/src/shared/application/result';

const contributionSort: AdminUserListSort = { field: 'contribution', direction: 'desc' };
const nicknameSort: AdminUserListSort = { field: 'nickname', direction: 'asc' };
const projection: AdminUserListItem[] = [{
    id: 'user-1',
    nickname: '끝말잇기',
    role: 'admin',
    contribution: 1200,
    monthContribution: 34,
}];

const createQueryWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { gcTime: Infinity } },
    });
    const QueryWrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { queryClient, QueryWrapper };
};

const mockService = (handler: () => Promise<Result<AdminUserListItem[]>>) => {
    const get = jest.fn(handler);
    jest.mocked(createBrowserAdminUserServices).mockReturnValue({
        adminUserListService: { get },
    } as unknown as ReturnType<typeof createBrowserAdminUserServices>);
    return get;
};

describe('useAdminUserList', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('keeps one service instance and caches each sort under a distinct query key', async () => {
        // Break caught: rebuilding browser dependencies on re-render or sharing stale results across sort inputs.
        const get = mockService(async () => ok(projection));
        const { queryClient, QueryWrapper } = createQueryWrapper();
        const { result, rerender } = renderHook(
            ({ sort }) => useAdminUserList(sort),
            { initialProps: { sort: contributionSort }, wrapper: QueryWrapper },
        );

        await waitFor(() => expect(result.current.data).toEqual(projection));
        rerender({ sort: nicknameSort });
        await waitFor(() => expect(result.current.data).toEqual(projection));

        expect(createBrowserAdminUserServices).toHaveBeenCalledTimes(1);
        expect(get).toHaveBeenNthCalledWith(1, contributionSort);
        expect(get).toHaveBeenNthCalledWith(2, nicknameSort);
        expect(adminUserQueryKeys.list(contributionSort)).toEqual([
            'admin-users',
            'list',
            { field: 'contribution', direction: 'desc' },
        ]);
        expect(queryClient.getQueryData(adminUserQueryKeys.list(nicknameSort))).toEqual(projection);
    });

    test('exposes a stable returned Application error without retrying', async () => {
        // Break caught: retrying a known query failure or replacing its stable Korean Application error.
        const failure = {
            kind: 'infrastructure' as const,
            message: '사용자 목록을 불러오는 중 오류가 발생했습니다.',
        };
        const get = mockService(async () => err(failure));
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useAdminUserList(contributionSort), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual(failure));
        expect(get).toHaveBeenCalledTimes(1);
    });

    test('refetches the current sort through the stable service', async () => {
        // Break caught: a retry action that does not issue a fresh request for the currently selected sort.
        const get = mockService(async () => ok(projection));
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useAdminUserList(contributionSort), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.data).toEqual(projection));
        await result.current.refetch();
        await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
        expect(get).toHaveBeenLastCalledWith(contributionSort);
    });
});

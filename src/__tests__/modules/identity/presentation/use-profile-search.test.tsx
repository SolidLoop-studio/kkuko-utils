import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/identity/infrastructure/browser/browser-identity-services',
    () => ({ createBrowserIdentityServices: jest.fn() }),
);

import { createBrowserIdentityServices } from '@/src/modules/identity/infrastructure/browser/browser-identity-services';
import type { ProfileSearchItem } from '@/src/modules/identity/application/profile-search-query-types';
import { useProfileSearch } from '@/src/modules/identity/presentation/use-profile-search';
import { err, ok, type Result } from '@/src/shared/application/result';

const profiles: ProfileSearchItem[] = [{
    id: 'user-1',
    nickname: '테스터',
    role: 'r2' as const,
    totalContribution: 120,
    monthlyContribution: 12,
}];

const createDeferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });
    return { promise, resolve };
};

const createMutationWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    });
    const MutationWrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { MutationWrapper };
};

const mockSearchService = (handler: (query: string) => Promise<Result<typeof profiles>>) => {
    const search = jest.fn(handler);
    jest.mocked(createBrowserIdentityServices).mockReturnValue({
        profileSearchQueryService: { search },
    } as unknown as ReturnType<typeof createBrowserIdentityServices>);
    return search;
};

describe('useProfileSearch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('forwards the submitted query and stays pending until the search resolves', async () => {
        // Break caught: starting an implicit cached query or dropping the submitted nickname.
        const deferred = createDeferred<Result<typeof profiles>>();
        const search = mockSearchService(async () => deferred.promise);
        const { MutationWrapper } = createMutationWrapper();
        const { result } = renderHook(() => useProfileSearch(), { wrapper: MutationWrapper });

        let searchResult!: Promise<Result<typeof profiles>>;
        act(() => {
            searchResult = result.current.search('  테스터  ');
        });

        await waitFor(() => expect(result.current.isPending).toBe(true));
        expect(search).toHaveBeenCalledWith('  테스터  ');

        await act(async () => {
            deferred.resolve(ok(profiles));
            await searchResult;
        });
        await waitFor(() => expect(result.current.isPending).toBe(false));
    });

    it('preserves service success and error Results', async () => {
        // Break caught: changing stable application Result semantics in the presentation hook.
        const failure = { kind: 'validation' as const, field: 'nickname', message: '검색어를 확인해주세요.' };
        const search = mockSearchService(async (query) => (
            query === '성공' ? ok(profiles) : err(failure)
        ));
        const { MutationWrapper } = createMutationWrapper();
        const { result } = renderHook(() => useProfileSearch(), { wrapper: MutationWrapper });

        let successResult: Result<typeof profiles> | undefined;
        let errorResult: Result<typeof profiles> | undefined;
        await act(async () => {
            successResult = await result.current.search('성공');
            errorResult = await result.current.search('실패');
        });

        expect(successResult).toEqual(ok(profiles));
        expect(errorResult).toEqual(err(failure));
        expect(search).toHaveBeenNthCalledWith(1, '성공');
        expect(search).toHaveBeenNthCalledWith(2, '실패');
    });

    it('converts a rejected service promise to the stable infrastructure Result', async () => {
        // Break caught: rejected query details escaping React Query into profile presentation.
        mockSearchService(async () => {
            throw new Error('private service detail');
        });
        const { MutationWrapper } = createMutationWrapper();
        const { result } = renderHook(() => useProfileSearch(), { wrapper: MutationWrapper });

        let searchResult: Result<typeof profiles> | undefined;
        await act(async () => {
            searchResult = await result.current.search('테스터');
        });

        expect(searchResult).toEqual(err({
            kind: 'infrastructure',
            message: '사용자 검색 중 오류가 발생했습니다.',
        }));
    });
});

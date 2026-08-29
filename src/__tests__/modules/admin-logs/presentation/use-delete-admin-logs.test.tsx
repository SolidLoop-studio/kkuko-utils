import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock('../../../../modules/admin-logs/infrastructure/browser/browser-admin-logs-services', () => ({
    createBrowserAdminLogsServices: jest.fn(),
}));

import type { DeleteAdminLogsCommand } from '@/src/modules/admin-logs/application/admin-log-command-ports';
import { createBrowserAdminLogsServices } from '@/src/modules/admin-logs/infrastructure/browser/browser-admin-logs-services';
import { adminLogsQueryKeys } from '@/src/modules/admin-logs/presentation/admin-logs-query-keys';
import { useDeleteAdminLogs } from '@/src/modules/admin-logs/presentation/use-delete-admin-logs';
import { docsQueryKeys } from '@/src/modules/docs/presentation/docs-query-keys';
import { identityQueryKeys } from '@/src/modules/identity/presentation/identity-query-keys';
import { wordLogQueryKeys } from '@/src/modules/word-logs/presentation/word-log-query-keys';
import { err, ok, type Result } from '@/src/shared/application/result';

type DeleteResult = Result<{ deletedIds: number[] }>;

const command: DeleteAdminLogsCommand = { kind: 'word', ids: [23, 5] };
const docsCommand: DeleteAdminLogsCommand = { kind: 'docs', ids: [17] };

const adminPageKey = adminLogsQueryKeys.page({
    page: 1,
    pageSize: 30,
    filter: { kind: 'word', state: 'all', requestType: 'all' },
});
const wordPageKey = wordLogQueryKeys.page({
    page: 1,
    pageSize: 30,
    state: 'all',
    requestType: 'all',
});
const docsLogsKey = docsQueryKeys.logs(31);
const docsInfoKey = docsQueryKeys.info(31);
const processedRequestsKey = identityQueryKeys.profileProcessedRequests('user-1');
const profileSummaryKey = identityQueryKeys.profileSummary('사용자');

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

    return {
        queryClient,
        MutationWrapper: ({ children }: PropsWithChildren) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
    };
};

const mockDeleteService = (
    handler: (nextCommand: DeleteAdminLogsCommand) => Promise<DeleteResult>,
) => {
    const execute = jest.fn(handler);
    jest.mocked(createBrowserAdminLogsServices).mockReturnValue({
        adminLogDeleteService: { execute },
    } as unknown as ReturnType<typeof createBrowserAdminLogsServices>);
    return execute;
};

const seedRelatedCaches = (queryClient: QueryClient) => {
    queryClient.setQueryData(adminPageKey, 'admin-page');
    queryClient.setQueryData(wordPageKey, 'word-page');
    queryClient.setQueryData(docsLogsKey, 'docs-logs');
    queryClient.setQueryData(docsInfoKey, 'docs-info');
    queryClient.setQueryData(processedRequestsKey, 'processed-requests');
    queryClient.setQueryData(profileSummaryKey, 'profile-summary');
};

const expectInvalidated = (queryClient: QueryClient, queryKey: readonly unknown[], expected: boolean) => {
    expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(expected);
};

describe('useDeleteAdminLogs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('coalesces overlapping word-log submissions and invalidates exactly the related cache families after success', async () => {
        // Break caught: a committed word-log delete leaving public logs/profile requests stale or invalidating docs projections.
        const deferred = createDeferred<DeleteResult>();
        const execute = mockDeleteService(async () => deferred.promise);
        const { queryClient, MutationWrapper } = createMutationWrapper();
        seedRelatedCaches(queryClient);
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useDeleteAdminLogs(), {
            wrapper: MutationWrapper,
        });

        let first!: Promise<DeleteResult>;
        let second!: Promise<DeleteResult>;
        act(() => {
            first = result.current.deleteAdminLogs(command);
            second = result.current.deleteAdminLogs(command);
        });

        expect(first).toBe(second);
        await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
        expect(execute).toHaveBeenCalledWith(command);
        expect(invalidateQueries).not.toHaveBeenCalled();
        await waitFor(() => expect(result.current.isPending).toBe(true));

        await act(async () => {
            deferred.resolve(ok({ deletedIds: [23, 5] }));
            await first;
        });

        expectInvalidated(queryClient, adminPageKey, true);
        expectInvalidated(queryClient, wordPageKey, true);
        expectInvalidated(queryClient, processedRequestsKey, true);
        expectInvalidated(queryClient, docsLogsKey, false);
        expectInvalidated(queryClient, docsInfoKey, false);
        expectInvalidated(queryClient, profileSummaryKey, false);
        await waitFor(() => expect(result.current.isPending).toBe(false));
    });

    it('invalidates exactly admin pages, docs-log projections, and processed requests after docs-log success', async () => {
        // Break caught: routing docs-log deletion through word-log invalidation or broadly invalidating all docs/identity data.
        mockDeleteService(async () => ok({ deletedIds: [...docsCommand.ids] }));
        const { queryClient, MutationWrapper } = createMutationWrapper();
        seedRelatedCaches(queryClient);
        const { result } = renderHook(() => useDeleteAdminLogs(), {
            wrapper: MutationWrapper,
        });

        await act(async () => {
            await result.current.deleteAdminLogs(docsCommand);
        });

        expectInvalidated(queryClient, adminPageKey, true);
        expectInvalidated(queryClient, docsLogsKey, true);
        expectInvalidated(queryClient, processedRequestsKey, true);
        expectInvalidated(queryClient, wordPageKey, false);
        expectInvalidated(queryClient, docsInfoKey, false);
        expectInvalidated(queryClient, profileSummaryKey, false);
    });

    it('returns a service failure without invalidating admin-log pages', async () => {
        // Break caught: treating a failed delete as committed or hiding its stable public Result.
        const failure = err<{ deletedIds: number[] }>({
            kind: 'infrastructure',
            message: '선택한 로그를 삭제하는 중 오류가 발생했습니다.',
        });
        mockDeleteService(async () => failure);
        const { queryClient, MutationWrapper } = createMutationWrapper();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useDeleteAdminLogs(), {
            wrapper: MutationWrapper,
        });

        let deletionResult: DeleteResult | undefined;
        await act(async () => {
            deletionResult = await result.current.deleteAdminLogs(command);
        });

        expect(deletionResult).toEqual(failure);
        expect(invalidateQueries).not.toHaveBeenCalled();
    });

    it('does not invalidate any cache after a docs-log service failure', async () => {
        // Break caught: kind-aware invalidation running before a docs deletion has committed.
        const failure = err<{ deletedIds: number[] }>({
            kind: 'infrastructure',
            message: '선택한 로그를 삭제하는 중 오류가 발생했습니다.',
        });
        mockDeleteService(async () => failure);
        const { queryClient, MutationWrapper } = createMutationWrapper();
        seedRelatedCaches(queryClient);
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useDeleteAdminLogs(), {
            wrapper: MutationWrapper,
        });

        await act(async () => {
            await result.current.deleteAdminLogs(docsCommand);
        });

        expect(invalidateQueries).not.toHaveBeenCalled();
        expectInvalidated(queryClient, adminPageKey, false);
        expectInvalidated(queryClient, docsLogsKey, false);
        expectInvalidated(queryClient, processedRequestsKey, false);
    });

    it('normalizes a rejected service promise without invalidating admin-log pages', async () => {
        // Break caught: exposing a rejected command promise or private database diagnostics.
        mockDeleteService(async () => {
            throw new Error('private database detail');
        });
        const { queryClient, MutationWrapper } = createMutationWrapper();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useDeleteAdminLogs(), {
            wrapper: MutationWrapper,
        });

        let deletionResult: DeleteResult | undefined;
        await act(async () => {
            deletionResult = await result.current.deleteAdminLogs(command);
        });

        expect(deletionResult).toEqual(err({
            kind: 'infrastructure',
            message: '선택한 로그를 삭제하는 중 오류가 발생했습니다.',
        }));
        expect(JSON.stringify(deletionResult)).not.toContain('private');
        expect(invalidateQueries).not.toHaveBeenCalled();
    });
});

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
import { err, ok, type Result } from '@/src/shared/application/result';

type DeleteResult = Result<{ deletedIds: number[] }>;

const command: DeleteAdminLogsCommand = { kind: 'word', ids: [23, 5] };

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

describe('useDeleteAdminLogs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('coalesces overlapping submissions and invalidates admin-log pages after success', async () => {
        // Break caught: duplicate clicks issuing multiple deletes or leaving Task 2 page caches stale.
        const deferred = createDeferred<DeleteResult>();
        const execute = mockDeleteService(async () => deferred.promise);
        const { queryClient, MutationWrapper } = createMutationWrapper();
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

        expect(invalidateQueries).toHaveBeenCalledWith({
            queryKey: adminLogsQueryKeys.pages,
        });
        await waitFor(() => expect(result.current.isPending).toBe(false));
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

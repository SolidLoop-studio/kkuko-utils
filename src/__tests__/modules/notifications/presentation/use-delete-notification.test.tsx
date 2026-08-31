import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock('../../../../app/notification/actions', () => ({
    deleteNotificationAction: jest.fn(),
}));

import { deleteNotificationAction } from '@/src/app/notification/actions';
import { notificationQueryKeys } from '@/src/modules/notifications/presentation/notification-query-keys';
import { useDeleteNotification } from '@/src/modules/notifications/presentation/use-delete-notification';
import { err, ok, type Result } from '@/src/shared/application/result';

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

const mockDeleteAction = (handler: (id: number) => Promise<Result<void>>) => {
    const deleteById = jest.fn(handler);
    jest.mocked(deleteNotificationAction).mockImplementation(deleteById);
    return deleteById;
};

describe('useDeleteNotification', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('forwards the exact ID, stays pending, and invalidates the active list after success', async () => {
        const deferred = createDeferred<Result<void>>();
        const deleteById = mockDeleteAction(async () => deferred.promise);
        const { queryClient, MutationWrapper } = createMutationWrapper();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useDeleteNotification(), {
            wrapper: MutationWrapper,
        });

        let deletion!: Promise<Result<void>>;
        act(() => {
            deletion = result.current.deleteNotification(17);
        });

        await waitFor(() => expect(result.current.isPending).toBe(true));
        expect(deleteById).toHaveBeenCalledWith(17);
        expect(invalidateQueries).not.toHaveBeenCalled();

        let deletionResult: Result<void> | undefined;
        await act(async () => {
            deferred.resolve(ok(undefined));
            deletionResult = await deletion;
        });

        expect(deletionResult).toEqual(ok(undefined));
        expect(invalidateQueries).toHaveBeenCalledWith({
            queryKey: notificationQueryKeys.activeList,
        });
        await waitFor(() => expect(result.current.isPending).toBe(false));
    });

    it('does not invalidate the active list when the service returns an error Result', async () => {
        const failure = {
            kind: 'forbidden' as const,
            message: '공지사항 삭제 권한이 없습니다.',
        };
        mockDeleteAction(async () => err(failure));
        const { queryClient, MutationWrapper } = createMutationWrapper();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useDeleteNotification(), {
            wrapper: MutationWrapper,
        });

        let deletionResult: Result<void> | undefined;
        await act(async () => {
            deletionResult = await result.current.deleteNotification(17);
        });

        expect(deletionResult).toEqual(err(failure));
        expect(invalidateQueries).not.toHaveBeenCalled();
    });

    it('normalizes a rejected service promise into the stable infrastructure Result', async () => {
        mockDeleteAction(async () => {
            throw new Error('private database error');
        });
        const { queryClient, MutationWrapper } = createMutationWrapper();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useDeleteNotification(), {
            wrapper: MutationWrapper,
        });

        let deletionResult: Result<void> | undefined;
        await act(async () => {
            deletionResult = await result.current.deleteNotification(17);
        });

        expect(deletionResult).toEqual(err({
            kind: 'infrastructure',
            message: '공지사항 삭제에 실패했습니다.',
        }));
        expect(invalidateQueries).not.toHaveBeenCalled();
    });
});

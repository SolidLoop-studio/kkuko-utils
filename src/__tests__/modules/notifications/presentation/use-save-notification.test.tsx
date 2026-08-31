import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock('../../../../app/notification/actions', () => ({
    saveNotificationAction: jest.fn(),
}));

import type { SaveNotificationCommand } from '@/src/modules/notifications/application/notification-write-command-types';
import type { NotificationWriteResult } from '@/src/modules/notifications/application/notification-write-command-ports';
import { saveNotificationAction } from '@/src/app/notification/actions';
import { notificationQueryKeys } from '@/src/modules/notifications/presentation/notification-query-keys';
import { useSaveNotification } from '@/src/modules/notifications/presentation/use-save-notification';
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

const createCommand = (): SaveNotificationCommand => ({
    mode: 'create',
    title: '점검 안내',
    body: '점검 본문',
    endsAt: '2026-08-30T00:00:00.000Z',
    isImportant: true,
    isModal: false,
    imageChange: { kind: 'keep' },
});

const mockSaveAction = (
    handler: (formData: FormData) => Promise<Result<NotificationWriteResult>>,
) => {
    const save = jest.fn(handler);
    jest.mocked(saveNotificationAction).mockImplementation(save);
    return save;
};

describe('useSaveNotification', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('forwards the exact command, stays pending, and invalidates the active list after success', async () => {
        const deferred = createDeferred<Result<NotificationWriteResult>>();
        const save = mockSaveAction(async () => deferred.promise);
        const command = createCommand();
        const { queryClient, MutationWrapper } = createMutationWrapper();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useSaveNotification(), {
            wrapper: MutationWrapper,
        });

        let saving!: Promise<Result<NotificationWriteResult>>;
        act(() => {
            saving = result.current.saveNotification(command);
        });

        await waitFor(() => expect(result.current.isPending).toBe(true));
        expect(save).toHaveBeenCalledTimes(1);
        expect(save.mock.calls[0]?.[0]).toBeInstanceOf(FormData);
        expect((save.mock.calls[0]?.[0] as FormData).get('title')).toBe(command.title);
        expect(invalidateQueries).not.toHaveBeenCalled();

        await act(async () => {
            deferred.resolve(ok({ id: 17, imageUrl: null }));
            await saving;
        });

        expect(invalidateQueries).toHaveBeenCalledWith({
            queryKey: notificationQueryKeys.activeList,
        });
        await waitFor(() => expect(result.current.isPending).toBe(false));
    });

    it('does not invalidate the active list when the service returns an error Result', async () => {
        const failure = {
            kind: 'forbidden' as const,
            message: '공지사항 저장 권한이 없습니다.',
        };
        mockSaveAction(async () => err(failure));
        const { queryClient, MutationWrapper } = createMutationWrapper();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useSaveNotification(), {
            wrapper: MutationWrapper,
        });

        let saveResult: Result<NotificationWriteResult> | undefined;
        await act(async () => {
            saveResult = await result.current.saveNotification(createCommand());
        });

        expect(saveResult).toEqual(err(failure));
        expect(invalidateQueries).not.toHaveBeenCalled();
    });

    it('normalizes a rejected service promise into the stable infrastructure Result', async () => {
        mockSaveAction(async () => {
            throw new Error('private database error');
        });
        const { queryClient, MutationWrapper } = createMutationWrapper();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useSaveNotification(), {
            wrapper: MutationWrapper,
        });

        let saveResult: Result<NotificationWriteResult> | undefined;
        await act(async () => {
            saveResult = await result.current.saveNotification(createCommand());
        });

        expect(saveResult).toEqual(err({
            kind: 'infrastructure',
            message: '공지사항 저장에 실패했습니다.',
        }));
        expect(invalidateQueries).not.toHaveBeenCalled();
    });
});

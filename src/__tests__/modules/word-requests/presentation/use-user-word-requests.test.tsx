import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/word-requests/infrastructure/browser/browser-word-request-services',
    () => ({
        createBrowserWordRequestServices: jest.fn(),
    }),
);

import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import {
    UserWordRequestCommand,
    UserWordRequestResult,
    type UserWordRequestService,
    useUserWordRequests,
} from '@/src/modules/word-requests';

const deletionCommand: UserWordRequestCommand = { word: '나비' };
const cancellationCommand: UserWordRequestCommand = { word: '가방' };
const deletionResult: UserWordRequestResult = {
    requestId: 11,
    word: '나비',
    requestType: 'delete',
};
const cancellationResult: UserWordRequestResult = {
    requestId: 12,
    word: '가방',
    requestType: 'add',
};

const createDeferred = <T,>() => {
    let resolve: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });

    return { promise, resolve: (value: T) => resolve(value) };
};

const createService = (): UserWordRequestService => ({
    requestDeletion: jest.fn().mockResolvedValue(ok(deletionResult)),
    cancel: jest.fn().mockResolvedValue(ok(cancellationResult)),
});

const renderUserWordRequests = (service: UserWordRequestService) => {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    });

    function QueryClientWrapper({ children }: PropsWithChildren) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    return renderHook(() => useUserWordRequests(service), { wrapper: QueryClientWrapper });
};

describe('useUserWordRequests', () => {
    it('returns the deletion result and exposes pending while the service is unresolved', async () => {
        const deferred = createDeferred<Result<UserWordRequestResult>>();
        const service = createService();
        service.requestDeletion = jest.fn(() => deferred.promise);
        const { result } = renderUserWordRequests(service);
        let promise!: Promise<Result<UserWordRequestResult>>;

        act(() => {
            promise = result.current.requestDeletion(deletionCommand);
        });

        await waitFor(() => expect(result.current.isPending).toBe(true));
        deferred.resolve(ok(deletionResult));

        await expect(promise).resolves.toEqual(ok(deletionResult));
        await waitFor(() => expect(result.current.isPending).toBe(false));
    });

    it('dispatches cancellation commands and returns the cancellation result', async () => {
        const service = createService();
        const { result } = renderUserWordRequests(service);

        let actionResult: Result<UserWordRequestResult> | undefined;
        await act(async () => {
            actionResult = await result.current.cancel(cancellationCommand);
        });

        expect(actionResult).toEqual(ok(cancellationResult));
        expect(service.cancel).toHaveBeenCalledWith(cancellationCommand);
    });

    it('stores a returned application error', async () => {
        const validationError: ApplicationError = {
            kind: 'validation',
            field: 'word',
            message: '단어를 입력해 주세요.',
        };
        const service = createService();
        service.requestDeletion = jest.fn().mockResolvedValue(err(validationError));
        const { result } = renderUserWordRequests(service);

        await act(async () => result.current.requestDeletion(deletionCommand));

        expect(result.current.error).toEqual(validationError);
    });

    it('clears a stored application error', async () => {
        const service = createService();
        service.cancel = jest.fn().mockResolvedValue(err({
            kind: 'forbidden',
            message: '권한이 없습니다.',
        }));
        const { result } = renderUserWordRequests(service);

        await act(async () => result.current.cancel(cancellationCommand));
        act(() => result.current.clearError());

        expect(result.current.error).toBeNull();
    });

    it('converts a thrown service call to a safe infrastructure result and error', async () => {
        const service = createService();
        service.cancel = jest.fn().mockRejectedValue(new Error('sensitive database implementation detail'));
        const { result } = renderUserWordRequests(service);

        let actionResult: Result<UserWordRequestResult> | undefined;
        await act(async () => {
            actionResult = await result.current.cancel(cancellationCommand);
        });

        expect(actionResult).toEqual(err({
            kind: 'infrastructure',
            message: '단어 요청 처리 중 오류가 발생했습니다.',
        }));
        expect(result.current.error).toEqual({
            kind: 'infrastructure',
            message: '단어 요청 처리 중 오류가 발생했습니다.',
        });
    });
});

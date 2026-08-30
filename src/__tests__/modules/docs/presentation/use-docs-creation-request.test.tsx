import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/docs/infrastructure/browser/browser-docs-services',
    () => ({ createBrowserDocsServices: jest.fn() }),
);

import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { DocsCreationRequestCommand } from '@/src/modules/docs/application/docs-creation-request-types';
import { createBrowserDocsServices } from '@/src/modules/docs/infrastructure/browser/browser-docs-services';
import { useDocsCreationRequest } from '@/src/modules/docs/presentation/use-docs-creation-request';

const command: DocsCreationRequestCommand = {
    docsName: '가',
    requesterId: 'user-7',
};

const requestFailure: ApplicationError = {
    kind: 'validation',
    message: '문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
};

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

const mockCreationService = (
    handler: (requestCommand: DocsCreationRequestCommand) => Promise<Result<void>>,
) => {
    const request = jest.fn(handler);
    jest.mocked(createBrowserDocsServices).mockReturnValue({
        docsCreationRequestService: { request },
    } as unknown as ReturnType<typeof createBrowserDocsServices>);
    return request;
};

describe('useDocsCreationRequest', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns a fulfilled service Result and invalidates pending requests only on success', async () => {
        const request = mockCreationService(async () => ok(undefined));
        const { queryClient, MutationWrapper } = createMutationWrapper();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useDocsCreationRequest(), {
            wrapper: MutationWrapper,
        });

        let requestResult: Result<void> | undefined;
        await act(async () => {
            requestResult = await result.current.request(command);
        });

        expect(requestResult).toEqual(ok(undefined));
        expect(request).toHaveBeenCalledWith(command);
        expect(result.current.error).toBeNull();
        expect(invalidateQueries).toHaveBeenCalledWith({
            queryKey: ['docs', 'requests', 'pending'],
        });
    });

    it('stores a fulfilled Result error locally without invalidating pending requests', async () => {
        mockCreationService(async () => err(requestFailure));
        const { queryClient, MutationWrapper } = createMutationWrapper();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useDocsCreationRequest(), {
            wrapper: MutationWrapper,
        });

        let requestResult: Result<void> | undefined;
        await act(async () => {
            requestResult = await result.current.request(command);
        });

        expect(requestResult).toEqual(err(requestFailure));
        expect(result.current.error).toEqual(requestFailure);
        expect(invalidateQueries).not.toHaveBeenCalled();
    });

    it('converts an unexpected throw into the stable hook-local infrastructure error', async () => {
        mockCreationService(async () => {
            throw new Error('sensitive database implementation detail');
        });
        const { MutationWrapper } = createMutationWrapper();
        const { result } = renderHook(() => useDocsCreationRequest(), {
            wrapper: MutationWrapper,
        });

        let requestResult: Result<void> | undefined;
        await act(async () => {
            requestResult = await result.current.request(command);
        });

        const expectedError = {
            kind: 'infrastructure' as const,
            message: '문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
        };
        expect(requestResult).toEqual(err(expectedError));
        expect(result.current.error).toEqual(expectedError);
    });

    it('clearError resets only the hook-local error', async () => {
        mockCreationService(async () => err(requestFailure));
        const { MutationWrapper } = createMutationWrapper();
        const { result } = renderHook(() => useDocsCreationRequest(), {
            wrapper: MutationWrapper,
        });

        await act(async () => {
            await result.current.request(command);
        });
        act(() => result.current.clearError());

        expect(result.current.error).toBeNull();
    });

    it('clears an earlier error when the next submission starts', async () => {
        const deferred = createDeferred<Result<void>>();
        const request = mockCreationService(async () => err(requestFailure));
        const { MutationWrapper } = createMutationWrapper();
        const { result } = renderHook(() => useDocsCreationRequest(), {
            wrapper: MutationWrapper,
        });

        await act(async () => {
            await result.current.request(command);
        });
        expect(result.current.error).toEqual(requestFailure);

        request.mockImplementationOnce(async () => deferred.promise);
        let pendingRequest!: Promise<Result<void>>;
        act(() => {
            pendingRequest = result.current.request(command);
        });

        await waitFor(() => expect(result.current.error).toBeNull());
        await act(async () => {
            deferred.resolve(ok(undefined));
            await pendingRequest;
        });
    });

    it('is pending while the request service promise is unresolved', async () => {
        const deferred = createDeferred<Result<void>>();
        mockCreationService(async () => deferred.promise);
        const { MutationWrapper } = createMutationWrapper();
        const { result } = renderHook(() => useDocsCreationRequest(), {
            wrapper: MutationWrapper,
        });

        let pendingRequest!: Promise<Result<void>>;
        act(() => {
            pendingRequest = result.current.request(command);
        });

        await waitFor(() => expect(result.current.isPending).toBe(true));
        await act(async () => {
            deferred.resolve(ok(undefined));
            await pendingRequest;
        });
        await waitFor(() => expect(result.current.isPending).toBe(false));
    });
});

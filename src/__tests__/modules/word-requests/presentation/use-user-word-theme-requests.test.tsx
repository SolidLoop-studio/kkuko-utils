import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/word-requests/infrastructure/browser/browser-word-request-services',
    () => ({ createBrowserWordRequestServices: jest.fn() }),
);

import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { createBrowserWordRequestServices } from '@/src/modules/word-requests/infrastructure/browser/browser-word-request-services';
import {
    type RequestWordThemeChangesCommand,
    type RequestWordThemeChangesResult,
    type UserWordThemeRequestService,
    useUserWordThemeRequests,
} from '@/src/modules/word-requests';

const command: RequestWordThemeChangesCommand = {
    word: '나비',
    changes: [{ themeCode: 'A', type: 'add' }],
};
const successfulResult: RequestWordThemeChangesResult = {
    word: '나비',
    changes: [{ themeCode: 'A', themeName: '동물', type: 'add' }],
};

const createDeferred = <T,>() => {
    let resolve: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
    return { promise, resolve: (value: T) => resolve(value) };
};

const createService = (): UserWordThemeRequestService => ({
    execute: jest.fn().mockResolvedValue(ok(successfulResult)),
});

const renderThemeRequests = (service: UserWordThemeRequestService) => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    function QueryClientWrapper({ children }: PropsWithChildren) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }
    return renderHook(() => useUserWordThemeRequests(service), { wrapper: QueryClientWrapper });
};

describe('useUserWordThemeRequests', () => {
    it('uses the composed application service when none is injected', async () => {
        const execute = jest.fn().mockResolvedValue(ok(successfulResult));
        (createBrowserWordRequestServices as jest.Mock).mockReturnValue({
            userWordThemeRequestService: { execute },
        });
        const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
        function QueryClientWrapper({ children }: PropsWithChildren) {
            return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
        }
        const { result } = renderHook(() => useUserWordThemeRequests(), { wrapper: QueryClientWrapper });

        let actionResult: Result<RequestWordThemeChangesResult> | undefined;
        await act(async () => { actionResult = await result.current.requestThemeChanges(command); });

        expect(actionResult).toEqual(ok(successfulResult));
        expect(execute).toHaveBeenCalledWith(command);
    });

    it('returns the result and exposes pending while the service is unresolved', async () => {
        const deferred = createDeferred<Result<RequestWordThemeChangesResult>>();
        const service = createService();
        service.execute = jest.fn(() => deferred.promise);
        const { result } = renderThemeRequests(service);
        let promise!: Promise<Result<RequestWordThemeChangesResult>>;

        act(() => { promise = result.current.requestThemeChanges(command); });
        await waitFor(() => expect(result.current.isPending).toBe(true));
        deferred.resolve(ok(successfulResult));

        await expect(promise).resolves.toEqual(ok(successfulResult));
        await waitFor(() => expect(result.current.isPending).toBe(false));
    });

    it('stores a returned application error and clears it', async () => {
        const validationError: ApplicationError = {
            kind: 'validation', field: 'changes', message: '요청을 하나 이상 선택해 주세요.',
        };
        const service = createService();
        service.execute = jest.fn().mockResolvedValue(err(validationError));
        const { result } = renderThemeRequests(service);

        await act(async () => result.current.requestThemeChanges(command));
        expect(result.current.error).toEqual(validationError);
        act(() => result.current.clearError());
        expect(result.current.error).toBeNull();
    });

    it('converts a thrown service call to a safe infrastructure result and error', async () => {
        const service = createService();
        service.execute = jest.fn().mockRejectedValue(new Error('sensitive detail'));
        const { result } = renderThemeRequests(service);
        let actionResult: Result<RequestWordThemeChangesResult> | undefined;

        await act(async () => { actionResult = await result.current.requestThemeChanges(command); });

        expect(actionResult).toEqual(err({
            kind: 'infrastructure',
            message: '단어 주제 요청 처리 중 오류가 발생했습니다.',
        }));
        expect(result.current.error).toEqual({
            kind: 'infrastructure',
            message: '단어 주제 요청 처리 중 오류가 발생했습니다.',
        });
    });
});

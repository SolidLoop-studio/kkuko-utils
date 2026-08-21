import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/word-moderation/infrastructure/browser/browser-word-moderation-services',
    () => ({
        createBrowserWordModerationServices: jest.fn(),
    }),
);

import type { ApplicationError } from '../../../../shared/application/application-error';
import { err, ok, type Result } from '../../../../shared/application/result';
import {
    useWordRequestModeration,
    type ModerateWordRequestsCommand,
    type WordRequestModerationResult,
    type WordRequestModerationService,
} from '../../../../modules/word-moderation';

const approveCommand: ModerateWordRequestsCommand = {
    selections: [{ kind: 'word-request', requestId: 1, selectedThemeIds: [1, 2] }],
};

const rejectCommand: ModerateWordRequestsCommand = {
    selections: [{
        kind: 'theme-change',
        wordId: 2,
        changes: [{ themeId: 3, type: 'delete' }],
    }],
};

const approvedResult: WordRequestModerationResult = {
    processedWordRequestCount: 1,
    processedThemeChangeCount: 0,
    affectedDocsIds: [10],
};

const rejectedResult: WordRequestModerationResult = {
    processedWordRequestCount: 0,
    processedThemeChangeCount: 1,
    affectedDocsIds: [20],
};

const createDeferred = <T,>() => {
    let resolve: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });

    return { promise, resolve: (value: T) => resolve(value) };
};

class FakeWordRequestModerationService implements WordRequestModerationService {
    approveHandler: (
        command: ModerateWordRequestsCommand,
    ) => Promise<Result<WordRequestModerationResult>> = async () => ok(approvedResult);

    rejectHandler: (
        command: ModerateWordRequestsCommand,
    ) => Promise<Result<WordRequestModerationResult>> = async () => ok(rejectedResult);

    approve(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>> {
        return this.approveHandler(command);
    }

    reject(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>> {
        return this.rejectHandler(command);
    }
}

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    });

    function QueryClientWrapper({ children }: PropsWithChildren) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    return QueryClientWrapper;
};

describe('useWordRequestModeration', () => {
    it('approve returns the service result', async () => {
        const service = new FakeWordRequestModerationService();
        const { result } = renderHook(() => useWordRequestModeration(service), {
            wrapper: createWrapper(),
        });

        let actionResult: Result<WordRequestModerationResult> | undefined;
        await act(async () => {
            actionResult = await result.current.approve(approveCommand);
        });

        expect(actionResult).toEqual(ok(approvedResult));
    });

    it('reject returns the service result', async () => {
        const service = new FakeWordRequestModerationService();
        const { result } = renderHook(() => useWordRequestModeration(service), {
            wrapper: createWrapper(),
        });

        let actionResult: Result<WordRequestModerationResult> | undefined;
        await act(async () => {
            actionResult = await result.current.reject(rejectCommand);
        });

        expect(actionResult).toEqual(ok(rejectedResult));
    });

    it('is pending while an approval is unresolved', async () => {
        const service = new FakeWordRequestModerationService();
        const deferred = createDeferred<Result<WordRequestModerationResult>>();
        service.approveHandler = async () => deferred.promise;
        const { result } = renderHook(() => useWordRequestModeration(service), {
            wrapper: createWrapper(),
        });

        act(() => {
            void result.current.approve(approveCommand);
        });

        await waitFor(() => expect(result.current.isPending).toBe(true));
        await act(async () => deferred.resolve(ok(approvedResult)));
        await waitFor(() => expect(result.current.isPending).toBe(false));
    });

    it('exposes a failed result as an application error', async () => {
        const service = new FakeWordRequestModerationService();
        const applicationError: ApplicationError = { kind: 'conflict', message: '이미 처리된 요청입니다.' };
        service.rejectHandler = async () => err(applicationError);
        const { result } = renderHook(() => useWordRequestModeration(service), {
            wrapper: createWrapper(),
        });

        await act(async () => result.current.reject(rejectCommand));

        expect(result.current.error).toEqual(applicationError);
    });

    it('clears a previous error when a later mutation starts', async () => {
        const service = new FakeWordRequestModerationService();
        service.rejectHandler = async () => err({ kind: 'validation', message: '요청을 확인하세요.' });
        const deferred = createDeferred<Result<WordRequestModerationResult>>();
        service.approveHandler = async () => deferred.promise;
        const { result } = renderHook(() => useWordRequestModeration(service), {
            wrapper: createWrapper(),
        });

        await act(async () => result.current.reject(rejectCommand));
        expect(result.current.error).not.toBeNull();

        act(() => {
            void result.current.approve(approveCommand);
        });

        await waitFor(() => {
            expect(result.current.error).toBeNull();
            expect(result.current.isPending).toBe(true);
        });
        await act(async () => deferred.resolve(ok(approvedResult)));
    });

    it('clearError explicitly clears an application error', async () => {
        const service = new FakeWordRequestModerationService();
        service.approveHandler = async () => err({ kind: 'forbidden', message: '권한이 없습니다.' });
        const { result } = renderHook(() => useWordRequestModeration(service), {
            wrapper: createWrapper(),
        });

        await act(async () => result.current.approve(approveCommand));
        act(() => result.current.clearError());

        expect(result.current.error).toBeNull();
    });

    it('converts an unexpected exception to the safe infrastructure error', async () => {
        const service = new FakeWordRequestModerationService();
        service.rejectHandler = async () => {
            throw new Error('internal database detail');
        };
        const { result } = renderHook(() => useWordRequestModeration(service), {
            wrapper: createWrapper(),
        });

        await act(async () => result.current.reject(rejectCommand));

        expect(result.current.error).toEqual({
            kind: 'infrastructure',
            message: '요청 단어 처리 중 오류가 발생했습니다.',
        });
    });
});

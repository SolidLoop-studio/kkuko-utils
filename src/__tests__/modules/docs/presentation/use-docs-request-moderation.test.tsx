import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/docs/infrastructure/browser/browser-docs-services',
    () => ({
        createBrowserDocsServices: jest.fn(),
    }),
);

import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import {
    type ApproveDocsRequestsCommand,
    type DocsRequestModerationResult,
    type RejectDocsRequestsCommand,
    type DocsRequestModerationService,
    useDocsRequestModeration,
} from '@/src/modules/docs';

const approveCommand: ApproveDocsRequestsCommand = {
    selections: [{ requestId: 11, duem: true }],
};

const rejectCommand: RejectDocsRequestsCommand = {
    requestIds: [11, 22],
};

const approvedResult: DocsRequestModerationResult = {
    processedRequestIds: [11],
    processedRequestCount: 1,
};

const rejectedResult: DocsRequestModerationResult = {
    processedRequestIds: [11, 22],
    processedRequestCount: 2,
};

const createDeferred = <T,>() => {
    let resolve: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });

    return { promise, resolve: (value: T) => resolve(value) };
};

class FakeDocsRequestModerationService implements DocsRequestModerationService {
    readonly approvedCommands: ApproveDocsRequestsCommand[] = [];
    readonly rejectedCommands: RejectDocsRequestsCommand[] = [];

    approveHandler: (
        command: ApproveDocsRequestsCommand,
    ) => Promise<Result<DocsRequestModerationResult>> = async () => ok(approvedResult);

    rejectHandler: (
        command: RejectDocsRequestsCommand,
    ) => Promise<Result<DocsRequestModerationResult>> = async () => ok(rejectedResult);

    approve(command: ApproveDocsRequestsCommand): Promise<Result<DocsRequestModerationResult>> {
        this.approvedCommands.push(command);
        return this.approveHandler(command);
    }

    reject(command: RejectDocsRequestsCommand): Promise<Result<DocsRequestModerationResult>> {
        this.rejectedCommands.push(command);
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

describe('useDocsRequestModeration', () => {
    it('dispatches approval commands and returns the service result', async () => {
        const service = new FakeDocsRequestModerationService();
        const { result } = renderHook(() => useDocsRequestModeration(service), {
            wrapper: createWrapper(),
        });

        let actionResult: Result<DocsRequestModerationResult> | undefined;
        await act(async () => {
            actionResult = await result.current.approve(approveCommand);
        });

        expect(actionResult).toEqual(ok(approvedResult));
        expect(service.approvedCommands).toEqual([approveCommand]);
    });

    it('dispatches rejection commands and returns the service result', async () => {
        const service = new FakeDocsRequestModerationService();
        const { result } = renderHook(() => useDocsRequestModeration(service), {
            wrapper: createWrapper(),
        });

        let actionResult: Result<DocsRequestModerationResult> | undefined;
        await act(async () => {
            actionResult = await result.current.reject(rejectCommand);
        });

        expect(actionResult).toEqual(ok(rejectedResult));
        expect(service.rejectedCommands).toEqual([rejectCommand]);
    });

    it('is pending while an approval is unresolved', async () => {
        const service = new FakeDocsRequestModerationService();
        const deferred = createDeferred<Result<DocsRequestModerationResult>>();
        service.approveHandler = async () => deferred.promise;
        const { result } = renderHook(() => useDocsRequestModeration(service), {
            wrapper: createWrapper(),
        });

        act(() => {
            void result.current.approve(approveCommand);
        });

        await waitFor(() => expect(result.current.isPending).toBe(true));
        await act(async () => deferred.resolve(ok(approvedResult)));
        await waitFor(() => expect(result.current.isPending).toBe(false));
    });

    it('exposes a returned validation error', async () => {
        const service = new FakeDocsRequestModerationService();
        const validationError: ApplicationError = {
            kind: 'validation',
            field: 'requestIds',
            message: '처리할 요청이 없습니다.',
        };
        service.rejectHandler = async () => err(validationError);
        const { result } = renderHook(() => useDocsRequestModeration(service), {
            wrapper: createWrapper(),
        });

        await act(async () => result.current.reject(rejectCommand));

        expect(result.current.error).toEqual(validationError);
    });

    it('converts an unexpected exception to a safe infrastructure error', async () => {
        const service = new FakeDocsRequestModerationService();
        service.rejectHandler = async () => {
            throw new Error('sensitive database implementation detail');
        };
        const { result } = renderHook(() => useDocsRequestModeration(service), {
            wrapper: createWrapper(),
        });

        await act(async () => result.current.reject(rejectCommand));

        expect(result.current.error).toEqual({
            kind: 'infrastructure',
            message: '문서 요청 처리 중 오류가 발생했습니다.',
        });
    });

    it('clears an application error when requested', async () => {
        const service = new FakeDocsRequestModerationService();
        service.approveHandler = async () => err({
            kind: 'forbidden',
            message: '권한이 없습니다.',
        });
        const { result } = renderHook(() => useDocsRequestModeration(service), {
            wrapper: createWrapper(),
        });

        await act(async () => result.current.approve(approveCommand));
        act(() => result.current.clearError());

        expect(result.current.error).toBeNull();
    });
});

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
import { err, ok } from '../../../../shared/application/result';
import type { RawWordDeletionEntry } from '../../../../modules/word-moderation/domain/word-deletion';
import type {
    DeletionProgress,
    StoredWordDeletionJob,
    WordDeletionRunResult,
} from '../../../../modules/word-moderation/application/word-deletion-types';
import {
    useWordDeletion,
    type WordDeletionService,
} from '../../../../modules/word-moderation/presentation/use-word-deletion';

const entries: RawWordDeletionEntry[] = [{ word: '가방' }];

const progress: DeletionProgress = {
    stage: 'applying',
    completedEntries: 1,
    totalEntries: 1,
    completedBatches: 1,
    totalBatches: 1,
};

const runResult: WordDeletionRunResult = {
    operationId: 'operation-1',
    deletedWordCount: 1,
    protectedWordCount: 0,
    missingWordCount: 0,
    processedRequestCount: 1,
    affectedDocsIds: [1],
};

const pendingJob: StoredWordDeletionJob = {
    operationId: 'operation-1',
    inputHash: 'input-hash',
    entries,
    batchSize: 1,
    createdAt: '2026-08-21T00:00:00.000Z',
};

const createService = (): jest.Mocked<WordDeletionService> => ({
    start: jest.fn(async (_entries, onProgress) => {
        onProgress?.(progress);
        return ok(runResult);
    }),
    resume: jest.fn(async (_operationId, onProgress) => {
        onProgress?.(progress);
        return ok(runResult);
    }),
    cancel: jest.fn(async (_operationId: string) => ok(undefined)),
    listPending: jest.fn(async () => []),
});

const createWrapper = (queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})) => ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useWordDeletion', () => {
    it('starts the injected deletion service with the entries and progress callback', async () => {
        const service = createService();
        const { result } = renderHook(() => useWordDeletion(service), { wrapper: createWrapper() });

        await act(async () => result.current.start(entries));

        expect(service.start).toHaveBeenCalledWith(entries, expect.any(Function));
    });

    it('forwards progress and stores a successful result', async () => {
        const service = createService();
        const { result } = renderHook(() => useWordDeletion(service), { wrapper: createWrapper() });

        await act(async () => result.current.start(entries));

        expect(result.current.progress).toEqual(progress);
        expect(result.current.result).toEqual(runResult);
        expect(result.current.error).toBeNull();
    });

    it('exposes an ApplicationError without changing its kind or code', async () => {
        const service = createService();
        const applicationError: ApplicationError = {
            kind: 'conflict',
            code: 'WORD_DELETION_CONFLICT',
            message: '삭제 충돌',
        };
        service.start.mockResolvedValue(err(applicationError));
        const { result } = renderHook(() => useWordDeletion(service), { wrapper: createWrapper() });

        await act(async () => result.current.start(entries));

        expect(result.current.error).toEqual(applicationError);
    });

    it('converts an unexpected service exception to a deletion infrastructure error', async () => {
        const service = createService();
        service.start.mockRejectedValue(new Error('internal detail'));
        const { result } = renderHook(() => useWordDeletion(service), { wrapper: createWrapper() });

        await act(async () => result.current.start(entries));

        expect(result.current.error).toEqual({
            kind: 'infrastructure',
            message: '단어 삭제 작업 처리 중 오류가 발생했습니다.',
        });
    });

    it('loads pending jobs through the injected service', async () => {
        const service = createService();
        service.listPending.mockResolvedValue([pendingJob]);
        const { result } = renderHook(() => useWordDeletion(service), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.pendingJobs).toEqual([pendingJob]));

        expect(service.listPending).toHaveBeenCalledTimes(1);
    });

    it('forwards resume and cancel commands once', async () => {
        const service = createService();
        const { result } = renderHook(() => useWordDeletion(service), { wrapper: createWrapper() });

        await act(async () => result.current.resume('operation-1'));
        await act(async () => result.current.cancel('operation-1'));

        expect(service.resume).toHaveBeenCalledTimes(1);
        expect(service.resume).toHaveBeenCalledWith('operation-1', expect.any(Function));
        expect(service.cancel).toHaveBeenCalledTimes(1);
        expect(service.cancel).toHaveBeenCalledWith('operation-1');
    });

    it.each(['start', 'resume', 'cancel'] as const)(
        'invalidates deletion pending jobs after successful %s',
        async (action) => {
            const service = createService();
            const queryClient = new QueryClient({
                defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
            });
            const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
            const { result } = renderHook(() => useWordDeletion(service), {
                wrapper: createWrapper(queryClient),
            });

            await act(async () => {
                if (action === 'start') await result.current.start(entries);
                if (action === 'resume') await result.current.resume('operation-1');
                if (action === 'cancel') await result.current.cancel('operation-1');
            });

            expect(invalidateQueries).toHaveBeenCalledWith({
                queryKey: ['word-deletion', 'pending-jobs'],
            });
        },
    );

    it('clearError clears only the error', async () => {
        const service = createService();
        const applicationError: ApplicationError = { kind: 'validation', message: '입력 오류' };
        service.start.mockResolvedValue(err(applicationError));
        const { result } = renderHook(() => useWordDeletion(service), { wrapper: createWrapper() });

        await act(async () => result.current.start(entries));
        const stateBeforeClear = {
            progress: result.current.progress,
            result: result.current.result,
            pendingJobs: result.current.pendingJobs,
            isPending: result.current.isPending,
        };
        act(() => result.current.clearError());

        expect(result.current.error).toBeNull();
        expect(result.current).toMatchObject(stateBeforeClear);
    });

    it('does not resolve the default browser service when IndexedDB is unavailable', () => {
        const indexedDbDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
        Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined });
        const { createBrowserWordModerationServices } = jest.requireMock(
            '../../../../modules/word-moderation/infrastructure/browser/browser-word-moderation-services',
        ) as { createBrowserWordModerationServices: jest.Mock };

        const { result } = renderHook(() => useWordDeletion(), { wrapper: createWrapper() });

        expect(result.current.pendingJobs).toEqual([]);
        expect(createBrowserWordModerationServices).not.toHaveBeenCalled();
        if (indexedDbDescriptor === undefined) Reflect.deleteProperty(globalThis, 'indexedDB');
        else Object.defineProperty(globalThis, 'indexedDB', indexedDbDescriptor);
    });
});

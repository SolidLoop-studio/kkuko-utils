import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/word-moderation/infrastructure/browser/browser-word-moderation-services',
    () => ({
        createBrowserWordModerationServices: jest.fn(),
    }),
);

import { err, ok } from '../../../../shared/application/result';
import type { ApplicationError } from '../../../../shared/application/application-error';
import type { RawWordApprovalEntry } from '../../../../modules/word-moderation/domain/word-approval';
import type {
    ApprovalProgress,
    StoredWordApprovalJob,
    WordApprovalRunResult,
} from '../../../../modules/word-moderation/application/word-approval-types';
import {
    useWordApproval,
    type WordApprovalService,
} from '../../../../modules/word-moderation/presentation/use-word-approval';

const rawEntries: RawWordApprovalEntry[] = [
    { word: '가방', themeCodes: ['11'] },
    { word: '나비', themeCodes: ['12'] },
];

const pendingJob = (): StoredWordApprovalJob => ({
    operationId: 'operation-1',
    inputHash: 'input-hash',
    entries: rawEntries.map((entry) => ({ ...entry, noinCanUse: false })),
    batchSize: 1,
    createdAt: '2026-08-20T00:00:00.000Z',
});

const completedResult = (): WordApprovalRunResult => ({
    operationId: 'operation-1',
    approvedWordCount: 2,
    addedThemeCount: 0,
    removedThemeCount: 0,
    processedRequestCount: 2,
    affectedDocsIds: [],
});

class FakeWordApprovalService implements WordApprovalService {
    private jobs: StoredWordApprovalJob[] = [];
    startFailure: ApplicationError | null = null;

    seedPending(): void {
        this.jobs = [pendingJob()];
    }

    async start(
        entries: RawWordApprovalEntry[],
        onProgress?: (progress: ApprovalProgress) => void,
    ) {
        this.seedPending();
        if (this.startFailure !== null) {
            return err(this.startFailure);
        }

        onProgress?.({
            stage: 'completed',
            completedEntries: entries.length,
            totalEntries: entries.length,
            completedBatches: 2,
            totalBatches: 2,
        });
        this.jobs = [];
        return ok(completedResult());
    }

    async resume(
        operationId: string,
        onProgress?: (progress: ApprovalProgress) => void,
    ) {
        onProgress?.({
            stage: 'completed',
            completedEntries: 2,
            totalEntries: 2,
            completedBatches: 2,
            totalBatches: 2,
        });
        this.jobs = this.jobs.filter((job) => job.operationId !== operationId);
        return ok(completedResult());
    }

    async cancel(operationId: string) {
        this.jobs = this.jobs.filter((job) => job.operationId !== operationId);
        return ok(undefined);
    }

    async listPending(): Promise<StoredWordApprovalJob[]> {
        return this.jobs;
    }
}

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });

    return ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
};

describe('useWordApproval', () => {
    it('승인 중 progress를 갱신하고 성공 후 pending 목록을 비운다', async () => {
        const service = new FakeWordApprovalService();
        const { result } = renderHook(() => useWordApproval(service), {
            wrapper: createWrapper(),
        });

        await act(async () => {
            await result.current.start(rawEntries);
        });

        await waitFor(() => {
            expect(result.current.progress).toMatchObject({
                stage: 'completed',
                completedBatches: 2,
            });
            expect(result.current.pendingJobs).toEqual([]);
        });
    });

    it('실패한 시작 작업을 pending으로 유지하고 ApplicationError를 노출한다', async () => {
        const service = new FakeWordApprovalService();
        service.startFailure = { kind: 'infrastructure', message: 'batch failed' };
        const { result } = renderHook(() => useWordApproval(service), {
            wrapper: createWrapper(),
        });

        await act(async () => {
            await result.current.start(rawEntries);
        });

        await waitFor(() => {
            expect(result.current.error).toEqual(service.startFailure);
            expect(result.current.pendingJobs).toHaveLength(1);
        });
    });

    it('저장된 작업을 resume으로 완료하면 pending 목록을 새로 고친다', async () => {
        const service = new FakeWordApprovalService();
        service.seedPending();
        const { result } = renderHook(() => useWordApproval(service), {
            wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.pendingJobs).toHaveLength(1));
        await act(async () => {
            await result.current.resume('operation-1');
        });

        await waitFor(() => expect(result.current.pendingJobs).toEqual([]));
    });

    it('취소 후 pending 목록을 새로 고친다', async () => {
        const service = new FakeWordApprovalService();
        service.seedPending();
        const { result } = renderHook(() => useWordApproval(service), {
            wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.pendingJobs).toHaveLength(1));
        await act(async () => {
            await result.current.cancel('operation-1');
        });

        await waitFor(() => expect(result.current.pendingJobs).toEqual([]));
    });
});

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { adminDashboardQueryKeys } from '../../admin-dashboard/presentation/admin-dashboard-query-keys';
import type { ApplicationError } from '../../../shared/application/application-error';
import { err, type Result } from '../../../shared/application/result';
import type { RawWordDeletionEntry } from '../domain/word-deletion';
import { createBrowserWordModerationServices } from '../infrastructure/browser/browser-word-moderation-services';
import type {
    DeletionProgress,
    StoredWordDeletionJob,
    WordDeletionRunResult,
} from '../application/word-deletion-types';

const pendingJobsQueryKey = ['word-deletion', 'pending-jobs'] as const;

type WordDeletionAction =
    | { type: 'start'; entries: RawWordDeletionEntry[] }
    | { type: 'resume'; operationId: string }
    | { type: 'cancel'; operationId: string };

type WordDeletionActionResult = Result<WordDeletionRunResult | void>;

export interface WordDeletionService {
    start(
        entries: RawWordDeletionEntry[],
        onProgress?: (progress: DeletionProgress) => void,
    ): Promise<Result<WordDeletionRunResult>>;
    resume(
        operationId: string,
        onProgress?: (progress: DeletionProgress) => void,
    ): Promise<Result<WordDeletionRunResult>>;
    cancel(operationId: string): Promise<Result<void>>;
    listPending(): Promise<StoredWordDeletionJob[]>;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '단어 삭제 작업 처리 중 오류가 발생했습니다.',
});

/** 단어 삭제 작업과 IndexedDB 대기 작업을 화면 상태로 연결한다. */
export function useWordDeletion(service?: WordDeletionService) {
    const queryClient = useQueryClient();
    const [progress, setProgress] = useState<DeletionProgress | null>(null);
    const [error, setError] = useState<ApplicationError | null>(null);
    const [pendingJobsError, setPendingJobsError] = useState<ApplicationError | null>(null);
    const [result, setResult] = useState<WordDeletionRunResult | null>(null);
    const resolvedService = service ?? (typeof indexedDB === 'undefined'
        ? undefined
        : createBrowserWordModerationServices().wordDeletionService);

    const pendingJobsQuery = useQuery({
        queryKey: pendingJobsQueryKey,
        queryFn: async () => resolvedService?.listPending() ?? [],
        enabled: resolvedService !== undefined,
    });

    useEffect(() => {
        if (pendingJobsQuery.isError) {
            setPendingJobsError(infrastructureError());
            return;
        }

        setPendingJobsError(null);
    }, [pendingJobsQuery.errorUpdatedAt, pendingJobsQuery.isError]);

    const mutation = useMutation<WordDeletionActionResult, never, WordDeletionAction>({
        mutationFn: async (action) => {
            if (resolvedService === undefined) return err(infrastructureError());

            const onProgress = (nextProgress: DeletionProgress) => setProgress(nextProgress);

            try {
                switch (action.type) {
                    case 'start':
                        return await resolvedService.start(action.entries, onProgress);
                    case 'resume':
                        return await resolvedService.resume(action.operationId, onProgress);
                    case 'cancel':
                        return await resolvedService.cancel(action.operationId);
                }
            } catch {
                return err(infrastructureError());
            }
        },
        onMutate: () => {
            setProgress(null);
            setError(null);
            setResult(null);
        },
        onSuccess: async (actionResult, action) => {
            if (!actionResult.ok) {
                setProgress(null);
                setError(actionResult.error);
                return;
            }

            if (actionResult.value !== undefined) setResult(actionResult.value);
            if (action.type !== 'cancel') {
                await queryClient.invalidateQueries({
                    queryKey: adminDashboardQueryKeys.summary(),
                });
            }
        },
        onSettled: async () => {
            await queryClient.invalidateQueries({ queryKey: pendingJobsQueryKey });
        },
    });

    return {
        start: (entries: RawWordDeletionEntry[]) => mutation.mutateAsync({ type: 'start', entries }),
        resume: (operationId: string) => mutation.mutateAsync({ type: 'resume', operationId }),
        cancel: (operationId: string) => mutation.mutateAsync({ type: 'cancel', operationId }),
        progress,
        error: error ?? pendingJobsError,
        clearError: () => {
            setError(null);
            setPendingJobsError(null);
        },
        result,
        pendingJobs: pendingJobsQuery.data ?? [],
        isPending: mutation.isPending,
    };
}

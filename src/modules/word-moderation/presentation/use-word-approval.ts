'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '../../../shared/application/application-error';
import { err, type Result } from '../../../shared/application/result';
import type { RawWordApprovalEntry } from '../domain/word-approval';
import { createBrowserWordModerationServices } from '../infrastructure/browser/browser-word-moderation-services';
import type {
    ApprovalProgress,
    StoredWordApprovalJob,
    WordApprovalRunResult,
} from '../application/word-approval-types';

const pendingJobsQueryKey = ['word-approval', 'pending-jobs'] as const;

type WordApprovalAction =
    | { type: 'start'; entries: RawWordApprovalEntry[] }
    | { type: 'resume'; operationId: string }
    | { type: 'cancel'; operationId: string };

type WordApprovalActionResult = Result<WordApprovalRunResult | void>;

export interface WordApprovalService {
    start(
        entries: RawWordApprovalEntry[],
        onProgress?: (progress: ApprovalProgress) => void,
    ): Promise<Result<WordApprovalRunResult>>;
    resume(
        operationId: string,
        onProgress?: (progress: ApprovalProgress) => void,
    ): Promise<Result<WordApprovalRunResult>>;
    cancel(operationId: string): Promise<Result<void>>;
    listPending(): Promise<StoredWordApprovalJob[]>;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '단어 승인 작업 처리 중 오류가 발생했습니다.',
});

/** 단어 승인 작업과 IndexedDB 대기 작업을 화면 상태로 연결한다. */
export function useWordApproval(
    service: WordApprovalService = createBrowserWordModerationServices().wordApprovalService,
) {
    const queryClient = useQueryClient();
    const [progress, setProgress] = useState<ApprovalProgress | null>(null);
    const [error, setError] = useState<ApplicationError | null>(null);

    const pendingJobsQuery = useQuery({
        queryKey: pendingJobsQueryKey,
        queryFn: () => service.listPending(),
    });
    const pendingJobsError = pendingJobsQuery.isError ? infrastructureError() : null;

    const mutation = useMutation<WordApprovalActionResult, never, WordApprovalAction>({
        mutationFn: async (action) => {
            const onProgress = (nextProgress: ApprovalProgress) => {
                setProgress(nextProgress);
            };

            try {
                switch (action.type) {
                    case 'start':
                        return await service.start(action.entries, onProgress);
                    case 'resume':
                        return await service.resume(action.operationId, onProgress);
                    case 'cancel':
                        return await service.cancel(action.operationId);
                }
            } catch {
                return err(infrastructureError());
            }
        },
        onMutate: () => {
            setProgress(null);
            setError(null);
        },
        onSuccess: (result) => {
            if (!result.ok) {
                setProgress(null);
                setError(result.error);
            }
        },
        onSettled: async () => {
            await queryClient.invalidateQueries({ queryKey: pendingJobsQueryKey });
        },
    });

    return {
        start: (entries: RawWordApprovalEntry[]) => mutation.mutateAsync({ type: 'start', entries }),
        resume: (operationId: string) => mutation.mutateAsync({ type: 'resume', operationId }),
        cancel: (operationId: string) => mutation.mutateAsync({ type: 'cancel', operationId }),
        pendingJobs: pendingJobsQuery.data ?? [],
        progress,
        isProcessing: mutation.isPending,
        error: error ?? pendingJobsError,
    };
}

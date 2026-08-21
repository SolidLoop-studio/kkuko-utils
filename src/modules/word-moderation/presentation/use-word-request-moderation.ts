'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '../../../shared/application/application-error';
import { err, type Result } from '../../../shared/application/result';
import type {
    ModerateWordRequestsCommand,
    WordRequestModerationResult,
} from '../application/word-request-moderation-types';
import { createBrowserWordModerationServices } from '../infrastructure/browser/browser-word-moderation-services';

type WordRequestModerationAction =
    | { action: 'approve'; command: ModerateWordRequestsCommand }
    | { action: 'reject'; command: ModerateWordRequestsCommand };

export interface WordRequestModerationService {
    approve(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>>;
    reject(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>>;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '요청 단어 처리 중 오류가 발생했습니다.',
});

/** 단어 요청 승인 및 거부 작업을 React Query mutation 상태와 연결합니다. */
export function useWordRequestModeration(
    service?: WordRequestModerationService,
): {
    approve(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>>;
    reject(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>>;
    isPending: boolean;
    error: ApplicationError | null;
    clearError(): void;
} {
    const [error, setError] = useState<ApplicationError | null>(null);
    const resolvedService = service
        ?? createBrowserWordModerationServices().wordRequestModerationService;

    const mutation = useMutation<
        Result<WordRequestModerationResult>,
        never,
        WordRequestModerationAction
    >({
        mutationFn: async ({ action, command }) => {
            try {
                return action === 'approve'
                    ? await resolvedService.approve(command)
                    : await resolvedService.reject(command);
            } catch {
                return err(infrastructureError());
            }
        },
        onMutate: () => {
            setError(null);
        },
        onSuccess: (actionResult) => {
            if (!actionResult.ok) {
                setError(actionResult.error);
            }
        },
    });

    return {
        approve: (command) => mutation.mutateAsync({ action: 'approve', command }),
        reject: (command) => mutation.mutateAsync({ action: 'reject', command }),
        isPending: mutation.isPending,
        error,
        clearError: () => setError(null),
    };
}

'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '../../../shared/application/application-error';
import { err, type Result } from '../../../shared/application/result';
import type {
    DeleteWordDirectlyCommand,
    DeleteWordDirectlyResult,
    DocsWordMutationTarget,
} from '../application/docs-word-moderation-types';
import type { WordRequestModerationResult } from '../application/word-request-moderation-types';
import { toModerateWordRequestsCommand } from '../domain/docs-word-moderation';
import { createBrowserWordModerationServices } from '../infrastructure/browser/browser-word-moderation-services';
import type { WordRequestModerationService } from './use-word-request-moderation';

type RequestModerationTarget = Exclude<
    DocsWordMutationTarget,
    { kind: 'registered-word' }
>;

type DirectDeletionTarget = Extract<
    DocsWordMutationTarget,
    { kind: 'registered-word' }
>;

type DocsWordModerationAction =
    | { action: 'approve'; target: RequestModerationTarget }
    | { action: 'reject'; target: RequestModerationTarget }
    | { action: 'delete-directly'; target: DirectDeletionTarget };

type DocsWordModerationActionResult =
    | {
        action: 'approve' | 'reject';
        result: Result<WordRequestModerationResult>;
    }
    | {
        action: 'delete-directly';
        result: Result<DeleteWordDirectlyResult>;
    };

export interface DirectWordDeletionService {
    execute(command: DeleteWordDirectlyCommand): Promise<Result<DeleteWordDirectlyResult>>;
}

export interface DocsWordModerationServices {
    wordRequestModerationService: WordRequestModerationService;
    directWordDeletionService: DirectWordDeletionService;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '문서 단어 처리 중 오류가 발생했습니다.',
});

const invalidDirectDeletionTargetError = (): ApplicationError => ({
    kind: 'validation',
    field: 'target',
    message: '등록된 단어만 직접 삭제할 수 있습니다.',
});

/** 문서 단어 승인, 거부, 직접 삭제 작업을 하나의 mutation 상태로 연결합니다. */
export function useDocsWordModeration(
    services?: DocsWordModerationServices,
): {
    approve(target: RequestModerationTarget): Promise<Result<WordRequestModerationResult>>;
    reject(target: RequestModerationTarget): Promise<Result<WordRequestModerationResult>>;
    deleteDirectly(target: DirectDeletionTarget): Promise<Result<DeleteWordDirectlyResult>>;
    isPending: boolean;
    error: ApplicationError | null;
    clearError(): void;
} {
    const [error, setError] = useState<ApplicationError | null>(null);
    const resolvedServices = services ?? createBrowserWordModerationServices();

    const mutation = useMutation<
        DocsWordModerationActionResult,
        never,
        DocsWordModerationAction
    >({
        mutationKey: ['docs-word-moderation'],
        mutationFn: async (action) => {
            try {
                if (action.action === 'delete-directly') {
                    const result = action.target.kind === 'registered-word'
                        ? await resolvedServices.directWordDeletionService.execute({
                            wordId: action.target.wordId,
                        })
                        : err<DeleteWordDirectlyResult>(invalidDirectDeletionTargetError());

                    return { action: action.action, result };
                }

                const command = toModerateWordRequestsCommand(action.target);
                const result = command.ok
                    ? await resolvedServices.wordRequestModerationService[action.action](command.value)
                    : command;

                return { action: action.action, result };
            } catch {
                return action.action === 'delete-directly'
                    ? {
                        action: action.action,
                        result: err<DeleteWordDirectlyResult>(infrastructureError()),
                    }
                    : {
                        action: action.action,
                        result: err<WordRequestModerationResult>(infrastructureError()),
                    };
            }
        },
        onMutate: () => {
            setError(null);
        },
        onSuccess: (actionResult) => {
            if (!actionResult.result.ok) {
                setError(actionResult.result.error);
            }
        },
    });

    const moderate = async (
        action: 'approve' | 'reject',
        target: RequestModerationTarget,
    ): Promise<Result<WordRequestModerationResult>> => {
        const actionResult = await mutation.mutateAsync({ action, target });
        return actionResult.action === 'delete-directly'
            ? err(infrastructureError())
            : actionResult.result;
    };

    const deleteDirectly = async (
        target: DirectDeletionTarget,
    ): Promise<Result<DeleteWordDirectlyResult>> => {
        const actionResult = await mutation.mutateAsync({ action: 'delete-directly', target });
        return actionResult.action === 'delete-directly'
            ? actionResult.result
            : err(infrastructureError());
    };

    return {
        approve: (target) => moderate('approve', target),
        reject: (target) => moderate('reject', target),
        deleteDirectly,
        isPending: mutation.isPending,
        error,
        clearError: () => setError(null),
    };
}

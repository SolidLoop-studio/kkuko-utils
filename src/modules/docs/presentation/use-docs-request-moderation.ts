'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, type Result } from '@/src/shared/application/result';
import type {
    ApproveDocsRequestsCommand,
    DocsRequestModerationResult,
    RejectDocsRequestsCommand,
} from '../application/docs-request-moderation-types';
import { createBrowserDocsServices } from '../infrastructure/browser/browser-docs-services';

type DocsRequestModerationAction =
    | { action: 'approve'; command: ApproveDocsRequestsCommand }
    | { action: 'reject'; command: RejectDocsRequestsCommand };

export interface DocsRequestModerationService {
    approve(command: ApproveDocsRequestsCommand): Promise<Result<DocsRequestModerationResult>>;
    reject(command: RejectDocsRequestsCommand): Promise<Result<DocsRequestModerationResult>>;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '문서 요청 처리 중 오류가 발생했습니다.',
});

/** 문서 요청 승인 및 거부 작업을 React Query mutation 상태와 연결합니다. */
export function useDocsRequestModeration(
    service?: DocsRequestModerationService,
): {
    approve(command: ApproveDocsRequestsCommand): Promise<Result<DocsRequestModerationResult>>;
    reject(command: RejectDocsRequestsCommand): Promise<Result<DocsRequestModerationResult>>;
    isPending: boolean;
    error: ApplicationError | null;
    clearError(): void;
} {
    const [error, setError] = useState<ApplicationError | null>(null);
    const [resolvedService] = useState<DocsRequestModerationService>(() => (
        service ?? createBrowserDocsServices().docsRequestModerationService
    ));
    const mutation = useMutation<
        Result<DocsRequestModerationResult>,
        never,
        DocsRequestModerationAction
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

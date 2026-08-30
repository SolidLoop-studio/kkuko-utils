'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, type Result } from '@/src/shared/application/result';
import type {
    RequestWordThemeChangesCommand,
    RequestWordThemeChangesResult,
} from '../application/user-word-theme-request-types';
import { createBrowserWordRequestServices } from '../infrastructure/browser/browser-word-request-services';

export interface UserWordThemeRequestService {
    execute(
        command: RequestWordThemeChangesCommand,
    ): Promise<Result<RequestWordThemeChangesResult>>;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '단어 주제 요청 처리 중 오류가 발생했습니다.',
});

/** 사용자 주제 변경 요청을 React Query mutation 상태와 연결합니다. */
export function useUserWordThemeRequests(
    service?: UserWordThemeRequestService,
): {
    requestThemeChanges(
        command: RequestWordThemeChangesCommand,
    ): Promise<Result<RequestWordThemeChangesResult>>;
    isPending: boolean;
    error: ApplicationError | null;
    clearError(): void;
} {
    const [error, setError] = useState<ApplicationError | null>(null);
    const [resolvedService] = useState<UserWordThemeRequestService>(() => (
        service ?? createBrowserWordRequestServices().userWordThemeRequestService
    ));
    const mutation = useMutation<
        Result<RequestWordThemeChangesResult>,
        never,
        RequestWordThemeChangesCommand
    >({
        mutationFn: async (command) => {
            try {
                return await resolvedService.execute(command);
            } catch {
                return err(infrastructureError());
            }
        },
        onMutate: () => setError(null),
        onSuccess: (actionResult) => {
            if (!actionResult.ok) {
                setError(actionResult.error);
            }
        },
    });

    return {
        requestThemeChanges: (command) => mutation.mutateAsync(command),
        isPending: mutation.isPending,
        error,
        clearError: () => setError(null),
    };
}

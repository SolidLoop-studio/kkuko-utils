'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, type Result } from '@/src/shared/application/result';
import type {
    UserWordRequestCommand,
    UserWordRequestResult,
} from '../application/user-word-request-types';
import { createBrowserWordRequestServices } from '../infrastructure/browser/browser-word-request-services';

type UserWordRequestAction =
    | { action: 'request-deletion'; command: UserWordRequestCommand }
    | { action: 'cancel'; command: UserWordRequestCommand };

export interface UserWordRequestService {
    requestDeletion(command: UserWordRequestCommand): Promise<Result<UserWordRequestResult>>;
    cancel(command: UserWordRequestCommand): Promise<Result<UserWordRequestResult>>;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '단어 요청 처리 중 오류가 발생했습니다.',
});

/** 사용자 단어 삭제 요청과 요청 취소를 React Query mutation 상태와 연결합니다. */
export function useUserWordRequests(
    service?: UserWordRequestService,
): {
    requestDeletion(command: UserWordRequestCommand): Promise<Result<UserWordRequestResult>>;
    cancel(command: UserWordRequestCommand): Promise<Result<UserWordRequestResult>>;
    isPending: boolean;
    error: ApplicationError | null;
    clearError(): void;
} {
    const [error, setError] = useState<ApplicationError | null>(null);
    const [resolvedService] = useState<UserWordRequestService>(() => (
        service ?? createBrowserWordRequestServices().userWordRequestService
    ));
    const mutation = useMutation<
        Result<UserWordRequestResult>,
        never,
        UserWordRequestAction
    >({
        mutationFn: async ({ action, command }) => {
            try {
                return action === 'request-deletion'
                    ? await resolvedService.requestDeletion(command)
                    : await resolvedService.cancel(command);
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
        requestDeletion: (command) => mutation.mutateAsync({ action: 'request-deletion', command }),
        cancel: (command) => mutation.mutateAsync({ action: 'cancel', command }),
        isPending: mutation.isPending,
        error,
        clearError: () => setError(null),
    };
}

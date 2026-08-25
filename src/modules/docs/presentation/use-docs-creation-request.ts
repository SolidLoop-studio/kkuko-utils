'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, type Result } from '@/src/shared/application/result';
import type { DocsCreationRequestCommand } from '../application/docs-creation-request-types';
import type { RequestDocsCreationService } from '../application/request-docs-creation';
import { createBrowserDocsServices } from '../infrastructure/browser/browser-docs-services';
import { docsQueryKeys } from './docs-query-keys';

export type DocsCreationRequestService = Pick<RequestDocsCreationService, 'request'>;

const requestInfrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
});

/** 문서 생성 요청 mutation과 화면 전용 오류 상태를 연결합니다. */
export const useDocsCreationRequest = (): {
    request(command: DocsCreationRequestCommand): Promise<Result<void>>;
    isPending: boolean;
    error: ApplicationError | null;
    clearError(): void;
} => {
    const queryClient = useQueryClient();
    const [error, setError] = useState<ApplicationError | null>(null);
    const [resolvedService] = useState<DocsCreationRequestService>(() => (
        createBrowserDocsServices().docsCreationRequestService
    ));
    const mutation = useMutation<Result<void>, never, DocsCreationRequestCommand>({
        mutationFn: async (command) => {
            try {
                return await resolvedService.request(command);
            } catch {
                return err(requestInfrastructureError());
            }
        },
        onMutate: () => {
            setError(null);
        },
        onSuccess: async (requestResult) => {
            if (!requestResult.ok) {
                setError(requestResult.error);
                return;
            }
            await queryClient.invalidateQueries({
                queryKey: docsQueryKeys.pendingRequests,
            });
        },
    });

    return {
        request: (command) => mutation.mutateAsync(command),
        isPending: mutation.isPending,
        error,
        clearError: () => setError(null),
    };
};

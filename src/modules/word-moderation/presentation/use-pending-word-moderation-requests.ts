'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { ApplicationError } from '@/src/shared/application/application-error';
import type { Result } from '@/src/shared/application/result';
import type { GetPendingWordModerationRequestsService } from '../application/get-pending-word-moderation-requests';
import type { PendingWordModerationRequest } from '../application/pending-word-moderation-query-types';
import { createBrowserWordModerationServices } from '../infrastructure/browser/browser-word-moderation-services';

export const pendingWordModerationQueryKey = ['word-moderation', 'requests', 'pending'] as const;
export type PendingWordModerationQueryService = Pick<GetPendingWordModerationRequestsService, 'get'>;

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '단어 요청 목록을 불러오는 중 오류가 발생했습니다.',
});

const isApplicationError = (value: unknown): value is ApplicationError => {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as { kind?: unknown; message?: unknown };
    return (candidate.kind === 'validation'
        || candidate.kind === 'unauthorized'
        || candidate.kind === 'forbidden'
        || candidate.kind === 'not-found'
        || candidate.kind === 'conflict'
        || candidate.kind === 'infrastructure')
        && typeof candidate.message === 'string';
};

const unwrapQuery = async <T>(operation: () => Promise<Result<T>>): Promise<T> => {
    try {
        const result = await operation();
        if (!result.ok) throw result.error;
        return result.value;
    } catch (error) {
        throw isApplicationError(error) ? error : infrastructureError();
    }
};

/** 대기 단어 moderation 목록을 React Query cache와 연결합니다. */
export const usePendingWordModerationRequests = () => {
    const [service] = useState<PendingWordModerationQueryService>(() => (
        createBrowserWordModerationServices().pendingWordModerationQueryService
    ));

    return useQuery<PendingWordModerationRequest[], ApplicationError>({
        queryKey: pendingWordModerationQueryKey,
        queryFn: () => unwrapQuery(() => service.get()),
        retry: (failureCount, error) => error.kind === 'infrastructure' && failureCount < 3,
    });
};

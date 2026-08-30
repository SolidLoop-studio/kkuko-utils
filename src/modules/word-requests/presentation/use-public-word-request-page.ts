'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { ApplicationError } from '@/src/shared/application/application-error';
import type { Result } from '@/src/shared/application/result';
import type { GetPublicWordRequestPageService } from '../application/get-public-word-request-page';
import type {
    PublicWordRequestPageProjection,
    PublicWordRequestQueryInput,
} from '../application/public-word-request-query-types';
import { createBrowserWordRequestServices } from '../infrastructure/browser/browser-word-request-services';
import { wordRequestQueryKeys } from './word-request-query-keys';

export type PublicWordRequestPageQueryService = Pick<GetPublicWordRequestPageService, 'get'>;

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

const unwrapPage = async (
    operation: () => Promise<Result<PublicWordRequestPageProjection>>,
): Promise<PublicWordRequestPageProjection> => {
    try {
        const result = await operation();
        if (!result.ok) throw result.error;
        return result.value;
    } catch (error) {
        throw isApplicationError(error) ? error : infrastructureError();
    }
};

/** 공개 단어 요청 페이지 projection을 React Query cache와 연결합니다. */
export const usePublicWordRequestPage = (
    input: PublicWordRequestQueryInput,
): UseQueryResult<PublicWordRequestPageProjection, ApplicationError> => {
    const [service] = useState<PublicWordRequestPageQueryService>(() => (
        createBrowserWordRequestServices().publicWordRequestPageQueryService
    ));

    return useQuery<PublicWordRequestPageProjection, ApplicationError>({
        queryKey: wordRequestQueryKeys.publicWordRequestPage(input),
        queryFn: () => unwrapPage(() => service.get(input)),
        retry: false,
    });
};

'use client';

import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { ApplicationError } from '@/src/shared/application/application-error';
import type { Result } from '@/src/shared/application/result';
import type { GetWordLogPageService } from '../application/get-word-log-page';
import type { WordLogPageProjection, WordLogPageQuery } from '../application/word-log-query-types';
import { createBrowserWordLogServices } from '../infrastructure/browser/browser-word-log-services';
import { wordLogQueryKeys } from './word-log-query-keys';

export type WordLogPageQueryService = Pick<GetWordLogPageService, 'get'>;

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '로그를 불러오는 중 오류가 발생했습니다.',
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
    operation: () => Promise<Result<WordLogPageProjection>>,
): Promise<WordLogPageProjection> => {
    try {
        const result = await operation();
        if (!result.ok) throw result.error;
        return result.value;
    } catch (error) {
        throw isApplicationError(error) ? error : infrastructureError();
    }
};

/** 공개 단어 로그 페이지를 React Query cache와 연결합니다. */
export const useWordLogPage = (
    query: WordLogPageQuery,
): UseQueryResult<WordLogPageProjection, ApplicationError> => {
    const [service] = useState<WordLogPageQueryService>(() => (
        createBrowserWordLogServices().wordLogPageQueryService
    ));

    return useQuery<WordLogPageProjection, ApplicationError>({
        queryKey: wordLogQueryKeys.page(query),
        queryFn: () => unwrapPage(() => service.get(query)),
        placeholderData: keepPreviousData,
        retry: false,
        staleTime: 5 * 60 * 1000,
    });
};

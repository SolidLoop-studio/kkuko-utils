'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '../../../shared/application/application-error';
import type { GetWordDetailService } from '../application/get-word-detail';
import type { WordDetail } from '../application/word-detail-types';
import { createBrowserWordCatalogServices } from '../infrastructure/browser/browser-word-catalog-services';
import { wordCatalogQueryKeys } from './word-catalog-query-keys';
import { retryWordCatalogQuery, unwrapWordCatalogQuery } from './word-catalog-query-result';

export type WordDetailService = Pick<
    GetWordDetailService,
    'get' | 'findRandomConnectedWord'
>;

/** 단어 상세 projection을 React Query 캐시와 연결한다. */
export const useWordDetail = (word: string, service?: WordDetailService) => {
    const normalizedWord = word.trim();
    const [resolvedService] = useState<WordDetailService>(() => (
        service ?? createBrowserWordCatalogServices().wordDetailService
    ));

    return useQuery<WordDetail, ApplicationError>({
        queryKey: wordCatalogQueryKeys.detail(normalizedWord),
        queryFn: () => unwrapWordCatalogQuery(() => resolvedService.get(normalizedWord)),
        enabled: normalizedWord.length > 0,
        retry: (failureCount, error) => error.kind !== 'not-found'
            && retryWordCatalogQuery(failureCount, error),
    });
};

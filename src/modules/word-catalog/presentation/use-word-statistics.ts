'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '../../../shared/application/application-error';
import type { GetWordStatisticsService } from '../application/get-word-statistics';
import type { WordStatistics } from '../application/word-statistics-types';
import { createBrowserWordCatalogServices } from '../infrastructure/browser/browser-word-catalog-services';
import { wordCatalogQueryKeys } from './word-catalog-query-keys';
import { retryWordCatalogQuery, unwrapWordCatalogQuery } from './word-catalog-query-result';

export type WordStatisticsService = Pick<GetWordStatisticsService, 'get'>;

/** 단어 통계 투영을 React Query 캐시와 연결한다. */
export const useWordStatistics = () => {
    const [service] = useState<WordStatisticsService>(() => (
        createBrowserWordCatalogServices().wordStatisticsService
    ));

    return useQuery<WordStatistics, ApplicationError>({
        queryKey: wordCatalogQueryKeys.statistics(),
        queryFn: () => unwrapWordCatalogQuery(() => service.get()),
        retry: retryWordCatalogQuery,
    });
};

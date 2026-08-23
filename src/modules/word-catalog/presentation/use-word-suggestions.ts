'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '../../../shared/application/application-error';
import { createBrowserWordCatalogServices } from '../infrastructure/browser/browser-word-catalog-services';
import { wordCatalogQueryKeys } from './word-catalog-query-keys';
import { retryWordCatalogQuery, unwrapWordCatalogQuery } from './word-catalog-query-result';
import type { WordCatalogSearchService } from './use-word-catalog-search';

/** 제출된 검색어의 자동완성 후보를 React Query 캐시에서 조회한다. */
export const useWordSuggestions = (
    query: string,
    service?: WordCatalogSearchService,
) => {
    const normalizedQuery = query.trim();
    const [resolvedService] = useState<WordCatalogSearchService>(() => (
        service ?? createBrowserWordCatalogServices().searchWordsService
    ));

    return useQuery<string[], ApplicationError>({
        queryKey: wordCatalogQueryKeys.suggestions(normalizedQuery),
        queryFn: () => unwrapWordCatalogQuery(() => resolvedService.suggest(normalizedQuery)),
        enabled: normalizedQuery.length > 0,
        retry: retryWordCatalogQuery,
    });
};

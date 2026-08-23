'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '../../../shared/application/application-error';
import type { SearchWordsService } from '../application/search-words';
import type {
    WordSearchRequest,
    WordSearchResult,
} from '../application/word-search-types';
import { createBrowserWordCatalogServices } from '../infrastructure/browser/browser-word-catalog-services';
import { wordCatalogQueryKeys } from './word-catalog-query-keys';
import { retryWordCatalogQuery, unwrapWordCatalogQuery } from './word-catalog-query-result';

export type WordCatalogSearchService = Pick<
    SearchWordsService,
    'search' | 'suggest' | 'listThemes'
>;

const idleSearchQueryKey = [...wordCatalogQueryKeys.all, 'search', 'idle'] as const;

/** 제출된 단어 검색 요청을 React Query 캐시 및 화면 상태와 연결한다. */
export const useWordCatalogSearch = (
    request: WordSearchRequest | null,
    service?: WordCatalogSearchService,
) => {
    const [resolvedService] = useState<WordCatalogSearchService>(() => (
        service ?? createBrowserWordCatalogServices().searchWordsService
    ));

    return useQuery<WordSearchResult[], ApplicationError>({
        queryKey: request === null
            ? idleSearchQueryKey
            : wordCatalogQueryKeys.search(request),
        queryFn: () => unwrapWordCatalogQuery(() => resolvedService.search(request!)),
        enabled: request !== null,
        retry: retryWordCatalogQuery,
    });
};

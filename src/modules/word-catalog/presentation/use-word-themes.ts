'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '../../../shared/application/application-error';
import type { WordThemeSummary } from '../application/word-search-types';
import { createBrowserWordCatalogServices } from '../infrastructure/browser/browser-word-catalog-services';
import { wordCatalogQueryKeys } from './word-catalog-query-keys';
import { retryWordCatalogQuery, unwrapWordCatalogQuery } from './word-catalog-query-result';
import type { WordCatalogSearchService } from './use-word-catalog-search';

/** 주제 선택 화면이 열렸을 때만 단어 주제 목록을 조회한다. */
export const useWordThemes = (
    isEnabled: boolean,
    service?: WordCatalogSearchService,
) => {
    const [resolvedService] = useState<WordCatalogSearchService>(() => (
        service ?? createBrowserWordCatalogServices().searchWordsService
    ));

    return useQuery<WordThemeSummary[], ApplicationError>({
        queryKey: wordCatalogQueryKeys.themes(),
        queryFn: () => unwrapWordCatalogQuery(() => resolvedService.listThemes()),
        enabled: isEnabled,
        retry: retryWordCatalogQuery,
    });
};

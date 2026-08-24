'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '../../../shared/application/application-error';
import type { GetWordDownloadService } from '../application/get-word-download';
import type { WordDownloadData, WordDownloadFilter } from '../application/word-download-types';
import { createBrowserWordCatalogServices } from '../infrastructure/browser/browser-word-catalog-services';
import { wordCatalogQueryKeys } from './word-catalog-query-keys';
import { retryWordCatalogQuery, unwrapWordCatalogQuery } from './word-catalog-query-result';

export type WordDownloadService = Pick<GetWordDownloadService, 'get'>;

/** 다운로드 투영을 React Query 캐시와 연결한다. */
export const useWordDownload = (filter: WordDownloadFilter) => {
    const [service] = useState<WordDownloadService>(() => (
        createBrowserWordCatalogServices().wordDownloadService
    ));

    return useQuery<WordDownloadData, ApplicationError>({
        queryKey: wordCatalogQueryKeys.wordDownload(filter),
        queryFn: () => unwrapWordCatalogQuery(() => service.get(filter)),
        retry: retryWordCatalogQuery,
    });
};

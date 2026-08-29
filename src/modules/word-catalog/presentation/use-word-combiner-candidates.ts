'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '../../../shared/application/application-error';
import type { GetWordCombinerCandidatesService } from '../application/get-word-combiner-candidates';
import type { WordCombinerCandidate } from '../application/word-combiner-candidate-types';
import { createBrowserWordCatalogServices } from '../infrastructure/browser/browser-word-catalog-services';
import { wordCatalogQueryKeys } from './word-catalog-query-keys';
import { retryWordCatalogQuery, unwrapWordCatalogQuery } from './word-catalog-query-result';

export type WordCombinerCandidateService = Pick<GetWordCombinerCandidatesService, 'get'>;

/** 조합기 후보 단어를 React Query 캐시와 연결한다. */
export const useWordCombinerCandidates = () => {
    const [service] = useState<WordCombinerCandidateService>(() => (
        createBrowserWordCatalogServices().wordCombinerCandidateService
    ));

    return useQuery<WordCombinerCandidate[], ApplicationError>({
        queryKey: wordCatalogQueryKeys.wordCombinerCandidates(),
        queryFn: () => unwrapWordCatalogQuery(() => service.get()),
        retry: retryWordCatalogQuery,
    });
};

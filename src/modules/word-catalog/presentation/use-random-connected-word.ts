'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '../../../shared/application/application-error';
import type { FindRandomConnectedWordInput } from '../application/word-detail-types';
import { createBrowserWordCatalogServices } from '../infrastructure/browser/browser-word-catalog-services';
import { unwrapWordCatalogQuery } from './word-catalog-query-result';
import type { WordDetailService } from './use-word-detail';

/** 사용자 연결 동작마다 임의 단어 조회를 새로 실행한다. */
export const useRandomConnectedWord = (service?: WordDetailService) => {
    const [resolvedService] = useState<WordDetailService>(() => (
        service ?? createBrowserWordCatalogServices().wordDetailService
    ));

    return useMutation<string | null, ApplicationError, FindRandomConnectedWordInput>({
        mutationFn: (input) => unwrapWordCatalogQuery(
            () => resolvedService.findRandomConnectedWord(input),
        ),
    });
};

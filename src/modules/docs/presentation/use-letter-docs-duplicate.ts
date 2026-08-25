'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '@/src/shared/application/application-error';
import type { CheckLetterDocsDuplicateService } from '../application/check-letter-docs-duplicate';
import { createBrowserDocsServices } from '../infrastructure/browser/browser-docs-services';
import { docsQueryKeys } from './docs-query-keys';
import { retryDocsQuery, unwrapDocsQuery } from './docs-query-result';

export type LetterDocsDuplicateQueryService = Pick<
    CheckLetterDocsDuplicateService,
    'check'
>;

/** 글자 문서 중복 조회를 제출 시점의 React Query refetch와 연결합니다. */
export const useLetterDocsDuplicate = (
    docsName: string,
): UseQueryResult<boolean, ApplicationError> => {
    const [service] = useState<LetterDocsDuplicateQueryService>(() => (
        createBrowserDocsServices().letterDocsDuplicateQueryService
    ));

    return useQuery<boolean, ApplicationError>({
        queryKey: docsQueryKeys.letterDuplicate(docsName),
        queryFn: () => unwrapDocsQuery(() => service.check(docsName)),
        retry: retryDocsQuery,
        enabled: false,
    });
};

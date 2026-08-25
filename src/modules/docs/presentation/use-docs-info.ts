'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '@/src/shared/application/application-error';
import type { GetDocsInfoService } from '../application/get-docs-info';
import type { DocsInfoProjection } from '../application/docs-info-query-types';
import { createBrowserDocsServices } from '../infrastructure/browser/browser-docs-services';
import { docsQueryKeys } from './docs-query-keys';
import { retryDocsQuery, unwrapDocsQuery } from './docs-query-result';

export type DocsInfoQueryService = Pick<GetDocsInfoService, 'get'>;

/** 문서 정보 조회를 React Query 캐시와 연결합니다. */
export const useDocsInfo = (docsId: number) => {
    const [service] = useState<DocsInfoQueryService>(() => (
        createBrowserDocsServices().docsInfoQueryService
    ));

    return useQuery<DocsInfoProjection, ApplicationError>({
        queryKey: docsQueryKeys.info(docsId),
        queryFn: () => unwrapDocsQuery(() => service.get(docsId)),
        retry: retryDocsQuery,
    });
};

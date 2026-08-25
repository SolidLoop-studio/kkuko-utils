'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '@/src/shared/application/application-error';
import type { GetDocsContentService } from '../application/get-docs-content';
import type { DocsContentProjection } from '../application/docs-content-query-types';
import { createBrowserDocsServices } from '../infrastructure/browser/browser-docs-services';
import { docsQueryKeys } from './docs-query-keys';
import { retryDocsQuery, unwrapDocsQuery } from './docs-query-result';

export type DocsContentQueryService = Pick<GetDocsContentService, 'get'>;

/** 문서 본문 projection을 React Query 캐시와 연결합니다. */
export const useDocsContent = (docsId: number) => {
    const [service] = useState<DocsContentQueryService>(() => (
        createBrowserDocsServices().docsContentQueryService
    ));

    return useQuery<DocsContentProjection, ApplicationError>({
        queryKey: docsQueryKeys.content(docsId),
        queryFn: () => unwrapDocsQuery(() => service.get(docsId)),
        retry: retryDocsQuery,
    });
};

'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '@/src/shared/application/application-error';
import type { GetDocsListService } from '../application/get-docs-list';
import type { DocsSummary } from '../application/docs-list-query-types';
import { createBrowserDocsServices } from '../infrastructure/browser/browser-docs-services';
import { docsQueryKeys } from './docs-query-keys';
import { retryDocsQuery, unwrapDocsQuery } from './docs-query-result';

export type DocsListQueryService = Pick<GetDocsListService, 'get'>;

/** 문서 목록 조회를 React Query 캐시와 연결합니다. */
export const useDocsList = () => {
    const [service] = useState<DocsListQueryService>(() => (
        createBrowserDocsServices().docsListQueryService
    ));

    return useQuery<DocsSummary[], ApplicationError>({
        queryKey: docsQueryKeys.list,
        queryFn: () => unwrapDocsQuery(() => service.get()),
        retry: retryDocsQuery,
    });
};

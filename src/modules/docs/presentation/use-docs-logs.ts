'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '@/src/shared/application/application-error';
import type { GetDocsLogsService } from '../application/get-docs-logs';
import type { DocsLogProjection } from '../application/docs-log-query-types';
import { createBrowserDocsServices } from '../infrastructure/browser/browser-docs-services';
import { docsQueryKeys } from './docs-query-keys';
import { retryDocsQuery, unwrapDocsQuery } from './docs-query-result';

export type DocsLogsQueryService = Pick<GetDocsLogsService, 'get'>;

/** 문서 로그 조회를 React Query 캐시와 연결합니다. */
export const useDocsLogs = (docsId: number) => {
    const [service] = useState<DocsLogsQueryService>(() => (
        createBrowserDocsServices().docsLogsQueryService
    ));

    return useQuery<DocsLogProjection, ApplicationError>({
        queryKey: docsQueryKeys.logs(docsId),
        queryFn: () => unwrapDocsQuery(() => service.get(docsId)),
        retry: retryDocsQuery,
    });
};

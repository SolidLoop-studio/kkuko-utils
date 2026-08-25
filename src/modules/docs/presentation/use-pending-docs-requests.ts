'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '@/src/shared/application/application-error';
import type { GetPendingDocsRequestsService } from '../application/get-pending-docs-requests';
import type { PendingDocsRequest } from '../application/docs-request-query-types';
import { createBrowserDocsServices } from '../infrastructure/browser/browser-docs-services';
import { docsQueryKeys } from './docs-query-keys';
import { retryDocsQuery, unwrapDocsQuery } from './docs-query-result';

export type PendingDocsRequestsService = Pick<GetPendingDocsRequestsService, 'get'>;

/** 대기 중인 문서 요청 목록을 React Query 캐시와 연결합니다. */
export const usePendingDocsRequests = () => {
    const [service] = useState<PendingDocsRequestsService>(() => (
        createBrowserDocsServices().docsRequestQueryService
    ));

    return useQuery<PendingDocsRequest[], ApplicationError>({
        queryKey: docsQueryKeys.pendingRequests,
        queryFn: () => unwrapDocsQuery(() => service.get()),
        retry: retryDocsQuery,
    });
};

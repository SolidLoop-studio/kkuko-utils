'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '@/src/shared/application/application-error';
import type { GetDocsMarkersService } from '../application/get-docs-markers';
import type { DocsMarkerSlot } from '../application/docs-marker-query-types';
import { createBrowserDocsServices } from '../infrastructure/browser/browser-docs-services';
import { docsQueryKeys } from './docs-query-keys';
import { retryDocsQuery, unwrapDocsQuery } from './docs-query-result';

export type DocsMarkerQueryService = Pick<GetDocsMarkersService, 'get'>;

/** 미션 marker projection을 상위 문서 ID별 React Query 캐시와 연결합니다. */
export const useDocsMarkers = (parentDocsId: number, isMissionParent: boolean) => {
    const [service] = useState<DocsMarkerQueryService>(() => (
        createBrowserDocsServices().docsMarkerQueryService
    ));

    return useQuery<DocsMarkerSlot[], ApplicationError>({
        queryKey: docsQueryKeys.markers(parentDocsId),
        queryFn: () => unwrapDocsQuery(() => service.get(parentDocsId)),
        retry: retryDocsQuery,
        enabled: isMissionParent,
    });
};

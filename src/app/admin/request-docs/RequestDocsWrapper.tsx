"use client";

import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import LoadingPage from '@/src/app/components/LoadingPage';
import ErrorPage from '../../components/ErrorPage';
import {
    type DocsRequestModerationResult,
    type PendingDocsRequest,
    usePendingDocsRequests,
} from '@/src/modules/docs';
import { docsQueryKeys } from '@/src/modules/docs/presentation/docs-query-keys';
import DocsWaitManager from './RequestDocsHome';

export default function RequestDocsWrapper() {
    const { data: requests = [], error, isLoading } = usePendingDocsRequests();
    const queryClient = useQueryClient();
    const initialData = useMemo(() => requests.map((request) => ({
        id: request.id,
        req_at: request.requestedAt,
        docs_name: request.docsName,
        req_by: request.requesterNickname,
        initial_consonant: false,
        req_byId: request.requesterId,
    })), [requests]);

    const synchronizePendingRequests = useCallback((result: DocsRequestModerationResult) => {
        const processedRequestIds = new Set(result.processedRequestIds);

        queryClient.setQueryData<PendingDocsRequest[]>(docsQueryKeys.pendingRequests, (current) => (
            current?.filter((request) => !processedRequestIds.has(request.id))
        ));
        void queryClient.invalidateQueries({ queryKey: docsQueryKeys.pendingRequests });
    }, [queryClient]);

    if (isLoading) {
        return <LoadingPage title="문서 요청 목록" />;
    }

    if (error) {
        return <ErrorPage message={error.message} />;
    }

    return (
        <DocsWaitManager
            initialData={initialData}
            onModerationSuccess={synchronizePendingRequests}
        />
    );
}

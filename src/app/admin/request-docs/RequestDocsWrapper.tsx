"use client";

import LoadingPage from '@/src/app/components/LoadingPage';
import ErrorPage from '../../components/ErrorPage';
import { usePendingDocsRequests } from '@/src/modules/docs';
import DocsWaitManager from './RequestDocsHome';

export default function RequestDocsWrapper() {
    const { data: requests = [], error, isLoading } = usePendingDocsRequests();

    if (isLoading) {
        return <LoadingPage title="문서 요청 목록" />;
    }

    if (error) {
        return <ErrorPage message={error.message} />;
    }

    return (
        <DocsWaitManager
            initialData={requests.map((request) => ({
                id: request.id,
                req_at: request.requestedAt,
                docs_name: request.docsName,
                req_by: request.requesterNickname,
                initial_consonant: false,
                req_byId: request.requesterId,
            }))}
        />
    );
}

"use client";

import LoadingPage from '@/src/app/components/LoadingPage';
import { useAdminLogsInitial } from '@/src/modules/admin-logs';
import ErrorPage from '../../components/ErrorPage';
import AdminLogsHome from './AdminLogsHome';

export default function AdminLogsWrapper() {
    const { data, error, isLoading } = useAdminLogsInitial();

    if (isLoading) {
        return <LoadingPage title="문서 요청 목록" isForcedVisible />;
    }

    if (error && data === undefined) {
        return <ErrorPage message={error.message} />;
    }

    const projection = data ?? { wordLogs: [], docsLogs: [], documentChoices: [] };
    return (
        <AdminLogsHome
            initialWordLogs={projection.wordLogs.map((log) => ({
                id: log.id,
                word: log.word,
                state: log.state,
                r_type: log.requestType,
                created_at: log.createdAt,
                make_by_user: log.requesterNickname === null
                    ? null
                    : { nickname: log.requesterNickname },
                processed_by_user: log.processorNickname === null
                    ? null
                    : { nickname: log.processorNickname },
            }))}
            initialDocsLogs={projection.docsLogs.map((log) => ({
                id: log.id,
                word: log.word,
                type: log.type,
                date: log.occurredAt,
                docs: { name: log.documentName ?? 'N/A' },
                users: log.actorNickname === null
                    ? null
                    : { nickname: log.actorNickname },
            }))}
            allDocs={projection.documentChoices.map((docs) => ({
                id: docs.id,
                name: docs.name,
                typez: docs.type,
            }))}
        />
    );
}

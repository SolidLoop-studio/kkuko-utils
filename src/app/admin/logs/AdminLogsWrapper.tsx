"use client";

import LoadingPage from '@/src/app/components/LoadingPage';
import { useAdminLogsInitial } from '@/src/modules/admin-logs';
import ErrorPage from '../../components/ErrorPage';
import AdminLogsHome from './AdminLogsHome';

export default function AdminLogsWrapper() {
    const { data, error, isLoading } = useAdminLogsInitial();

    if (isLoading) {
        return <LoadingPage title="문서 요청 목록" />;
    }

    if (error && data === undefined) {
        return <ErrorPage message={error.message} />;
    }

    const projection = data ?? { documentChoices: [] };
    return (
        <AdminLogsHome
            allDocs={projection.documentChoices.map((docs) => ({
                id: docs.id,
                name: docs.name,
                typez: docs.type,
            }))}
        />
    );
}

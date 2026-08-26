"use client";

import LoadingPage from '@/src/app/components/LoadingPage';
import { usePendingWordModerationRequests } from '@/src/modules/word-moderation';
import ErrorPage from '../../components/ErrorPage';
import AdminHome from './AdminRequestHome';

export default function AdminHomeWrapper() {
    const { data: requests = [], error, isLoading, refetch } = usePendingWordModerationRequests();

    if (isLoading) {
        return <LoadingPage title="관리자 페이지" isForcedVisible />;
    }

    if (error) {
        return <ErrorPage message={error.message} />;
    }

    const requestData = requests.map((request) => ({
        id: request.id,
        word: request.word,
        request_type: request.requestType,
        requested_at: request.requestedAt,
        requested_by_uuid: request.requesterId,
        requested_by: request.requesterNickname,
        wait_themes: request.themes?.map((theme) => ({
            theme_id: theme.id,
            theme_name: theme.name,
            theme_code: theme.code,
            typez: theme.type,
        })),
        word_id: request.wordId,
    }));

    const refreshRequests = async (): Promise<void> => {
        const result = await refetch();
        if (result.error) throw result.error;
    };

    return <AdminHome requestData={requestData} refreshFn={refreshRequests} />;
}

"use client";

import ErrorPage from '@/src/app/components/ErrorPage';
import LoadingPage from '@/src/app/components/LoadingPage';
import NotFound from '@/src/app/not-found-client';
import { useDocsInfo } from '@/src/modules/docs';
import DocsInfo from './DocsInfo';

export default function DocsInfoPage({ id }: { id: number }) {
    const { data, error, isLoading } = useDocsInfo(id);

    if (isLoading) return <LoadingPage title="문서 정보" />;

    if (data) return <DocsInfo
        metaData={{
            id: data.metadata.id,
            created_at: data.metadata.createdAt,
            name: data.metadata.name,
            users: data.metadata.makerNickname === null
                ? null
                : { nickname: data.metadata.makerNickname },
            typez: data.metadata.type,
            last_update: data.metadata.lastUpdatedAt,
            views: data.metadata.views,
        }}
        wordsCount={data.wordCount}
        starCount={data.starCount}
        docsViewRank={data.viewRank}
    />;

    if (error?.kind === 'not-found') return <NotFound />;

    if (error) return <ErrorPage message={error.message} />;

    return null;
}

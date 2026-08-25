"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

import ErrorPage from '@/src/app/components/ErrorPage';
import LoadingPage from '@/src/app/components/LoadingPage';
import NotFound from '@/src/app/not-found-client';
import { SCM } from '@/src/app/lib/supabaseClient';
import { useDocsContent, type DocsContentProjection } from '@/src/modules/docs';
import { createBrowserWordModerationServices } from '@/src/modules/word-moderation/infrastructure/browser/browser-word-moderation-services';
import DocsDataHome from './DocsDataHome';
import { enrichDocsWordData, type DocsWordData } from './docs-word-data';

const enrichProjectionWords = async (projection: DocsContentProjection): Promise<DocsWordData[] | null> => {
    const result = await enrichDocsWordData(
        projection.metadata.id,
        projection.words.map(({ word, status, requesterNickname }) => ({
            word,
            status,
            maker: requesterNickname,
        })),
        createBrowserWordModerationServices().docsWordMutationTargetService,
    );
    return result.ok ? result.value : null;
};

export default function DocsDataPage({ id }: { id: number }) {
    const { data, error, isLoading, refetch } = useDocsContent(id);
    const [enrichedWords, setEnrichedWords] = useState<DocsWordData[] | null>(null);
    const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
    const latestRequestRef = useRef(0);

    useEffect(() => {
        const requestId = ++latestRequestRef.current;
        setEnrichedWords(null);
        setEnrichmentError(null);
        if (data === undefined) return;

        void enrichProjectionWords(data).then((words) => {
            if (latestRequestRef.current !== requestId) return;
            if (words === null) {
                setEnrichmentError('문서 단어 처리 대상을 불러오는 중 오류가 발생했습니다.');
                return;
            }
            setEnrichedWords(words);
            void SCM.update().docView(data.metadata.id).catch(() => undefined);
        }).catch(() => {
            if (latestRequestRef.current === requestId) {
                setEnrichmentError('문서 단어 처리 대상을 불러오는 중 오류가 발생했습니다.');
            }
        });
    }, [data]);

    const refreshContent = useCallback(async (): Promise<DocsWordData[] | null> => {
        const result = await refetch();
        if (result.error !== null || result.data === undefined) return null;
        return enrichProjectionWords(result.data);
    }, [refetch]);

    if (isLoading) return <LoadingPage title="문서" isForcedVisible />;
    if (error?.kind === 'not-found') return <NotFound />;
    if (error) return <ErrorPage message={error.message} />;
    if (enrichmentError) return <ErrorPage message={enrichmentError} />;
    if (data !== undefined && enrichedWords !== null) {
        return <DocsDataHome
            id={id}
            data={[...enrichedWords].sort((left, right) => left.word.localeCompare(right.word, 'ko'))}
            metaData={{ title: data.metadata.title, lastUpdate: data.metadata.lastUpdatedAt, typez: data.metadata.type }}
            starCount={data.starredUserIds}
            isSpecial={data.isSpecial}
            onContentRefresh={refreshContent}
        />;
    }
    return null;
}

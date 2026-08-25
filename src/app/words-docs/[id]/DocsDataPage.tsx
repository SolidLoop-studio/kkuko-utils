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

interface DocsContentSnapshot {
    id: number;
    projection: DocsContentProjection;
    words: DocsWordData[];
}

const sortWords = (words: DocsWordData[]): DocsWordData[] => (
    [...words].sort((left, right) => left.word.localeCompare(right.word, 'ko'))
);

export default function DocsDataPage({ id }: { id: number }) {
    const { data, error, isLoading, refetch } = useDocsContent(id);
    const [snapshot, setSnapshot] = useState<DocsContentSnapshot | null>(null);
    const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
    const latestRequestRef = useRef(0);
    const viewedDocsIdRef = useRef<number | null>(null);
    const isAdminRefreshRef = useRef(false);
    const snapshotRef = useRef<DocsContentSnapshot | null>(null);
    const hasCurrentSnapshot = snapshot?.id === id;

    useEffect(() => {
        if (isAdminRefreshRef.current) return;

        const requestId = ++latestRequestRef.current;
        let mounted = true;
        setEnrichmentError(null);
        if (data === undefined) return () => { mounted = false; };

        void enrichProjectionWords(data).then((words) => {
            if (!mounted || latestRequestRef.current !== requestId) return;
            if (words === null) {
                if (snapshotRef.current?.id !== id) {
                    setEnrichmentError('문서 단어 처리 대상을 불러오는 중 오류가 발생했습니다.');
                }
                return;
            }
            const nextSnapshot = { id, projection: data, words: sortWords(words) };
            snapshotRef.current = nextSnapshot;
            setSnapshot(nextSnapshot);
            if (viewedDocsIdRef.current !== id) {
                viewedDocsIdRef.current = id;
                void SCM.update().docView(data.metadata.id).catch(() => undefined);
            }
        }).catch(() => {
            if (mounted && latestRequestRef.current === requestId && snapshotRef.current?.id !== id) {
                setEnrichmentError('문서 단어 처리 대상을 불러오는 중 오류가 발생했습니다.');
            }
        });
        return () => { mounted = false; };
    }, [data, id]);

    const refreshContent = useCallback(async (): Promise<DocsWordData[] | null> => {
        isAdminRefreshRef.current = true;
        try {
            const result = await refetch();
            if (result.error !== null || result.data === undefined) return null;
            const words = await enrichProjectionWords(result.data);
            if (words === null) return null;
            const sortedWords = sortWords(words);
            const nextSnapshot = { id, projection: result.data, words: sortedWords };
            snapshotRef.current = nextSnapshot;
            setSnapshot(nextSnapshot);
            return sortedWords;
        } catch {
            return null;
        } finally {
            isAdminRefreshRef.current = false;
        }
    }, [id, refetch]);

    if (!hasCurrentSnapshot) {
        if (isLoading || (data !== undefined && enrichmentError === null)) {
            return <LoadingPage title="문서" isForcedVisible />;
        }
        if (error?.kind === 'not-found') return <NotFound />;
        if (error) return <ErrorPage message={error.message} />;
        if (enrichmentError) return <ErrorPage message={enrichmentError} />;
        return <LoadingPage title="문서" isForcedVisible />;
    }

    if (snapshot !== null) {
        return <DocsDataHome
            id={id}
            data={snapshot.words}
            metaData={{ title: snapshot.projection.metadata.title, lastUpdate: snapshot.projection.metadata.lastUpdatedAt, typez: snapshot.projection.metadata.type }}
            starCount={snapshot.projection.starredUserIds}
            isSpecial={snapshot.projection.isSpecial}
            onContentRefresh={refreshContent}
        />;
    }
    return null;
}

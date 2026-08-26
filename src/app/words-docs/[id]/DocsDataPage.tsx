"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

import ErrorPage from '@/src/app/components/ErrorPage';
import LoadingPage from '@/src/app/components/LoadingPage';
import NotFound from '@/src/app/not-found-client';
import { useDocsContent, useRecordDocsView, type DocsContentProjection } from '@/src/modules/docs';
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

const isSameProjection = (left: DocsContentProjection, right: DocsContentProjection) => (
    left.metadata.id === right.metadata.id
    && left.metadata.title === right.metadata.title
    && left.metadata.lastUpdatedAt === right.metadata.lastUpdatedAt
    && left.metadata.type === right.metadata.type
    && left.isSpecial === right.isSpecial
    && left.isMissionParent === right.isMissionParent
    && left.starredUserIds.length === right.starredUserIds.length
    && left.starredUserIds.every((userId, index) => userId === right.starredUserIds[index])
    && left.words.length === right.words.length
    && left.words.every((word, index) => (
        word.word === right.words[index]?.word
        && word.status === right.words[index]?.status
        && word.requesterNickname === right.words[index]?.requesterNickname
    ))
);

export default function DocsDataPage({ id }: { id: number }) {
    const { data, error, isLoading, refetch } = useDocsContent(id);
    const { record: recordDocsView } = useRecordDocsView();
    const [snapshot, setSnapshot] = useState<DocsContentSnapshot | null>(null);
    const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
    const latestRequestRef = useRef(0);
    const viewedDocsIdRef = useRef<number | null>(null);
    const adminRefreshCountsRef = useRef<Map<number, number>>(new Map());
    const snapshotRef = useRef<DocsContentSnapshot | null>(null);
    const handledProjectionRef = useRef<DocsContentProjection | null>(null);
    const mountedRef = useRef(false);
    const currentDocsIdRef = useRef(id);
    const hasCurrentSnapshot = snapshot?.id === id;

    currentDocsIdRef.current = id;

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => {
        if ((adminRefreshCountsRef.current.get(id) ?? 0) > 0) return;

        const requestId = ++latestRequestRef.current;
        let active = true;
        const canApply = () => (
            active
            && mountedRef.current
            && currentDocsIdRef.current === id
            && latestRequestRef.current === requestId
        );
        setEnrichmentError(null);
        if (data === undefined) return () => { active = false; };
        if (
            snapshotRef.current?.id === id
            && handledProjectionRef.current !== null
            && isSameProjection(handledProjectionRef.current, data)
        ) {
            return () => { active = false; };
        }

        void enrichProjectionWords(data).then((words) => {
            if (!canApply()) return;
            if (words === null) {
                if (snapshotRef.current?.id !== id) {
                    setEnrichmentError('문서 단어 처리 대상을 불러오는 중 오류가 발생했습니다.');
                }
                return;
            }
            const nextSnapshot = { id, projection: data, words: sortWords(words) };
            handledProjectionRef.current = data;
            snapshotRef.current = nextSnapshot;
            setSnapshot(nextSnapshot);
            if (viewedDocsIdRef.current !== id) {
                viewedDocsIdRef.current = id;
                void recordDocsView(data.metadata.id);
            }
        }).catch(() => {
            if (canApply() && snapshotRef.current?.id !== id) {
                setEnrichmentError('문서 단어 처리 대상을 불러오는 중 오류가 발생했습니다.');
            }
        });
        return () => { active = false; };
    }, [data, id, recordDocsView]);

    const refreshContent = useCallback(async (): Promise<DocsWordData[] | null> => {
        const requestId = ++latestRequestRef.current;
        const refreshDocsId = id;
        adminRefreshCountsRef.current.set(
            refreshDocsId,
            (adminRefreshCountsRef.current.get(refreshDocsId) ?? 0) + 1,
        );
        const canApply = () => (
            mountedRef.current
            && currentDocsIdRef.current === refreshDocsId
            && latestRequestRef.current === requestId
        );
        try {
            const result = await refetch();
            if (!canApply()) return null;
            if (result.error !== null || result.data === undefined) return null;
            const words = await enrichProjectionWords(result.data);
            if (!canApply()) return null;
            if (words === null) return null;
            const sortedWords = sortWords(words);
            const nextSnapshot = { id: refreshDocsId, projection: result.data, words: sortedWords };
            handledProjectionRef.current = result.data;
            snapshotRef.current = nextSnapshot;
            setSnapshot(nextSnapshot);
            return sortedWords;
        } catch {
            return null;
        } finally {
            const remainingRefreshes = (adminRefreshCountsRef.current.get(refreshDocsId) ?? 1) - 1;
            if (remainingRefreshes === 0) {
                adminRefreshCountsRef.current.delete(refreshDocsId);
            } else {
                adminRefreshCountsRef.current.set(refreshDocsId, remainingRefreshes);
            }
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
            key={id}
            id={id}
            data={snapshot.words}
            metaData={{ title: snapshot.projection.metadata.title, lastUpdate: snapshot.projection.metadata.lastUpdatedAt, typez: snapshot.projection.metadata.type }}
            starCount={snapshot.projection.starredUserIds}
            isSpecial={snapshot.projection.isSpecial}
            isMissionParent={snapshot.projection.isMissionParent}
            onContentRefresh={refreshContent}
        />;
    }
    return null;
}

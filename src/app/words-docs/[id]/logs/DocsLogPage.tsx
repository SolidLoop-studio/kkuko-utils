"use client";
import DocsLogs from "./DocsLogs";
import NotFound from "@/src/app/not-found-client";
import ErrorPage from "@/src/app/components/ErrorPage";
import LoadingPage from '@/src/app/components/LoadingPage';
import { useDocsLogs } from '@/src/modules/docs';

export default function DocsLogPage({id}:{id: number}){
    const { data, error, isLoading } = useDocsLogs(id);

    if (isLoading) return <LoadingPage title={"문서 로그"} />;

    if (error?.kind === 'not-found') return <NotFound />;

    if (error) return <ErrorPage message={error.message} />;

    if (data) return <DocsLogs id={id} name={data.docsName} Logs={data.entries.map((entry) => ({
        id: entry.id,
        word: entry.word,
        user: entry.userNickname ?? undefined,
        date: entry.occurredAt,
        type: entry.type,
    }))} />;

    return null;
}

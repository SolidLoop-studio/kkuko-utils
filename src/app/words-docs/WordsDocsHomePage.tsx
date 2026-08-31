"use client";
import WordsDocsHome from "./WordsDocsHome";
import ErrorPage from "../components/ErrorPage";
import LoadingPage from '@/src/app/components/LoadingPage';
import { useDocsList } from '@/src/modules/docs';

export default function WordsDocsHomePage(){
    const { data, error, isLoading } = useDocsList();

    if (isLoading) return <LoadingPage title={"문서 목록"} />

    if (data) return <WordsDocsHome docs={data.map((docs) => ({
        id: `${docs.id}`,
        name: docs.name,
        maker: docs.makerNickname ?? "알수없음",
        last_update: docs.lastUpdatedAt,
        is_manager: false,
        typez: docs.type,
        created_at: docs.createdAt,
    }))} />

    if (error) return <ErrorPage message={error.message}/>

    return null
}

"use client";
import { SCM } from "@/app/lib/supabaseClient";
import { useEffect, useState } from "react";
import LoadingPage, {useLoadingState } from '@/app/components/LoadingPage';
import ErrorPage from "../../components/ErrorPage";
import type { PostgrestError } from "@supabase/supabase-js";
import AdminLogsHome from "./AdminLogsHome";

type WordLog = {
    id: number;
    word: string;
    processed_by: string | null;
    make_by: string | null;
    state: "approved" | "rejected" | "pending";
    r_type: "add" | "delete";
    created_at: string;
    make_by_user: { nickname: string } | null;
    processed_by_user: { nickname: string | null } | null;
}

type DocsLog = {
    id: number;
    docs_id: number;
    word: string;
    add_by: string | null;
    type: "add" | "delete";
    date: string;
    docs: {
        id: number;
        name: string;
        typez: "letter" | "theme" | "ect";
        duem: boolean;
        maker: string | null;
        created_at: string;
        last_update: string;
        views: number;
        is_hidden: boolean;
    };
    users: { nickname: string } | null;
}

type Docs = {
    id: number;
    name: string;
    typez: "letter" | "theme" | "ect";
    duem: boolean;
    maker: string | null;
    created_at: string;
    last_update: string;
    views: number;
    is_hidden: boolean;
    users: {
        id: string;
        nickname: string;
        contribution: number;
        month_contribution: number;
        role: "r1" | "r2" | "r3" | "r4" | "admin";
    } | null;
}

interface AdminLogsHomeProps {
    initialWordLogs: WordLog[];
    initialDocsLogs: DocsLog[];
    allDocs: Docs[];
}

export default function AdminLogsWrapper(){
    const { loadingState, updateLoadingState } = useLoadingState();
    const [errorMessage,setErrorMessage] = useState<string|null>(null);
    const [logs, setLogs] = useState<AdminLogsHomeProps | null>(null);

    const MakeError = (error: PostgrestError) => {
        setErrorMessage(`문서 정보 데이터 로드중 오류.\nErrorName: ${error.name ?? "알수없음"}\nError Message: ${error.message ?? "없음"}\nError code: ${error.code}`)
        updateLoadingState(100,"ERR");
        return;
    };

    useEffect(() => {
        const fetchData = async () => {
            updateLoadingState(10, "기존 로그 목록 가져오는 중...");
            const [
                { data: allWordLogs, error: wordLogsError },
                { data: allDocsLogs, error: docsLogsError },
                { data: allDocs, error: allDocsError }
            ] = await Promise.all([
                SCM.get().logsByFilter({ filterState: "all", filterType: "all", from: 0, to: 999 }),
                SCM.get().docsLogsByFilter({ logType: "all", from: 0, to: 999 }),
                SCM.get().allDocs()
            ]);

            if (wordLogsError) {
                MakeError(wordLogsError);
                return;
            }
            if (docsLogsError) {
                MakeError(docsLogsError);
                return;
            }
            if (allDocsError) {
                MakeError(allDocsError);
                return;
            }

            updateLoadingState(70, "로그 목록 초기화 중...");
            setLogs({
                initialWordLogs: allWordLogs || [],
                initialDocsLogs: allDocsLogs || [],
                allDocs: allDocs || []
            });
            updateLoadingState(100, "완료");
        };

        fetchData();
    }, []);

    if (loadingState.isLoading) {
        return (
            <LoadingPage title={"문서 요청 목록"} />
        );
    }

    if (errorMessage){
        return <ErrorPage message={errorMessage}/>
    }

    if (logs){
        return <AdminLogsHome 
            initialWordLogs={logs.initialWordLogs}
            initialDocsLogs={logs.initialDocsLogs}
            allDocs={logs.allDocs}
        />
    }
}

"use client";
import DocsLogs from "./DocsLogs";
import NotFound from "@/app/not-found-client";
import { SCM } from "@/app/lib/supabaseClient";
import { useState, useEffect } from 'react';
import ErrorPage from "@/app/components/ErrorPage";
import LoadingPage, {useLoadingState } from '@/app/components/LoadingPage';
import type { PostgrestError } from "@supabase/supabase-js";

type log = {
    id: number;
    word: string;
    user: string | undefined;
    date: string;
    type: "add" | "delete";
}

export default function DocsLogPage({id}:{id: number}){
    const [isNotFound,setIsNotFound] = useState(false);
    const [errorMessage,setErrorMessage] = useState<string|null>(null);
    const [logsData, setLogsData] = useState<{logs:log[], docsName: string}|null>(null);
    const { loadingState, updateLoadingState } = useLoadingState();

    const handleError = (error: PostgrestError) => {
        setErrorMessage(`문서 정보 데이터 로드중 오류.\nErrorName: ${error.name ?? "알수없음"}\nError Message: ${error.message ?? "없음"}\nError code: ${error.code}`);
        updateLoadingState(100,"ERR");
    }

    useEffect(()=>{
        const getData = async () => {
            updateLoadingState(25,"문서 정보 가져오는 중...");
            //  문서 정보 가져오기
            const {data: docsData, error: docsDataError} = await SCM.get().docsInfoByDocsId(id);
            if (docsData === null) return setIsNotFound(true);
            if (docsDataError){ return handleError(docsDataError); }

            updateLoadingState(40,"로그 가져오는 중...");
            // 문서 로그 가져오기
            const {data: logData, error: logDataError} = await SCM.get().docsLogs(id);
            if (logDataError){ return handleError(logDataError); }

            updateLoadingState(90,"데이터 가공중...");
            const logsData = logData?.map((log) => ({
                id: log.id,
                word: log.word,
                user: log.users?.nickname,
                date: log.date,
                type: log.type,
            }));

            setLogsData({logs:logsData ?? [], docsName: docsData?.name});
            updateLoadingState(100,"완료!");
        }   
        getData()
    },[]);

    if (isNotFound) return <NotFound />;
    
    if (loadingState.isLoading) return <LoadingPage title={"문서 로그"} />;

    if (errorMessage) return <ErrorPage message={errorMessage} />;

    if (logsData) return <DocsLogs id={id} name={logsData.docsName} Logs={logsData.logs} />;
}
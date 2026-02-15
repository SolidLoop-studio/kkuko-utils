"use client";

import { useEffect, useState } from "react";
import LoadingPage, {useLoadingState } from '@/src/app/components/LoadingPage';
import ErrorPage from "../../components/ErrorPage";
import type { PostgrestError } from "@supabase/supabase-js";
import DocsWaitManager from "./RequestDocsHome";
import { SCM } from "@/src/app/lib/supabaseClient";

type DocsWaitRequest = {id: number, req_at: string, docs_name: string, req_by: string | null, initial_consonant: boolean, req_byId: string | null};

export default function RequestDocsWrapper() {
    const [docsWaitRequests, setDocsWaitRequests] = useState<DocsWaitRequest[] | null>([]);
    const { loadingState, updateLoadingState } = useLoadingState();
    const [errorMessage,setErrorMessage] = useState<string|null>(null);

    const MakeError = (error: PostgrestError) => {
        setErrorMessage(`문서 정보 데이터 로드중 오류.\nErrorName: ${error.name ?? "알수없음"}\nError Message: ${error.message ?? "없음"}\nError code: ${error.code}`)
        updateLoadingState(100,"ERR");
        return;
    }

    useEffect(() => {
        const getWaitQueue = async () => {
            updateLoadingState(10, "기존 문서 요청 목록 가져오는 중...");
            const {data,error} = await SCM.get().addWaitDocs();
            if (error) {
                MakeError(error);
                return;
            }

            updateLoadingState(30, "문서 요청 목록 초기화 중...");
            setDocsWaitRequests(data.map(({docs_name, id, req_at, users, req_by})=>({docs_name, req_by: users?.nickname ?? null, initial_consonant: false, id, req_at, req_byId: req_by})) || []);
            updateLoadingState(100, "완료");
        }
        getWaitQueue();
    }, []);

    if (loadingState.isLoading) {
        return (
            <LoadingPage title={"문서 요청 목록"} />
        );
    }

    if (errorMessage){
        return <ErrorPage message={errorMessage}/>
    }

    if (docsWaitRequests){
        return <DocsWaitManager initialData={docsWaitRequests} />
    }

}

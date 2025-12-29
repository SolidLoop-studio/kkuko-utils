"use client";
import AdminHome from "./AdminRequestHome";
import { SCM } from "../../lib/supabaseClient";
import { useEffect, useState } from 'react';
import LoadingPage, {useLoadingState } from '@/app/components/LoadingPage';
import ErrorPage from "../../components/ErrorPage";
import type { PostgrestError } from "@supabase/supabase-js";
import { DefaultDict } from "../../lib/collections";

type Theme = {
    theme_id: number;
    theme_name: string;
    theme_code: string;
    typez?: "add" | "delete"; // 주제 추가/삭제 요청에서만 사용
}

type WordRequest = {
    id: number;
    word: string;
    request_type: "add" | "delete" | "theme_change";
    requested_at: string;
    requested_by_uuid?: string;
    requested_by: string;
    wait_themes?: Theme[];
    word_id?: number; // 주제 변경 요청에서만 사용
}

export default function AdminHomeWrapper(){
    const { loadingState, updateLoadingState } = useLoadingState();
    const [errorMessage,setErrorMessage] = useState<string|null>(null);
    const [waitData,setWaitData] = useState<WordRequest[] | null>(null);

    const MakeError = (error: PostgrestError) => {
        setErrorMessage(`문서 정보 데이터 로드중 오류.\nErrorName: ${error.name ?? "알수없음"}\nError Message: ${error.message ?? "없음"}\nError code: ${error.code}`)
        updateLoadingState(100,"ERR");
        return;
    }

    const getWaitQueue = async () => {
        updateLoadingState(10, "기존 단어 주제 수정 요청 목록 가져오는 중...");
        const {data: waitThemeWordData, error: waitThemeWordError} = await SCM.get().allWordWaitTheme();
        if (waitThemeWordError) {
            MakeError(waitThemeWordError);
            return;
        }

        updateLoadingState(30, "단어 삭제/추가 요청 단아 가져오는 중...");
        const {data: waitWordsData, error: waitWordsError} = await SCM.get().allWaitWords();
        if (waitWordsError){
            MakeError(waitWordsError);
            return;
        }

        updateLoadingState(60,"추가 요청 단어의 주제 목록 가져오는 중...");
        const {data: waitWordsThemesData, error: waitWordsThemesError} = await SCM.get().waitWordsThemes(waitWordsData.filter((d)=>d.request_type === "add").map(({id})=>id));
        if (waitWordsThemesError){
            MakeError(waitWordsThemesError);
            return;
        }

        updateLoadingState(85, "데이터를 가공 중...");
        const waitQueue: WordRequest[] = [];

        type KK = {
            id: number;
            request_type: "theme_change";
            word: string;
            word_id: number;
            requested_at: string;
            requested_by: string;
            requested_by_uuid?: string;
        }
        const waitThemes: DefaultDict<string, Theme[]> = new DefaultDict(() => []);
        const waitThemesWord: Record<string, KK> = {}
        waitThemeWordData.forEach((data, index)=>{
            waitThemesWord[data.words.word] = {
                id: 10**8 + index,
                request_type: "theme_change",
                word: data.words.word,
                word_id: data.word_id,
                requested_by_uuid: data.req_by ?? undefined,
                requested_by: data.users?.nickname ?? "unknow",
                requested_at: data.req_at
            }

            waitThemes.get(data.words.word).push({
                theme_id: data.theme_id,
                theme_name: data.themes.name,
                typez: data.typez,
                theme_code: data.themes.code
            })
        });

        waitThemes.sortedEntries().forEach((data)=>{
            const r: WordRequest ={
                ...waitThemesWord[data[0]],
                wait_themes: data[1],
            }
            waitQueue.push(r);
        });

        const waitWordsAddThemes: DefaultDict<number, Theme[]> = new DefaultDict(() => []);
        waitWordsThemesData.forEach((data)=>{
            waitWordsAddThemes.get(data.wait_word_id).push({
                theme_id: data.theme_id,
                theme_name: data.themes.name,
                theme_code: data.themes.code,
                typez: "add"
            })
        })

        waitWordsData.forEach((data)=>{
            const r: WordRequest = {
                id: data.id,
                word: data.word,
                request_type: data.request_type,
                requested_at: data.requested_at,
                requested_by_uuid: data.requested_by ?? undefined,
                requested_by: data.users?.nickname ?? "unknown",
                wait_themes: data.request_type === "add" ? waitWordsAddThemes.get(data.id) : undefined,
                word_id: data.words?.id
            }
            waitQueue.push(r);
        });

        setWaitData(waitQueue);
        updateLoadingState(100, "완료!")
    }

    useEffect(()=>{
        getWaitQueue();
    },[])

    if (loadingState.isLoading) {
        return (
            <LoadingPage title={"관리자 페이지"} />
        );
    }

    if (errorMessage){
        return <ErrorPage message={errorMessage}/>
    }

    if (waitData){
        return <AdminHome requestData={waitData} refreshFn={getWaitQueue} />
    }
}
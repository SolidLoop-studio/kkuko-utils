"use client";
import { SCM } from "@/src/app/lib/supabaseClient";
import ErrorPage from "../components/ErrorPage";
import LoadingPage, { useLoadingState } from '@/src/app/components/LoadingPage';
import { useEffect, useState } from "react";
import WordCombinerClient from "./WordCombinerClient";

export default function WordCombinerPage() {
    const { loadingState, updateLoadingState } = useLoadingState();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [wordsList, setWordsList] = useState<{ len6: string[], len5: string[] } | null>(null);

    useEffect(() => {
        const getWords = async () => {
            updateLoadingState(10, "단어 데이터 가져 오는중...");
            const { data, error } = await SCM.get().allWords({lenf: true});
            if (error) {
                return setErrorMessage(`단어 데이터 로드중 오류.\nErrorName: ${error.name ?? "알수없음"}\nError Message: ${error.message ?? "없음"}\nError code: ${error.code}`)
            }

            await new Promise(resolve => setTimeout(resolve, 1));
            updateLoadingState(60, "데이터 가공중...")
            const len6 = data.filter(({ word }) => word.length === 6).map(({ word }) => word);
            const len5 = data.filter(({ word }) => word.length === 5).map(({ word }) => word);

            setWordsList({ len5, len6 });
            updateLoadingState(100, '완료!');
            await new Promise(resolve => setTimeout(resolve, 1));
        }
        getWords()
    }, []);

    if (loadingState.isLoading) return <LoadingPage title={"단어 데이터"} />

    if (errorMessage) return <ErrorPage message={errorMessage} />

    if (wordsList) return <WordCombinerClient prop={wordsList} />
}
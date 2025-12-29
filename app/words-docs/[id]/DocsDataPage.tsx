"use client";
import DocsDataHome from "./DocsDataHome";
import { SCM } from "@/app/lib/supabaseClient";
import NotFound from "@/app/not-found-client";
import ErrorPage from "@/app/components/ErrorPage";
import { useState, useEffect } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import LoadingPage, {useLoadingState } from '@/app/components/LoadingPage';

type wordsDataType = ({
    word: string;
    status: "add" | "delete";
    maker: string | null | undefined;
} | {
    word: string;
    status: "ok";
    maker: undefined;
})

export default function DocsDataPage({id}:{id:number}){
    const [isNotFound,setIsNotFound] = useState(false);
    const { loadingState, updateLoadingState } = useLoadingState();
    const [errorMessage,setErrorMessage] = useState<string|null>(null);
    const [wordsData,setWordsData] = useState<{words:wordsDataType[], metadata:{title:string, lastUpdate:string, typez: "letter" | "theme" | "ect"}, starCount: string[]} | null>(null);

    const makeError = (error: PostgrestError) => {
        setErrorMessage(`문서 정보 데이터 로드중 오류.\nErrorName: ${error.name ?? "알수없음"}\nError Message: ${error.message ?? "없음"}\nError code: ${error.code}`)
        updateLoadingState(100,"ERR");
        return;
    }

    useEffect(()=>{
        const getData = async () => {
            updateLoadingState(10,"문서 정보 가져오는 중...")
            const {data: docsData, error: docsDataError} = await SCM.get().docsInfoByDocsId(id);
            if (docsDataError) return makeError(docsDataError);
            if (docsData===null) return setIsNotFound(true);
            const {data: docsStarData, error: docsStarError} = await SCM.get().docsStar(docsData.id);
            if (docsStarError) return makeError(docsStarError);

            if (id === 208 || id === 223 || id === 238) {
                const p = {title: docsData.name, lastUpdate: docsData.last_update, typez: docsData.typez}
                setWordsData({words: [], metadata: p, starCount:docsStarData.map(({user_id})=>user_id)});
                await SCM.update().docView(docsData.id);
                updateLoadingState(100, "완료!");
                return;
            }

            if (docsData.typez === "letter"){
                updateLoadingState(40, "문서에 들어간 단어 정보 가져오는 중...");
                const {data, error: LetterDataError} = await SCM.get().docsWords({name: docsData.name, duem: docsData.duem, typez: "letter"});
                if (LetterDataError) return makeError(LetterDataError);
                const {words: LetterData1, waitWords: LetterData2} = data;

                await new Promise(resolve => setTimeout(resolve, 1))
                updateLoadingState(70, "데이터를 가공중...")
                
                // 삭제 요청인 단어는 제외
                const wordsNotInB = LetterData1.filter(a => !LetterData2.some(b => b.word === a.word)).map((p)=>({word: p.word, status: "ok" as const, maker: undefined}));
                const wordsData = [...wordsNotInB, ...LetterData2.filter(({word})=>word.length > 1).map(({word,requested_by,request_type})=>({word, status: request_type, maker:requested_by}))]
                const p = {title: docsData.name, lastUpdate: docsData.last_update, typez:docsData.typez}
                setWordsData({words: wordsData, metadata: p, starCount:docsStarData.map(({user_id})=>user_id)});
                await SCM.update().docView(docsData.id);
                updateLoadingState(100, "완료!");
                return;
            }
            else if (docsData.typez === "theme"){
                updateLoadingState(30, "문서에 들어간 단어 정보 가져오는 중...");
                const {data: themeData, error: themeDataError} = await SCM.get().themeInfoByThemeName(docsData.name);
                if (themeDataError) return makeError(themeDataError);
                if (!themeData) return setIsNotFound(true)

                const {data, error} = await SCM.get().docsWords({name: docsData.name, duem: docsData.duem, typez: "theme"})
                if (error) return makeError(error);

                await new Promise(resolve => setTimeout(resolve, 1))
                updateLoadingState(70, "데이터를 가공중...")
                
                const {words, waitWords} = data;

                const wordsData = [ ...words.map(({word})=>({ word, status: "ok" as const, maker: undefined })), ...waitWords.map(({word, requested_by, request_type})=>({word, status: request_type, maker: requested_by ?? undefined})) ];
                const p = {title: docsData.name, lastUpdate: docsData.last_update, typez: docsData.typez}
                setWordsData({words: wordsData, metadata: p, starCount:docsStarData.map(({user_id})=>user_id)});

                await SCM.update().docView(docsData.id);
                updateLoadingState(100, "완료!");
                return

            }
            else{
                await new Promise(resolve => setTimeout(resolve, 1));
                updateLoadingState(30, "문서에 들어간 단어 정보 가져오는 중...");
                const {data, error} = await SCM.get().docsWords({name: docsData.id, duem: docsData.duem, typez: "ect"});
                if (error) return makeError(error);
                if (data===null) return setIsNotFound(true);
                const {words, waitWords} = data;

                await new Promise(resolve => setTimeout(resolve, 1));
                updateLoadingState(70, "데이터를 가공중...");
                
                const wordsData = [ ...words.map(({word})=>({ word, status: "ok" as const, maker: undefined })), ...waitWords.map(({word, requested_by, request_type})=>({word, status: request_type, maker: requested_by ?? undefined})) ];
                const p = {title: docsData.name, lastUpdate: docsData.last_update, typez: docsData.typez}
                setWordsData({words: wordsData, metadata: p, starCount:docsStarData.map(({user_id})=>user_id)});

                await SCM.update().docView(docsData.id);
                updateLoadingState(100, "완료!");
                return;
            }
        }
        getData();
    },[])
    
    if (isNotFound) return <NotFound />;

    if (loadingState.isLoading) return <LoadingPage title={"문서"} />
    
    if (errorMessage) return <ErrorPage message={errorMessage}/>

    if (wordsData) return <DocsDataHome id={id} data={wordsData.words.sort((a,b)=>a.word.localeCompare(b.word,'ko'))} metaData={wordsData.metadata} starCount={wordsData.starCount} isSpecial={(209 <= id && id <= 222) || (224<= id && id <= 237) || (239<= id && id <= 252)}/>
    
}
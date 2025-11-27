"use client";
import WordInfo from './WordInfo';
import { SCM } from '@/app/lib/supabaseClient';
import ErrorPage from '@/app/components/ErrorPage';
import { useEffect, useState } from 'react';
import type { PostgrestError } from '@supabase/supabase-js';
import { calculateKoreanInitials, count } from '@/app/lib/lib';
import LoadingPage, {useLoadingState } from '@/app/components/LoadingPage';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { WordInfoProps } from './WordInfo';

export default function WordInfoPage({ query }: { query: string }) {
    const [errorView, setErrorView] = useState<string | null>(null);
    const [wordInfo, setWordInfo] = useState<WordInfoProps | null>(null);
    const [isNotFound, setIsNotFound] = useState(false);
    const router = useRouter();

    // 로딩 상태를 더 상세하게 관리하기 위한 상태
    const { loadingState, updateLoadingState } = useLoadingState();

    const makeError = (erorr: PostgrestError) => {
        setErrorView(`단어 정보 데이터 로드중 오류.\nErrorName: ${erorr.name ?? "알수없음"}\nError Message: ${erorr.message ?? "없음"}\nError code: ${erorr.code}`);
    };

    const goTo404 = () => {
        router.push("/404");
    };

    const wordSetFunc = (wordInfo: {
        id: number,
        word: string,
        noin_canuse?: boolean,
        k_canuse?: boolean,
        typez: "ok" | "add" | "delete",
        requested_by?: string | null,
        requested_by_uuid?: string | null,
        requested_at?: string | null,
        documents: { doc_id: number; doc_name: string }[],
        themes: {
            ok: string[];
            waitAdd: string[];
            waitDel: string[];
        },
        goFirstLetterWords: () => Promise<number>;
        goLastLetterWords: () => Promise<number>;
        exp?: string;
    }) => {
        const mission: [string, number][] = [];
        for (const c of "가나다라마바사아자차카타파하") {
            const pp = count(wordInfo.word,c)
            if (pp) {
                mission.push([c, pp]);
            }
        }

        const gget = () => {
            return (<a
                href={wordInfo.exp}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 transition-colors"
            >
                해당 단어가 끄코위키에 있습니다.
            </a>)
        }

        const gf = async (f: string[]) => {
            updateLoadingState(10, "단어 정보 확인 중...");
            const {data, error} = await SCM.get().randomWordByFirstLetter(f)
            if (error) return makeError(error)
            if (data){
                router.push(`/word/search/${data}`)
            } else {
                router.push(`/word/search/${wordInfo.word}`)
            }
            
        }

        const lf = async (l: string[]) => {
            updateLoadingState(10, "단어 정보 확인 중...");
            const {data, error} = await SCM.get().randomWordByLastLetter(l)
            if (error) return makeError(error)
            if (data){
                router.push(`/word/search/${data}`)
            } else {
                router.push(`/word/search/${wordInfo.word}`)
            }
        }

        setWordInfo({
            word: wordInfo.word,
            initial: calculateKoreanInitials(wordInfo.word),
            length: wordInfo.word.length,
            isChainable: wordInfo.k_canuse ?? true,
            isSeniorApproved: wordInfo.noin_canuse ?? false,
            dbId: wordInfo.id,
            missionLetter: mission,
            status: wordInfo.typez === "ok" ? "ok" : wordInfo.typez === "add" ? "추가요청" : "삭제요청",
            requester: wordInfo.requested_by ?? undefined,
            requester_uuid: wordInfo.requested_by_uuid ?? undefined,
            requestTime: wordInfo.requested_at ?? undefined,
            documents: wordInfo.documents,
            topic: wordInfo.themes,
            goFirstLetterWords: wordInfo.goFirstLetterWords,
            goLastLetterWords: wordInfo.goLastLetterWords,
            moreExplanation: wordInfo.exp ? gget() : undefined,
            goFirstLetterWord: gf,
            goLastLetterWord: lf
        });
    };

    useEffect(() => {
        const fetchWordInfo = async () => {
            try {
                updateLoadingState(10, "단어 정보 확인 중...");

                // 단어 테이블 확인
                const { data: wordTableCheck, error: wordTableCheckError } = await SCM.get().wordInfoByWord(query)
                if (wordTableCheckError) { return makeError(wordTableCheckError); }

                updateLoadingState(20, "대기 단어 정보 확인 중...");

                // 대기 테이블 확인
                const { data: waitTableCheck, error: waitTableCheckError } = await SCM.get().waitWordInfoByWord(query);
                if (waitTableCheckError) { return makeError(waitTableCheckError); }

                if (wordTableCheck) {
                    updateLoadingState(40, "단어 주제 정보 가져오는 중...");

                    // 단어 주제 정보 가져오기
                    const { data: wordThemes, error: wordThemesError } = await SCM.get().wordThemeByWordId(wordTableCheck.id);
                    if (wordThemesError) { return makeError(wordThemesError); }

                    updateLoadingState(60, "단어 대기 주제 정보 가져오는 중...");

                    // 단어 대기 주제 정보 가져오기
                    const { data: wordThemes2, error: wordThemesError2 } = await SCM.get().wordThemeWaitByWordId(wordTableCheck.id);
                    if (wordThemesError2) { return makeError(wordThemesError2); }

                    updateLoadingState(70, "문서 연결 정보 가져오는 중...");

                    // 문서 연결 정보 가져오기
                    const { data: docsData3, error: docsData3Error} = await SCM.get().letterDocsByWord(wordTableCheck.word);
                    if (docsData3Error){ return makeError(docsData3Error); }
                    
                    const {data: docsData4, error: docsData4Error} = await SCM.get().themeDocsByThemeNames([...wordThemes.map(d=>d.themes.name),...wordThemes2.map(d=>d.themes.name)]);
                    if (docsData4Error){
                        return makeError(docsData4Error);
                    }
                    const docc = docsData3.concat(docsData4).map(({id,name})=>({doc_id: id, doc_name: name}))

                    const ff = async () => {
                        return await SCM.get().firstWordCountByLetters(wordTableCheck.word[0]);
                    }

                    const lf = async () => {
                        return await SCM.get().lastWordCountByLetters(wordTableCheck.word[wordTableCheck.word.length - 1]);
                    }

                    let kkukoWikiok = false

                    const url = `/api/get_kkukowiki?title=${wordTableCheck.word}`;
                    try{
                        const response = await axios.get(url);
                          if (response.status === 200){
                            kkukoWikiok = true
                          }
                    } catch{ }

                    updateLoadingState(90, "정보 가공 중...");
                    await new Promise(resolve => setTimeout(resolve, 1));

                    // 단어 정보 가공 및 설정
                    wordSetFunc({
                        id: wordTableCheck.id,
                        word: wordTableCheck.word,
                        typez: waitTableCheck && waitTableCheck.request_type === "delete" ? "delete" : "ok",
                        documents: [...docc],
                        themes: {
                            ok: wordThemes ? wordThemes.filter(theme => !wordThemes2.map(t => t.themes.name).includes(theme.themes.name)).map(theme => theme.themes.name) : [],
                            waitAdd: wordThemes2 ? wordThemes2.filter(theme => theme.typez === 'add').map(theme => theme.themes.name) : [],
                            waitDel: wordThemes2 ? wordThemes2.filter(theme => theme.typez === 'delete').map(theme => theme.themes.name) : [],
                        },
                        noin_canuse: wordTableCheck.noin_canuse,
                        k_canuse: wordTableCheck.k_canuse,
                        requested_by: waitTableCheck && waitTableCheck.request_type === "delete" ? waitTableCheck.users?.nickname : wordTableCheck.users?.nickname,
                        requested_by_uuid: waitTableCheck && waitTableCheck.request_type === "delete" ? waitTableCheck.requested_by : wordTableCheck.added_by,
                        requested_at: waitTableCheck && waitTableCheck.request_type === "delete" ? waitTableCheck.requested_at : wordTableCheck.added_at,
                        goFirstLetterWords: ff,
                        goLastLetterWords: lf,
                        exp: kkukoWikiok ? `https://kkukowiki.kr/w/${wordTableCheck.word}` : undefined
                    });

                } else if (waitTableCheck) {
                    updateLoadingState(50, "대기 단어 주제 정보 가져오는 중...");

                    // 대기 단어 주제 정보 가져오기
                    const { data: waitWordThemes, error: waitWordThemesError } = await SCM.get().waitWordThemes(waitTableCheck.id);
                    if (waitWordThemesError) { return makeError(waitWordThemesError); }

                    updateLoadingState(75, "대기 단어 문서 정보 가져오는 중...");

                    // 대기 단어 문서 정보 가져오기
                    const {data: waitDocsData4, error: waitDocsData4Error} = await SCM.get().themeDocsByThemeNames([...waitWordThemes.map(d=>d.themes.name)]);
                    if (waitDocsData4Error){ return makeError(waitDocsData4Error); }

                    const { data: waitDocsData2, error: waitDocsData2Error} = await SCM.get().letterDocsByWord(waitTableCheck.word);
                    if (waitDocsData2Error){ return makeError(waitDocsData2Error); }
                    
                    const docc = waitDocsData2.concat(waitDocsData4).map(({id,name})=>({doc_id: id, doc_name: name}))

                    const ff = async () => {
                        return await SCM.get().firstWordCountByLetters(waitTableCheck.word[0]);

                    }

                    const lf = async () => {
                        return await SCM.get().lastWordCountByLetters(waitTableCheck.word[waitTableCheck.word.length - 1]);
                    }

                    updateLoadingState(90, "정보 가공 중...");

                    // 대기 단어 정보 가공 및 설정
                    wordSetFunc({
                        id: waitTableCheck.id,
                        word: waitTableCheck.word,
                        typez: waitTableCheck.request_type,
                        documents: [...docc],
                        themes: {
                            ok: [],
                            waitAdd: waitWordThemes ? waitWordThemes.map(theme => theme.themes.name) : [],
                            waitDel: [],
                        },
                        requested_by: waitTableCheck.users?.nickname,
                        requested_by_uuid: waitTableCheck.requested_by,
                        requested_at: waitTableCheck.requested_at,
                        goFirstLetterWords: ff,
                        goLastLetterWords: lf
                    });
                } else {
                    setIsNotFound(true);
                }

                updateLoadingState(100, "완료!");
            } catch (error) {
                console.error("데이터 로딩 중 오류 발생:", error);
                updateLoadingState(
                    100,
                    "오류 발생"
                );
            }
        };

        try{
            fetchWordInfo();
        } catch(error){
            if (error instanceof Error){
                updateLoadingState(100, "오류 발생");
                setErrorView(`단어 정보 데이터 로드중 오류.\nErrorName: ${error.name ?? "알수없음"}\nError Message: ${error.message ?? "없음"}`)
            }
        }
        
    }, [query]);

    if (isNotFound) { goTo404(); return null; }

    if (loadingState.isLoading) { return <LoadingPage title={'단어 정보'} /> }

    if (errorView) {return <ErrorPage message={errorView} /> }

    if (wordInfo) { return <WordInfo wordInfo={wordInfo} /> }

    return null;
}

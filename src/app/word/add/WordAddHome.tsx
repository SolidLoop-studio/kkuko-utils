"use client";

import React, { useEffect, useState } from "react";
import { useSelector } from 'react-redux';
import { RootState } from "@/src/app/store/store";
import ErrorModal from "@/src/app/components/ErrModal";
import CompleteModal from "@/src/app/components/CompleteModal";
import LoginRequiredModal from "@/src/app/components/LoginRequiredModal"
import FailModal from "@/src/app/components/FailModal";
import { SCM } from "@/src/app/lib/supabaseClient";
import { PostgrestError } from "@supabase/supabase-js";
import useSWR from "swr";
import { fetcher } from "../lib";
import WordAddForm from "../components/WordAddFrom";
import { isNoin } from "@/src/app/lib/lib";
import { DocsLogData } from "@/src/app/types/type";

interface TopicInfo {
    topicsCode: Record<string, string>;
    topicsKo: Record<string, string>;
    topicsID: Record<string, number>;
}

export default function WordAddHome(){
    const [error,setError] = useState<ErrorMessage | null>(null);
    const user = useSelector((state: RootState) => state.user);
    const [isLogin, setIsLogin] = useState(!!user.uuid);
    const [completeState, setCompleteState] = useState<{ word: string, selectedTheme: string, onClose: () => void } | null>(null);
    const [workFail, setWorkFail] = useState<string | null>(null);
    const [topicInfo, setTopicInfo] = useState<TopicInfo>({
        topicsCode: {},
        topicsKo: {},
        topicsID: {}
    });
    const { data } = useSWR("themes", fetcher, { dedupingInterval: 120000 });

    useEffect(() => {
        setIsLogin(!!user.uuid);
    }, [user]);

    useEffect(() => {
        if (!data) return;
        const newTopicsCode: Record<string, string> = {};
        const newTopicsKo: Record<string, string> = {};
        const newTopicID: Record<string, number> = {};

        data.forEach((d: { code: string, name: string, id: number }) => {
            newTopicsCode[d.code] = d.name;
            newTopicsKo[d.name] = d.code;
            newTopicID[d.code] = d.id;
        });

        setTopicInfo({
            topicsCode: newTopicsCode,
            topicsKo: newTopicsKo,
            topicsID: newTopicID
        });
    }, [data]);

    const makeError = (error: PostgrestError) => {
        setError({
            ErrName: error.name || "Unknown Error",
            ErrMessage: error.message || "An unknown error occurred",
            ErrStackRace: error.code || "",
            inputValue: `/word/add`
        });
    }

    const onSaveByAdmin = async (word: string, themes: string[]) => {
        if (!user.uuid || !['admin','r4'].includes(user.role)) return;

        const { data: existingWord, error: exstedCheckError } = await SCM.get().wordInfoByWord(word);

        if (exstedCheckError) { return makeError(exstedCheckError); }
        if (existingWord) { return setWorkFail("이미 존재하는 단어입니다."); }

        const { data: insertedWord, error: insertedWordError } = await SCM.add().word([{
            word, 
            added_by: user.uuid,
            noin_canuse: isNoin(themes),
        }]);
        if (insertedWordError) { return makeError(insertedWordError); }
        if (!insertedWord || insertedWord.length === 0) { return setWorkFail("단어 추가에 실패했습니다."); }

        const { error: insertWordLogError } = await SCM.add().wordLog([{
            word,
            make_by: user.uuid,
            processed_by: user.uuid,
            r_type: "add",
            state: "approved"
        }]);
        if (insertWordLogError) { return makeError(insertWordLogError); }

        const insertWordThemesQuery = themes
            .filter(tc => topicInfo.topicsID[tc])
            .map(tc => ({
                word_id: insertedWord[0].id,
                theme_id: topicInfo.topicsID[tc]
            }));

        const { data: insertWordThemesData ,error: insertWordThemesError } = await SCM.add().wordThemes(insertWordThemesQuery);
        if (insertWordThemesError) { return makeError(insertWordThemesError); }

        const { data: docsData, error: docsError } = await SCM.get().allDocs();
        if (docsError) { return makeError(docsError); }

        const letterDocs = docsData.filter(d => d.typez === 'letter');
        const themeDocs = docsData.filter(d => d.typez === 'theme');

        const docsLogQuery: DocsLogData[] = [];

        for (const doc of letterDocs){
            if (doc.name === word[word.length - 1]) {
                docsLogQuery.push({
                    word: word,
                    docs_id: doc.id,
                    add_by: user.uuid,
                    type: "add"
                });
            }
        }

        for (const insertedTheme of insertWordThemesData){
            for (const doc of themeDocs){
                if (doc.name === insertedTheme.themes.name) {
                    docsLogQuery.push({
                        word: word,
                        docs_id: doc.id,
                        add_by: user.uuid,
                        type: "add"
                    });
                }
            }
        }

        const { error: insertDocsLogError } = await SCM.add().docsLog(docsLogQuery);
        if (insertDocsLogError) { return makeError(insertDocsLogError); }

        await SCM.update().docsLastUpdate(docsLogQuery.map(d => d.docs_id));

        setCompleteState({
            word: word,
            selectedTheme: themes.map(code => topicInfo.topicsCode[code]).join(', '),
            onClose: () => {
                setCompleteState(null);
            }
        });
    }

    const onSave = async (word: string, themes: string[]) => {
        if (!user.uuid) return;
        if (['admin','r4'].includes(user.role)) {
            return onSaveByAdmin(word, themes);
        }

        try {
            // Check if word already exists
            const { data: existingWord, error: exstedCheckError } = await SCM.get().wordInfoByWord(word);

            if (exstedCheckError) { return makeError(exstedCheckError); }

            if (existingWord) { return setWorkFail("이미 존재하는 단어입니다."); }

            // Insert word into wait list
            const insertWaitWordData = {
                word,
                requested_by: user.uuid,
                request_type: "add" as const
            };

            const { data: insertedWaitWord, error: insertedWaitWordError } = await SCM.add().waitWord(insertWaitWordData);

            if (insertedWaitWordError) {
                if (insertedWaitWordError.code === '23505') {
                    return setWorkFail("이미 요청이 들어온 단어입니다.");
                    
                }
                return makeError(insertedWaitWordError);
            }

            // Insert selected topics
            if (insertedWaitWord) {
                const insertWaitWordTopicsData = themes
                    .filter(tc => topicInfo.topicsID[tc])
                    .map(tc => ({
                        wait_word_id: insertedWaitWord.id,
                        theme_id: topicInfo.topicsID[tc]
                    }));

                const { error: insertWaitWordTopicsDataError } = await SCM.add().waitWordThemes(insertWaitWordTopicsData);

                if (insertWaitWordTopicsDataError) {
                    throw insertWaitWordTopicsDataError;
                }

                setCompleteState({
                    word: word,
                    selectedTheme: themes.map(code => topicInfo.topicsCode[code]).join(', '),
                    onClose: () => {
                        setCompleteState(null);
                    }
                });

            }

        } 
        catch { } 
        finally { }
        
    };


    return (
        <div className="dark:bg-gray-900">

            <WordAddForm saveFn={onSave} />

            {/* Modals */}
            {error &&
                <ErrorModal
                    error={error}
                    onClose={() => setError(null)}
                />
            }

            {completeState &&
                <CompleteModal
                    open={!!completeState}
                    onClose={completeState.onClose}
                    title={`단어 추가${['admin','r4'].includes(user.role) ? "가" : " 요청이"} 완료되었습니다.`}
                    description={`단어: ${completeState.word} 주제: ${completeState.selectedTheme}의 ${['admin','r4'].includes(user.role) ? "추가가" : "추가요청이"} 완료되었습니다.`}
                />
            }

            {workFail &&
                <FailModal
                    open={!!workFail}
                    onClose={() => setWorkFail(null)}
                    description={workFail}
                />
            }

            {!isLogin &&
                <LoginRequiredModal
                    open={!isLogin}
                    onClose={() => setIsLogin(true)}
                />
            }
        </div>
        
    )


}
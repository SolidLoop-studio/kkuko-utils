"use client";

import React, { useEffect, useState } from "react";
import { useSelector } from 'react-redux';
import { RootState } from "@/src/app/store/store";
import ErrorModal from "@/src/app/components/ErrModal";
import CompleteModal from "@/src/app/components/CompleteModal";
import LoginRequiredModal from "@/src/app/components/LoginRequiredModal"
import FailModal from "@/src/app/components/FailModal";
import WordAddForm from "../components/WordAddFrom";
import type { ApplicationError } from "@/src/shared/application/application-error";
import { useWordThemes } from "@/src/modules/word-catalog";
import { useDirectWordAddition } from "@/src/modules/word-moderation";
import { useUserWordRequests } from "@/src/modules/word-requests";

interface TopicInfo {
    topicsCode: Record<string, string>;
}

export default function WordAddHome(){
    const [error,setError] = useState<ErrorMessage | null>(null);
    const user = useSelector((state: RootState) => state.user);
    const [isLogin, setIsLogin] = useState(!!user.uuid);
    const [completeState, setCompleteState] = useState<{ word: string, selectedTheme: string, onClose: () => void } | null>(null);
    const [workFail, setWorkFail] = useState<string | null>(null);
    const [topicInfo, setTopicInfo] = useState<TopicInfo>({
        topicsCode: {},
    });
    const { data = [] } = useWordThemes(true);
    const { addDirectly } = useDirectWordAddition();
    const { requestAddition } = useUserWordRequests();

    useEffect(() => {
        setIsLogin(!!user.uuid);
    }, [user]);

    useEffect(() => {
        if (!data) return;
        const newTopicsCode: Record<string, string> = {};

        data.forEach((d) => {
            newTopicsCode[d.code] = d.name;
        });

        setTopicInfo({
            topicsCode: newTopicsCode,
        });
    }, [data]);

    const makeApplicationError = (applicationError: ApplicationError) => {
        setError({
            ErrName: `ApplicationError:${applicationError.kind}`,
            ErrMessage: applicationError.message,
            ErrStackRace: "",
            inputValue: "/word/add",
        });
    };

    const onSaveByAdmin = async (word: string, themes: string[]) => {
        if (!user.uuid || !['admin','r4'].includes(user.role)) return;

        const result = await addDirectly({ word, themeCodes: themes });
        if (!result.ok) {
            if (result.error.kind === 'conflict') {
                setWorkFail(result.error.message);
            } else {
                makeApplicationError(result.error);
            }
            return;
        }

        setCompleteState({
            word: result.value.word,
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

        const result = await requestAddition({ word, themeCodes: themes });
        if (!result.ok) {
            if (result.error.kind === 'conflict') {
                setWorkFail(result.error.message);
            } else {
                makeApplicationError(result.error);
            }
            return;
        }

        setCompleteState({
            word: result.value.word,
            selectedTheme: result.value.themes.map(({ themeName }) => themeName).join(', '),
            onClose: () => {
                setCompleteState(null);
            }
        });
        
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

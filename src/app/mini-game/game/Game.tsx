"use client";
import { useEffect, useState } from "react";
import KkutuChat from "./GameChat";
import KkutuMenu from "./components/KkutuMenu";
import GameBox from "./GameBox";
import GameBody from "./GameBody";
import GameSetup, { PRACTICE_TYPE_STORAGE_KEY, TYPING_SETTING_STORAGE_KEY } from "./GameSetup";
import { ChatProvider } from "./hooks/useChat";
import { soundManager } from "./lib/SoundManager";
import { useGameState } from "./hooks/useGameState";
import TypingPracticeBody from "./typing-practice/TypingPracticeBody";
import type { TypingPracticeSettings } from "./typing-practice/types/typing-practice.types";

type PracticeType = 'word-chain' | 'typing-practice';

const defaultTypingPracticeSetting: TypingPracticeSettings = {
    sessionMode: 'timed',
    durationSeconds: 60,
    wordCount: 25,
    language: 'all',
    order: 'random',
    minLength: 2,
};

/**
 * 게임 전체를 감싸는 최상위 컴포넌트
 * 사운드 로드 및 주요 컴포넌트 배치를 담당합니다.
 */
const Game = () => {
    const { isPlaying, exitGame } = useGameState();
    const [practiceType, setPracticeType] = useState<PracticeType>('word-chain');
    const [typingPracticeSetting, setTypingPracticeSetting] = useState<TypingPracticeSettings>(defaultTypingPracticeSetting);

    // 컴포넌트 마운트 시 사운드 리소스 로드
    useEffect(() => {
        soundManager.load();
    }, []);

    useEffect(() => {
        try {
            const rawPracticeType = localStorage.getItem(PRACTICE_TYPE_STORAGE_KEY);
            setPracticeType(rawPracticeType === 'typing-practice' ? 'typing-practice' : 'word-chain');

            const rawTypingSetting = localStorage.getItem(TYPING_SETTING_STORAGE_KEY);
            if (rawTypingSetting) {
                setTypingPracticeSetting({ ...defaultTypingPracticeSetting, ...JSON.parse(rawTypingSetting) });
            }
        } catch (e) {
            console.error(e);
        }
    }, [isPlaying]);

    return (
        <ChatProvider>
            <div>
                <KkutuMenu />
                {isPlaying ? (
                    <GameBox>
                        {practiceType === 'typing-practice' ? (
                            <TypingPracticeBody settings={typingPracticeSetting} onExitToSetup={() => exitGame()} />
                        ) : (
                            <GameBody />
                        )}
                    </GameBox>
                ) : (
                    <GameSetup />
                )}
                <KkutuChat />
            </div>
        </ChatProvider>
    );
};

export default Game;

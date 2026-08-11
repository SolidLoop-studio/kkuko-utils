"use client";
import { useEffect, useState } from "react";
import KkutuChat from "./GameChat";
import KkutuMenu from "./components/KkutuMenu";
import GameBox from "./GameBox";
import GameBody from "./GameBody";
import GameSetup from "./GameSetup";
import { ChatProvider } from "./hooks/useChat";
import { soundManager } from "./lib/SoundManager";
import { useGameState } from "./hooks/useGameState";
import { getAllWords, hasWords } from "./lib/wordDB";
import TypingPracticeBody from "./typing-practice/TypingPracticeBody";
import { TypingPracticeLogic } from "./typing-practice/lib/TypingPracticeLogic";
import {
    DEFAULT_PRACTICE_CONFIG,
    loadPracticeConfig,
    writePracticeType,
    writeTypingPracticeSetting,
} from "./typing-practice/lib/typing-practice-config";

/**
 * 게임 전체를 감싸는 최상위 컴포넌트
 * 사운드 로드 및 주요 컴포넌트 배치를 담당합니다.
 */
const Game = () => {
    const { isPlaying, startPractice, exitGame, blockStart } = useGameState();
    const [practiceConfig, setPracticeConfig] = useState(DEFAULT_PRACTICE_CONFIG);
    const [typingSessionKey, setTypingSessionKey] = useState(0);
    const [typingExitRequestToken, setTypingExitRequestToken] = useState(0);
    const [typingExitConfirmOpen, setTypingExitConfirmOpen] = useState(false);
    const [isTypingPracticeFinished, setIsTypingPracticeFinished] = useState(false);

    // 컴포넌트 마운트 시 사운드 리소스 로드
    useEffect(() => {
        soundManager.load();
    }, []);

    useEffect(() => {
        setPracticeConfig(loadPracticeConfig());
    }, []);

    const handlePracticeTypeChange = (practiceType: typeof practiceConfig.practiceType) => {
        writePracticeType(practiceType);
        setPracticeConfig((current) => ({ ...current, practiceType }));
    };

    const handleTypingPracticeSettingsChange = (typingSettings: typeof practiceConfig.typingSettings) => {
        writeTypingPracticeSetting(typingSettings);
        setPracticeConfig((current) => ({ ...current, typingSettings }));
    };

    const handleStartTypingPractice = async () => {
        try {
            if (!(await hasWords())) {
                blockStart('단어를 먼저 업로드해주세요.');
                return;
            }

            const words = await getAllWords();
            const queue = TypingPracticeLogic.prepareQueue(words, practiceConfig.typingSettings);
            if (queue.length === 0) {
                blockStart('조건에 맞는 100자 이하 단어가 없습니다. 언어나 최소 글자 수를 조정해주세요.');
                return;
            }

            setTypingSessionKey((current) => current + 1);
            setIsTypingPracticeFinished(false);
            startPractice();
        } catch (e) {
            console.error(e);
            blockStart('단어를 확인할 수 없습니다. 다시 시도해주세요.');
        }
    };

    const handleRestartTypingPractice = () => {
        setIsTypingPracticeFinished(false);
        setTypingSessionKey((current) => current + 1);
    };

    const handleRequestTypingPracticeExit = () => {
        setTypingExitRequestToken((current) => current + 1);
    };

    return (
        <ChatProvider>
            <div>
                <KkutuMenu
                    practiceType={practiceConfig.practiceType}
                    onStartTypingPractice={handleStartTypingPractice}
                    onRequestTypingPracticeExit={handleRequestTypingPracticeExit}
                    onTypingPracticeExitConfirmChange={setTypingExitConfirmOpen}
                    isTypingPracticeFinished={isTypingPracticeFinished}
                    onExitFinishedTypingPractice={() => {
                        setTypingExitConfirmOpen(false);
                        exitGame();
                    }}
                />
                {isPlaying ? (
                    <GameBox>
                        {practiceConfig.practiceType === 'typing-practice' ? (
                            <TypingPracticeBody
                                key={typingSessionKey}
                                settings={practiceConfig.typingSettings}
                                onExitToSetup={() => exitGame()}
                                exitRequestToken={typingExitRequestToken}
                                isExitConfirmOpen={typingExitConfirmOpen}
                                onFinishedChange={setIsTypingPracticeFinished}
                            />
                        ) : (
                            <GameBody />
                        )}
                    </GameBox>
                ) : (
                    <GameSetup
                        practiceType={practiceConfig.practiceType}
                        typingPracticeSettings={practiceConfig.typingSettings}
                        onPracticeTypeChange={handlePracticeTypeChange}
                        onTypingPracticeSettingsChange={handleTypingPracticeSettingsChange}
                    />
                )}
                <KkutuChat
                    practiceType={practiceConfig.practiceType}
                    onStartTypingPractice={handleStartTypingPractice}
                    onRestartTypingPractice={handleRestartTypingPractice}
                    onExitTypingPractice={handleRequestTypingPracticeExit}
                />
            </div>
        </ChatProvider>
    );
};

export default Game;

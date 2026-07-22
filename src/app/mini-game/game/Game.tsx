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
import TypingPracticeBody from "./typing-practice/TypingPracticeBody";
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
    const { isPlaying, exitGame } = useGameState();
    const [practiceConfig, setPracticeConfig] = useState(DEFAULT_PRACTICE_CONFIG);

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

    return (
        <ChatProvider>
            <div>
                <KkutuMenu practiceType={practiceConfig.practiceType} />
                {isPlaying ? (
                    <GameBox>
                        {practiceConfig.practiceType === 'typing-practice' ? (
                            <TypingPracticeBody settings={practiceConfig.typingSettings} onExitToSetup={() => exitGame()} />
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
                <KkutuChat />
            </div>
        </ChatProvider>
    );
};

export default Game;

"use client";
import { useEffect } from "react";
import KkutuChat from "./KkutuChat";
import KkutuMenu from "./components/KkutuMenu";
import GameBox from "./GameBox";
import GameBody from "./GameBody";
import GameSetup from "./GameSetup";
import { ChatProvider } from "./hooks/useChat";
import { soundManager } from "./lib/SoundManager";
import { useGameState } from "./hooks/useGameState";

/**
 * 게임 전체를 감싸는 최상위 컴포넌트
 * 사운드 로드 및 주요 컴포넌트 배치를 담당합니다.
 */
const Game = () => {
    const { isPlaying } = useGameState();

    // 컴포넌트 마운트 시 사운드 리소스 로드
    useEffect(() => {
        soundManager.load();
    }, []);

    return (
        <ChatProvider>
            <div>
                <KkutuMenu />
                {isPlaying ? (
                    <GameBox>
                        <GameBody />
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
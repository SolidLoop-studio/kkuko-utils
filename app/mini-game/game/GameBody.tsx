import React from 'react';
import HistoryHolder from './components/HistoryHolder';
import GameInput from './components/GameInput';
import { useChat } from './hooks/useChat';
import { useGameLogic } from './hooks/useGameLogic';
import GraphBar from './components/GraphBar';
import { useEffect } from 'react';
import { duemLaw } from '@/lib/hangulUtils';
import GameResultModal from './components/GameResultModal';

/**
 * 게임의 메인 화면 컴포넌트
 * 게임 진행 상황, 캐릭터, 타이머 등을 표시합니다.
 */
const GameBody = () => {
    const { chatInput, handleChatInputChange, sendHint, setChatInput } = useChat();
    const {
        word,
        isFail,
        chainCount,
        turnTime,
        roundTime,
        missionChar,
        historyItems,
        inputVisible,
        turnInstant,
        animatingWord,
        visibleChars,
        pulseOn,
        inputRef,
        handleInput,
        TURN_TIME_LIMIT,
        ROUND_TIME_LIMIT,
        hintVisible,
        gameResult,
        closeGameResult
    } = useGameLogic();

    // Register the game's input handler and visibility into chat context so
    // the chat input can forward Enter presses to the game input when visible.
    const { registerGameHandleInput, setGameInputVisible } = useChat();

    useEffect(() => {
        registerGameHandleInput(handleInput);
        return () => {
            registerGameHandleInput(null);
        };
    }, [handleInput, registerGameHandleInput]);

    useEffect(() => {
        setGameInputVisible(inputVisible);
        return () => setGameInputVisible(false);
    }, [inputVisible, setGameInputVisible]);

    // 미션 글자가 포함된 단어 렌더링 (연두색 하이라이트)
    const renderWordWithMission = (text: string, showHighlight: boolean) => {
        if (animatingWord && text === animatingWord) {
            const wordLength = text.length;
            const isLongWord = wordLength >= 9;

            return (
                <span>
                    {text.split('').map((char, idx) => {
                        const isVisible = visibleChars[idx];
                        const isMissionChar = showHighlight && char === missionChar;

                        if (isLongWord && !isVisible) {
                            return null;
                        }

                        return (
                            <span
                                key={idx}
                                style={{
                                    display: 'inline-block',
                                    verticalAlign: 'middle',
                                    lineHeight: '20px',
                                    fontSize: isVisible && pulseOn ? '23px' : '20px',
                                    transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(1.2)',
                                    transition: 'transform 120ms ease-out, opacity 120ms ease-out',
                                    color: isMissionChar ? '#90EE90' : undefined,
                                    opacity: isVisible ? 1 : 0,
                                }}
                            >
                                {char}
                            </span>
                        );
                    })}
                </span>
            );
        }
        if (hintVisible) {
            return <span className="text-gray-400">{text}</span>;
        }
        return text && text.length === 1 && duemLaw(text, true) !== text ? `${text}(${duemLaw(text)})` : text;
    };

    return (
        <>
            <div className="relative">
                <div className="game-head flex items-start">
                    {/* 미션 글자 섹션 (왼손) */}
                    <div
                        className="items pt-[50px] mt-[50px] mx-[40px] ml-[105px] w-[100px] h-[110px] text-[24px] text-[#EEEEEE] font-bold text-center bg-[url('/img/lefthand.png')] bg-no-repeat"
                        style={{ textShadow: '0px 1px 5px #141414', opacity: missionChar ? 1 : 0 }}
                    >
                        {missionChar}
                    </div>

                    {/* 쪼리핑 캐릭터 및 디스플레이 섹션 */}
                    <div className="jjoriping w-[500px]">
                        {/* 캐릭터 얼굴 */}
                        <div className="relative">
                            <img
                                className="absolute top-[11px] left-[32px]"
                                src="/img/jjoeyeL.png"
                                alt="Left Eye"
                            />
                            <img
                                className="absolute top-[48px] left-[264px]"
                                src="/img/jjonose.png"
                                alt="Nose"
                            />
                            <img
                                className="absolute top-[11px] left-[460px]"
                                src="/img/jjoeyeR.png"
                                alt="Right Eye"
                            />
                        </div>

                        {/* 게임 정보 디스플레이 */}
                        <div className="p-[20px_5px_5px_5px] border-2 border-black rounded-bl-[10px] rounded-br-[10px] mt-[40px] w-[486px] h-[120px] bg-[#DEAF56] ml-8">
                            {/* 단어 표시 영역 */}
                            <div className={`p-[8px_5px] rounded-[10px] rounded-bl-none rounded-br-none w-[474px] h-[40px] text-[20px] text-center text-[#EEEEEE] bg-black/70 whitespace-nowrap overflow-hidden text-ellipsis ${isFail ? 'text-[#FF7777] line-through' : ''}`}>
                                {renderWordWithMission(word, !isFail)}
                            </div>

                            {/* 턴 시간 그래프 */}
                            <GraphBar
                                className="border-l border-r border-black/70 w-[474px] h-[20px] bg-[#70712D]"
                                min={0}
                                val={turnTime}
                                max={TURN_TIME_LIMIT}
                                bgc="#E6E846"
                                label={`${turnTime.toFixed(1)}초`}
                                noTransition={turnInstant}
                            />

                            {/* 라운드 시간 그래프 */}
                            <GraphBar
                                className="border-l border-r border-b border-black/70 rounded-bl-[10px] rounded-br-[10px] w-[474px] h-[20px] bg-[#223C6C]"
                                min={0}
                                val={roundTime}
                                max={ROUND_TIME_LIMIT}
                                bgc="#3573E4"
                                label={`${roundTime.toFixed(1)}초`}
                            />
                        </div>
                    </div>

                    {/* 연승 횟수 섹션 (오른손) */}
                    <div
                        className="chain pt-[50px] mt-[50px] mx-[105px] mr-[40px] w-[100px] h-[110px] text-[24px] text-[#EEEEEE] font-bold text-center bg-[url('/img/righthand.png')] bg-no-repeat"
                        style={{ textShadow: '0px 1px 5px #141414' }}
                    >
                        {chainCount}
                    </div>
                </div>

                {/* 게임 결과 다이얼로그 - absolute 위치로 우측 상단에 배치 */}
                {gameResult && (
                    <div className="absolute top-[50px] right-[40px] z-50">
                        <GameResultModal
                            usedWords={gameResult}
                            onClose={closeGameResult}
                        />
                    </div>
                )}
            </div>

            {/* 히스토리 및 입력창 */}
            <div className="ml-[60px]">
                <HistoryHolder historyItems={historyItems} />
            </div>
            <div className='ml-[270px]'>
                {inputVisible && (
                    <GameInput
                        placeholder="당신의 차례! 아래의 채팅 창에서 입력하세요."
                        readonly={false}
                        value={chatInput}
                        onChange={handleChatInputChange}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const trimmed = chatInput.trim();
                                if (trimmed === '/ㅍ' || trimmed === '/v') {
                                    // trigger global hint sender registered in chat log
                                    sendHint();
                                    setChatInput('');
                                    return;
                                }
                                if (trimmed === '/gg' || trimmed === '/ㅈㅈ') {
                                    // forward to game handler which will end the game
                                    handleInput(trimmed);
                                    setChatInput('');
                                    return;
                                }
                                // support start aliases if user types from head input
                                if (trimmed === '/시작') {
                                    handleInput(trimmed);
                                    setChatInput('');
                                    return;
                                }
                                handleInput(chatInput);
                            }
                        }}
                        inputRef={inputRef}
                    />
                )}
            </div>
        </>
    );
};

export default GameBody;
"use client";

import React from 'react';
import GameInput from '../components/GameInput';
import GraphBar from '../components/GraphBar';
import { useTypingPractice } from './hooks/useTypingPractice';
import TypingPracticeResultModal from './TypingPracticeResultModal';
import TypingTargetViewport from './TypingTargetViewport';
import type { TypingPracticeSettings } from './types/typing-practice.types';

type Props = {
    settings: TypingPracticeSettings;
    onExitToSetup: () => void;
    exitRequestToken?: number;
    isExitConfirmOpen?: boolean;
    onFinishedChange?: (isFinished: boolean) => void;
};

const formatNumber = (value: number) => Number.isFinite(value) ? value.toFixed(1) : '0.0';

const TypingPracticeBody = ({ settings, onExitToSetup, exitRequestToken = 0, isExitConfirmOpen = false, onFinishedChange }: Props) => {
    const practice = useTypingPractice(settings);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const lastExitRequestTokenRef = React.useRef(exitRequestToken);

    React.useEffect(() => {
        if (practice.targetWord && !practice.resultOpen && !practice.isFinished && !practice.isStarting) inputRef.current?.focus();
    }, [practice.isFinished, practice.isStarting, practice.resultOpen, practice.targetWord]);

    React.useEffect(() => {
        if (practice.isFinished) inputRef.current?.blur();
    }, [practice.isFinished, practice.resultOpen]);

    React.useEffect(() => {
        if (isExitConfirmOpen) inputRef.current?.blur();
    }, [isExitConfirmOpen]);

    React.useEffect(() => {
        if (exitRequestToken === lastExitRequestTokenRef.current) return;
        lastExitRequestTokenRef.current = exitRequestToken;
        practice.finish(undefined, 'exit');
    }, [exitRequestToken, practice.finish]);

    React.useEffect(() => {
        onFinishedChange?.(practice.isFinished);
    }, [onFinishedChange, practice.isFinished]);

    const remainingProgress = Math.max(practice.progressMax - practice.progressValue, 0);
    const progressLabel = settings.sessionMode === 'timed'
        ? `${remainingProgress.toFixed(1)}초`
        : `남은 단어 ${Math.ceil(remainingProgress)}개`;

    if (practice.blockedMessage) {
        return (
            <div className="h-[410px] w-[1000px] bg-white dark:bg-gray-900 p-8 text-center text-gray-800 dark:text-gray-100">
                <p>{practice.blockedMessage}</p>
                {practice.canRetry && (
                    <button
                        type="button"
                        onClick={() => void practice.restart()}
                        disabled={practice.isLoading}
                        className="mt-4 px-4 py-2 rounded bg-blue-600 text-white disabled:bg-gray-400"
                    >
                        다시 시도
                    </button>
                )}
            </div>
        );
    }

    return (
        <>
            <div data-testid="typing-practice-surface" className={isExitConfirmOpen ? 'blur-sm pointer-events-none select-none' : undefined}>
            <div className="relative">
                <div className="game-head flex items-start">
                    <div className="mt-[50px] mx-[40px] ml-[105px] w-[100px] h-[110px]" />

                    <div className="jjoriping w-[500px]">
                        <div className="p-[20px_5px_5px_5px] border-2 border-black rounded-bl-[10px] rounded-br-[10px] mt-[40px] w-[486px] h-[100px] bg-[#DEAF56] ml-8">
                            <div className="p-[8px_5px] rounded-[10px] rounded-bl-none rounded-br-none w-[474px] h-[40px] text-[20px] bg-black/70 whitespace-nowrap overflow-hidden">
                                {practice.isStarting ? (
                                    <div className="flex h-full items-center justify-center">{practice.displayWord}</div>
                                ) : practice.targetWord ? (
                                    <TypingTargetViewport
                                        target={practice.targetWord}
                                        input={practice.input}
                                        isComposing={practice.isComposing}
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center">단어를 불러오는 중...</div>
                                )}
                            </div>
                            <div data-testid="typing-practice-next-word-bar" className="relative">
                                <GraphBar
                                    className="border-l border-r border-black/70 w-[474px] h-[20px] bg-[#70712D]"
                                    min={0}
                                    val={practice.progressMax}
                                    max={practice.progressMax}
                                    bgc="#E6E846"
                                    label=""
                                />
                                {practice.nextWord && (
                                    <div className="absolute inset-0 px-2 flex items-center justify-center text-[12px] font-bold text-black text-center whitespace-nowrap overflow-hidden text-ellipsis pointer-events-none">
                                        {`다음: ${practice.nextWord}`}
                                    </div>
                                )}
                            </div>
                            <div data-testid="typing-practice-progress-bar">
                                <GraphBar
                                    className="border-l border-r border-black/70 w-[474px] h-[20px] bg-[#70712D]"
                                    min={0}
                                    val={remainingProgress}
                                    max={practice.progressMax}
                                    bgc="#223C6C"
                                    label={progressLabel}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="chain pt-[50px] mt-[50px] mx-[105px] mr-[40px] w-[100px] h-[110px] text-[24px] text-[#EEEEEE] font-bold text-center bg-[url('/img/righthand.png')] bg-no-repeat" style={{ textShadow: '0px 1px 5px #141414' }}>
                        {practice.metrics.completedWords}
                    </div>
                </div>
            </div>

            <div className="ml-[270px]">
                <GameInput
                    inputRef={inputRef}
                    placeholder="표시된 단어를 정확히 입력하세요."
                    value={practice.input}
                    onChange={practice.handleInputChange}
                    onKeyDown={practice.handleKeyDown}
                    onCompositionStart={practice.handleCompositionStart}
                    onCompositionEnd={practice.handleCompositionEnd}
                    readonly={practice.isFinished || practice.isStarting || isExitConfirmOpen}
                />
                <p
                    role="status"
                    aria-live="polite"
                    className="min-h-[20px] w-[460px] pt-1 text-center text-sm text-yellow-700 dark:text-yellow-200"
                >
                    {practice.incompleteSubmissionMessage ?? ''}
                </p>
                <div data-testid="typing-practice-live-stats" className="mt-2 w-[460px] border-2 border-black rounded-[8px] bg-[#223C6C] text-white text-xs flex justify-around py-2 shadow">
                    <span><span>WPM</span> {formatNumber(practice.metrics.wpm)}</span>
                    <span><span>분당타자수</span> {formatNumber(practice.metrics.charactersPerMinute)}</span>
                    <span>정확도 {formatNumber(practice.metrics.accuracy)}%</span>
                    <span>콤보 {practice.metrics.combo}</span>
                </div>
            </div>
            </div>

            {practice.resultOpen && (
                <TypingPracticeResultModal
                    metrics={practice.metrics}
                    attempts={practice.attempts}
                    onRestart={() => void practice.restart()}
                    onExitToSetup={onExitToSetup}
                    onClose={practice.closeResult}
                />
            )}
        </>
    );
};

export default TypingPracticeBody;

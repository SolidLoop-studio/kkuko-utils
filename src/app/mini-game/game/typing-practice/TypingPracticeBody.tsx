"use client";

import React from 'react';
import GameInput from '../components/GameInput';
import GraphBar from '../components/GraphBar';
import { useTypingPractice } from './hooks/useTypingPractice';
import TypingPracticeResultModal from './TypingPracticeResultModal';
import type { TypingPracticeSettings } from './types/typing-practice.types';

type Props = {
    settings: TypingPracticeSettings;
    onExitToSetup: () => void;
};

const formatNumber = (value: number) => Number.isFinite(value) ? value.toFixed(1) : '0.0';

const renderTarget = (target: string, input: string) => {
    const characters = target.split('').map((char, index) => {
        const typed = input[index];
        const className = typed === undefined
            ? 'text-[#EEEEEE]'
            : typed === char
                ? 'text-green-300'
                : 'text-red-300 underline';

        return <span key={`${char}-${index}`} className={className}>{char}</span>;
    });

    return <><span className="sr-only">{target}</span>{characters}</>;
};

const TypingPracticeBody = ({ settings, onExitToSetup }: Props) => {
    const practice = useTypingPractice(settings);

    if (practice.blockedMessage) {
        return (
            <div className="h-[410px] w-[1000px] bg-white dark:bg-gray-900 p-8 text-center text-gray-800 dark:text-gray-100">
                {practice.blockedMessage}
            </div>
        );
    }

    return (
        <>
            <div className="relative">
                <div className="game-head flex items-start">
                    <div className="items pt-[50px] mt-[50px] mx-[40px] ml-[105px] w-[100px] h-[110px] text-[24px] text-[#EEEEEE] font-bold text-center bg-[url('/img/lefthand.png')] bg-no-repeat" style={{ textShadow: '0px 1px 5px #141414' }}>
                        {practice.metrics.combo}
                    </div>

                    <div className="jjoriping w-[500px]">
                        <div className="p-[20px_5px_5px_5px] border-2 border-black rounded-bl-[10px] rounded-br-[10px] mt-[40px] w-[486px] h-[120px] bg-[#DEAF56] ml-8">
                            <div className="p-[8px_5px] rounded-[10px] rounded-bl-none rounded-br-none w-[474px] h-[40px] text-[20px] text-center bg-black/70 whitespace-nowrap overflow-hidden text-ellipsis">
                                {practice.targetWord ? renderTarget(practice.targetWord, practice.input) : '단어를 불러오는 중...'}
                            </div>
                            <GraphBar
                                className="border-l border-r border-black/70 w-[474px] h-[20px] bg-[#70712D]"
                                min={0}
                                val={practice.progressValue}
                                max={practice.progressMax}
                                bgc="#E6E846"
                                label={`${Math.floor(practice.progressValue)} / ${practice.progressMax}`}
                            />
                            <div className="border-l border-r border-b border-black/70 rounded-bl-[10px] rounded-br-[10px] w-[474px] h-[20px] bg-[#223C6C] text-white text-xs flex justify-around">
                                <span><span>WPM</span> {formatNumber(practice.metrics.wpm)}</span>
                                <span><span>분당타자수</span> {formatNumber(practice.metrics.charactersPerMinute)}</span>
                                <span>정확도 {formatNumber(practice.metrics.accuracy)}%</span>
                            </div>
                        </div>
                    </div>

                    <div className="chain pt-[50px] mt-[50px] mx-[105px] mr-[40px] w-[100px] h-[110px] text-[24px] text-[#EEEEEE] font-bold text-center bg-[url('/img/righthand.png')] bg-no-repeat" style={{ textShadow: '0px 1px 5px #141414' }}>
                        {Math.round(practice.metrics.accuracy)}%
                    </div>
                </div>
            </div>

            <div className="ml-[270px]">
                <GameInput
                    placeholder="표시된 단어를 정확히 입력하세요."
                    value={practice.input}
                    onChange={practice.handleInputChange}
                    onKeyDown={practice.handleKeyDown}
                    onCompositionStart={practice.handleCompositionStart}
                    onCompositionEnd={practice.handleCompositionEnd}
                />
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

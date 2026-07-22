"use client";

import React, { useEffect, useId, useRef } from 'react';
import type { TypingPracticeAttempt, TypingPracticeMetrics } from './types/typing-practice.types';

type Props = {
    metrics: TypingPracticeMetrics;
    attempts: TypingPracticeAttempt[];
    onRestart: () => void;
    onExitToSetup: () => void;
    onClose: () => void;
};

const formatNumber = (value: number) => Number.isFinite(value) ? value.toFixed(1) : '0.0';

const TypingPracticeResultModal = ({ metrics, attempts, onRestart, onExitToSetup, onClose }: Props) => {
    const recentAttempts = attempts.slice(-5).reverse();
    const titleId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onCloseRef.current();
                return;
            }

            if (event.key !== 'Tab') return;
            const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
            const firstButton = buttons[0];
            const lastButton = buttons[buttons.length - 1];

            if (event.shiftKey && document.activeElement === firstButton) {
                event.preventDefault();
                lastButton?.focus();
            } else if (!event.shiftKey && document.activeElement === lastButton) {
                event.preventDefault();
                firstButton?.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        closeButtonRef.current?.focus();

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            previouslyFocused?.focus();
        };
    }, []);

    return (
        <div className="fixed inset-0 backdrop-blur-md bg-white/30 dark:bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-[560px] p-6"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 id={titleId} className="text-lg font-semibold text-gray-800 dark:text-gray-100">타자 연습 결과</h3>
                    <button ref={closeButtonRef} type="button" aria-label="결과 닫기" onClick={onClose} className="text-gray-500 dark:text-gray-300">&times;</button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                    <div><div className="text-xs text-gray-500">WPM</div><div className="font-bold">{formatNumber(metrics.wpm)}</div></div>
                    <div><div className="text-xs text-gray-500">분당타자수</div><div className="font-bold">{formatNumber(metrics.charactersPerMinute)}</div></div>
                    <div><div className="text-xs text-gray-500">정확도</div><div className="font-bold">{formatNumber(metrics.accuracy)}%</div></div>
                    <div><div className="text-xs text-gray-500">완료 단어</div><div className="font-bold">{metrics.completedWords}</div></div>
                    <div><div className="text-xs text-gray-500">실패 단어</div><div className="font-bold">{metrics.failedWords}</div></div>
                    <div><div className="text-xs text-gray-500">최대 콤보</div><div className="font-bold">{metrics.maxCombo}</div></div>
                    <div className="col-span-3"><div className="text-xs text-gray-500">연습 시간</div><div className="font-bold">{formatNumber(metrics.elapsedMs / 1000)}초</div></div>
                </div>

                <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">최근 입력</h4>
                    <div className="space-y-1">
                        {recentAttempts.map((attempt) => (
                            <div key={`${attempt.target}-${attempt.completedAt}`} className="flex justify-between text-sm">
                                <span className="text-gray-700 dark:text-gray-200">{attempt.target}</span>
                                <span className={attempt.isCorrect ? 'text-green-600' : 'text-red-600'}>{attempt.submitted}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={onRestart} className="flex-1 bg-blue-600 text-white py-2 rounded">다시 시작</button>
                    <button onClick={onExitToSetup} className="flex-1 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-100 py-2 rounded">설정으로 돌아가기</button>
                    <button onClick={onClose} className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 py-2 rounded">닫기</button>
                </div>
            </div>
        </div>
    );
};

export default TypingPracticeResultModal;

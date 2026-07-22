"use client";

import React, { useEffect, useId, useRef } from 'react';
import type { TypingPracticeAttempt, TypingPracticeMetrics } from './types/typing-practice.types';
import { TypingPracticeLogic } from './lib/TypingPracticeLogic';

type Props = {
    metrics: TypingPracticeMetrics;
    attempts: TypingPracticeAttempt[];
    onRestart: () => void;
    onExitToSetup: () => void;
    onClose: () => void;
};

const formatNumber = (value: number) => Number.isFinite(value) ? value.toFixed(1) : '0.0';

const Chart = ({ attempts, elapsedMs }: { attempts: TypingPracticeAttempt[]; elapsedMs: number }) => {
    const points = TypingPracticeLogic.buildCpmTimeline(attempts, elapsedMs);
    const drawablePoints = points.filter((point) => point.elapsedSeconds > 0);

    if (drawablePoints.length < 2) {
        return (
            <div className="h-[170px] border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                기록이 부족합니다
            </div>
        );
    }

    const width = 500;
    const height = 170;
    const paddingLeft = 44;
    const paddingRight = 16;
    const paddingTop = 16;
    const paddingBottom = 34;
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    const maxSeconds = Math.max(...points.map((point) => point.elapsedSeconds), 1);
    const maxCpm = Math.max(...points.map((point) => point.charactersPerMinute), 1);
    const toX = (seconds: number) => paddingLeft + (seconds / maxSeconds) * chartWidth;
    const toY = (cpm: number) => paddingTop + chartHeight - (cpm / maxCpm) * chartHeight;
    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${toX(point.elapsedSeconds).toFixed(2)} ${toY(point.charactersPerMinute).toFixed(2)}`).join(' ');
    const lastPoint = points[points.length - 1];

    return (
        <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2">
            <svg
                data-testid="typing-cpm-chart"
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label="시간에 따른 분당타자수 꺾은선 그래프"
                className="w-full h-[170px]"
            >
                <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + chartHeight} stroke="#94A3B8" strokeWidth="1" />
                <line x1={paddingLeft} y1={paddingTop + chartHeight} x2={paddingLeft + chartWidth} y2={paddingTop + chartHeight} stroke="#94A3B8" strokeWidth="1" />
                <line x1={paddingLeft} y1={toY(maxCpm / 2)} x2={paddingLeft + chartWidth} y2={toY(maxCpm / 2)} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />
                <line x1={paddingLeft} y1={toY(maxCpm)} x2={paddingLeft + chartWidth} y2={toY(maxCpm)} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />
                <path d={path} fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {points.map((point, index) => (
                    <circle key={`${point.elapsedSeconds}-${index}`} cx={toX(point.elapsedSeconds)} cy={toY(point.charactersPerMinute)} r="3.2" fill="#2563EB" />
                ))}
                <text x={paddingLeft - 8} y={toY(maxCpm)} textAnchor="end" className="fill-gray-500 text-[10px]">{Math.ceil(maxCpm)}</text>
                <text x={paddingLeft - 8} y={toY(maxCpm / 2)} textAnchor="end" className="fill-gray-500 text-[10px]">{Math.ceil(maxCpm / 2)}</text>
                <text x={paddingLeft - 8} y={paddingTop + chartHeight + 4} textAnchor="end" className="fill-gray-500 text-[10px]">0</text>
                <text x={paddingLeft} y={height - 8} textAnchor="middle" className="fill-gray-500 text-[10px]">0초</text>
                <text x={paddingLeft + chartWidth} y={height - 8} textAnchor="middle" className="fill-gray-500 text-[10px]">{Math.ceil(maxSeconds)}초</text>
                <text x={width / 2} y={height - 8} textAnchor="middle" className="fill-gray-700 dark:fill-gray-200 text-[11px]">시간(초)</text>
                <text x="12" y={height / 2} textAnchor="middle" transform={`rotate(-90 12 ${height / 2})`} className="fill-gray-700 dark:fill-gray-200 text-[11px]">분당타자수</text>
                <text x={paddingLeft + chartWidth - 4} y={paddingTop + 12} textAnchor="end" className="fill-blue-700 dark:fill-blue-300 text-[11px]">
                    최종 {formatNumber(lastPoint.charactersPerMinute)}
                </text>
            </svg>
        </div>
    );
};

const TypingPracticeResultModal = ({ metrics, attempts, onRestart, onExitToSetup, onClose }: Props) => {
    const titleId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
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
        dialogRef.current?.focus();

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
                tabIndex={-1}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-[560px] p-6"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 id={titleId} className="text-lg font-semibold text-gray-800 dark:text-gray-100">타자 연습 결과</h3>
                    <button type="button" aria-label="결과 닫기" onClick={onClose} className="text-gray-500 dark:text-gray-300">&times;</button>
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
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">분당타자수 추이</h4>
                    <Chart attempts={attempts} elapsedMs={metrics.elapsedMs} />
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

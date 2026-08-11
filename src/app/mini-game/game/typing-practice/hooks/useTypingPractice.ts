"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAllWords } from '../../lib/wordDB';
import { soundManager } from '../../lib/SoundManager';
import { TypingPracticeLogic } from '../lib/TypingPracticeLogic';
import type {
    TypingPracticeAttempt,
    TypingPracticeSettings,
} from '../types/typing-practice.types';

export const useTypingPractice = (settings: TypingPracticeSettings) => {
    const [queue, setQueue] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [input, setInput] = useState('');
    const [attempts, setAttempts] = useState<TypingPracticeAttempt[]>([]);
    const [mistakeCount, setMistakeCount] = useState(0);
    const [combo, setCombo] = useState(0);
    const [maxCombo, setMaxCombo] = useState(0);
    const [now, setNow] = useState(() => Date.now());
    const [startedAt, setStartedAt] = useState(() => Date.now());
    const [isComposing, setIsComposing] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [resultOpen, setResultOpen] = useState(false);
    const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
    const [canRetry, setCanRetry] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isStarting, setIsStarting] = useState(false);
    const [isStartWordVisible, setIsStartWordVisible] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef(true);
    const loadRequestIdRef = useRef(0);

    const clearStartTimeout = useCallback(() => {
        if (startTimeoutRef.current) {
            clearTimeout(startTimeoutRef.current);
            startTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            loadRequestIdRef.current += 1;
            clearStartTimeout();
            try { soundManager.stop('jaqwiBGM'); } catch (e) { console.error(e); }
        };
    }, [clearStartTimeout]);

    const loadQueue = useCallback(async () => {
        if (!isMountedRef.current) return;

        const requestId = loadRequestIdRef.current + 1;
        loadRequestIdRef.current = requestId;
        clearStartTimeout();
        setIsLoading(true);
        setIsStarting(false);
        setIsStartWordVisible(false);
        setCanRetry(false);

        try {
            const words = await getAllWords();
            if (!isMountedRef.current || requestId !== loadRequestIdRef.current) return;

            const nextQueue = TypingPracticeLogic.prepareQueue(words, settings);
            const startedAtMs = Date.now();

            setCurrentIndex(0);
            setInput('');
            setAttempts([]);
            setMistakeCount(0);
            setCombo(0);
            setMaxCombo(0);
            setStartedAt(startedAtMs);
            setNow(startedAtMs);
            setIsComposing(false);
            setIsFinished(false);
            setResultOpen(false);
            setIsStartWordVisible(false);

            if (nextQueue.length === 0) {
                setBlockedMessage('조건에 맞는 100자 이하 단어가 없습니다. 언어나 최소 글자 수를 조정해주세요.');
                setQueue([]);
                setIsStarting(false);
                try { soundManager.stop('jaqwiBGM'); } catch (e) { console.error(e); }
                return;
            }

            setBlockedMessage(null);
            setQueue(nextQueue);
            setIsStarting(true);
            setIsStartWordVisible(false);

            const beginSession = () => {
                if (!isMountedRef.current || requestId !== loadRequestIdRef.current) return;
                clearStartTimeout();
                const nextStartedAtMs = Date.now();
                setStartedAt(nextStartedAtMs);
                setNow(nextStartedAtMs);
                setIsStarting(false);
                setIsStartWordVisible(false);
                try { soundManager.play('jaqwiBGM'); } catch (e) { console.error(e); }
            };

            const beginRoundStart = () => {
                if (!isMountedRef.current || requestId !== loadRequestIdRef.current) return;
                clearStartTimeout();
                setIsStartWordVisible(true);
                startTimeoutRef.current = setTimeout(beginSession, 3000);
                try {
                    soundManager.playWithEnd('round_start', beginSession);
                } catch (e) {
                    console.error(e);
                }
            };

            startTimeoutRef.current = setTimeout(beginRoundStart, 3000);

            try {
                soundManager.playWithEnd('game_start', beginRoundStart);
            } catch (e) {
                console.error(e);
            }
        } catch (error) {
            if (!isMountedRef.current || requestId !== loadRequestIdRef.current) return;

            console.error(error);
            setQueue([]);
            setCurrentIndex(0);
            setInput('');
            setAttempts([]);
            setMistakeCount(0);
            setCombo(0);
            setMaxCombo(0);
            setIsComposing(false);
            setIsFinished(false);
            setResultOpen(false);
            setIsStarting(false);
            setIsStartWordVisible(false);
            setBlockedMessage('단어를 불러오지 못했습니다. 다시 시도해주세요.');
            setCanRetry(true);
            try { soundManager.stop('jaqwiBGM'); } catch (e) { console.error(e); }
        } finally {
            if (isMountedRef.current && requestId === loadRequestIdRef.current) {
                setIsLoading(false);
            }
        }
    }, [clearStartTimeout, settings]);

    useEffect(() => {
        void loadQueue();
        return () => {
            loadRequestIdRef.current += 1;
        };
    }, [loadQueue]);

    useEffect(() => {
        if (isLoading || isStarting || isFinished || blockedMessage) return;
        timerRef.current = setInterval(() => setNow(Date.now()), 250);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [blockedMessage, isFinished, isLoading, isStarting, startedAt]);

    const elapsedMs = isStarting ? 0 : Math.max(now - startedAt, 0);
    const targetWord = queue[currentIndex] ?? '';
    const metrics = useMemo(
        () => TypingPracticeLogic.calculateMetrics(attempts, elapsedMs, combo, maxCombo, mistakeCount),
        [attempts, combo, elapsedMs, maxCombo, mistakeCount],
    );

    const finish = useCallback((endedAt = Date.now(), reason: 'complete' | 'timeout' | 'exit' = 'complete') => {
        loadRequestIdRef.current += 1;
        clearStartTimeout();
        setNow(endedAt);
        setIsLoading(false);
        setIsStarting(false);
        setIsStartWordVisible(false);
        setIsFinished(true);
        setResultOpen(true);
        if (timerRef.current) clearInterval(timerRef.current);
        try { soundManager.stop('jaqwiBGM'); } catch (e) { console.error(e); }
        if (reason === 'timeout') {
            try { soundManager.play('timeout'); } catch (e) { console.error(e); }
        }
    }, [clearStartTimeout]);

    useEffect(() => {
        if (settings.sessionMode === 'timed' && elapsedMs >= settings.durationSeconds * 1000) {
            finish(startedAt + settings.durationSeconds * 1000, 'timeout');
        }
    }, [elapsedMs, finish, settings.durationSeconds, settings.sessionMode, startedAt]);

    const submit = useCallback(() => {
        if (!targetWord || input.trim() === '' || isStarting || isFinished || isComposing) return;
        const submittedAt = Date.now();

        if (settings.sessionMode === 'timed' && submittedAt - startedAt >= settings.durationSeconds * 1000) {
            finish(startedAt + settings.durationSeconds * 1000, 'timeout');
            return;
        }

        const attempt = TypingPracticeLogic.scoreAttempt(targetWord, input, submittedAt - startedAt);
        const nextCombo = TypingPracticeLogic.nextCombo(attempt, combo, maxCombo);
        const nextAttempts = [...attempts, attempt];
        const nextIndex = currentIndex + 1;
        const isFixedCountComplete = settings.sessionMode === 'fixed-count'
            && nextAttempts.length >= Math.min(settings.wordCount, queue.length);
        const isFixedQueueComplete = settings.sessionMode === 'fixed-count' && nextIndex >= queue.length;
        const isCompletingFixedSession = isFixedCountComplete || isFixedQueueComplete;

        setAttempts(nextAttempts);
        setCombo(nextCombo.combo);
        setMaxCombo(nextCombo.maxCombo);
        setInput('');
        if (attempt.isCorrect || !isCompletingFixedSession) {
            try { soundManager.play(attempt.isCorrect ? 'K0' : 'fail'); } catch (e) { console.error(e); }
        }

        if (isCompletingFixedSession) {
            setCurrentIndex(Math.min(nextIndex, queue.length - 1));
            finish(undefined, 'complete');
            return;
        }

        setCurrentIndex(settings.sessionMode === 'timed' ? nextIndex % queue.length : nextIndex);
    }, [attempts, combo, currentIndex, finish, input, isComposing, isFinished, isStarting, maxCombo, queue.length, settings.durationSeconds, settings.sessionMode, settings.wordCount, startedAt, targetWord]);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (isStarting || isFinished) return;
        const nextInput = event.target.value;
        setInput(nextInput);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            submit();
        }
    };

    const progressMax = settings.sessionMode === 'timed' ? settings.durationSeconds : Math.min(settings.wordCount, queue.length || settings.wordCount);
    const progressValue = settings.sessionMode === 'timed' ? Math.min(elapsedMs / 1000, settings.durationSeconds) : attempts.length;
    const nextWord = isStarting
        ? ''
        : queue[settings.sessionMode === 'timed' ? (currentIndex + 1) % Math.max(queue.length, 1) : currentIndex + 1] ?? '';

    return {
        targetWord,
        nextWord,
        input,
        attempts,
        metrics,
        progressValue,
        progressMax,
        isComposing,
        isStarting,
        isFinished,
        resultOpen,
        displayWord: isStarting && !isStartWordVisible ? '게임이 곧 시작됩니다' : targetWord,
        blockedMessage,
        canRetry,
        isLoading,
        handleInputChange,
        handleKeyDown,
        handleCompositionStart: () => setIsComposing(true),
        handleCompositionEnd: () => setIsComposing(false),
        restart: loadQueue,
        finish,
        closeResult: () => setResultOpen(false),
    };
};

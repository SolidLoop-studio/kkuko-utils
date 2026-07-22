"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAllWords } from '../../lib/wordDB';
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
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef(true);
    const loadRequestIdRef = useRef(0);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            loadRequestIdRef.current += 1;
        };
    }, []);

    const loadQueue = useCallback(async () => {
        if (!isMountedRef.current) return;

        const requestId = loadRequestIdRef.current + 1;
        loadRequestIdRef.current = requestId;
        setIsLoading(true);
        setCanRetry(false);

        try {
            const words = await getAllWords();
            if (!isMountedRef.current || requestId !== loadRequestIdRef.current) return;

            const nextQueue = TypingPracticeLogic.prepareQueue(words, settings);
            const startedAtMs = Date.now();

            setCurrentIndex(0);
            setInput('');
            setAttempts([]);
            setCombo(0);
            setMaxCombo(0);
            setStartedAt(startedAtMs);
            setNow(startedAtMs);
            setIsComposing(false);
            setIsFinished(false);
            setResultOpen(false);

            if (nextQueue.length === 0) {
                setBlockedMessage('조건에 맞는 단어가 없습니다. 언어나 최소 글자 수를 조정해주세요.');
                setQueue([]);
                return;
            }

            setBlockedMessage(null);
            setQueue(nextQueue);
        } catch (error) {
            if (!isMountedRef.current || requestId !== loadRequestIdRef.current) return;

            console.error(error);
            setQueue([]);
            setCurrentIndex(0);
            setInput('');
            setAttempts([]);
            setCombo(0);
            setMaxCombo(0);
            setIsComposing(false);
            setIsFinished(false);
            setResultOpen(false);
            setBlockedMessage('단어를 불러오지 못했습니다. 다시 시도해주세요.');
            setCanRetry(true);
        } finally {
            if (isMountedRef.current && requestId === loadRequestIdRef.current) {
                setIsLoading(false);
            }
        }
    }, [settings]);

    useEffect(() => {
        void loadQueue();
        return () => {
            loadRequestIdRef.current += 1;
        };
    }, [loadQueue]);

    useEffect(() => {
        if (isLoading || isFinished || blockedMessage) return;
        timerRef.current = setInterval(() => setNow(Date.now()), 250);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [blockedMessage, isFinished, isLoading, startedAt]);

    const elapsedMs = Math.max(now - startedAt, 0);
    const targetWord = queue[currentIndex] ?? '';
    const metrics = useMemo(
        () => TypingPracticeLogic.calculateMetrics(attempts, elapsedMs, combo, maxCombo),
        [attempts, elapsedMs, combo, maxCombo],
    );

    const finish = useCallback((endedAt = Date.now()) => {
        setNow(endedAt);
        setIsFinished(true);
        setResultOpen(true);
        if (timerRef.current) clearInterval(timerRef.current);
    }, []);

    useEffect(() => {
        if (settings.sessionMode === 'timed' && elapsedMs >= settings.durationSeconds * 1000) {
            finish(startedAt + settings.durationSeconds * 1000);
        }
    }, [elapsedMs, finish, settings.durationSeconds, settings.sessionMode, startedAt]);

    const submit = useCallback(() => {
        if (!targetWord || input.trim() === '' || isFinished || isComposing) return;
        const submittedAt = Date.now();

        if (settings.sessionMode === 'timed' && submittedAt - startedAt >= settings.durationSeconds * 1000) {
            finish(startedAt + settings.durationSeconds * 1000);
            return;
        }

        const attempt = TypingPracticeLogic.scoreAttempt(targetWord, input);
        const nextCombo = TypingPracticeLogic.nextCombo(attempt, combo, maxCombo);
        const nextAttempts = [...attempts, attempt];
        const nextIndex = currentIndex + 1;

        setAttempts(nextAttempts);
        setCombo(nextCombo.combo);
        setMaxCombo(nextCombo.maxCombo);
        setInput('');

        const isFixedCountComplete = settings.sessionMode === 'fixed-count'
            && nextAttempts.length >= Math.min(settings.wordCount, queue.length);
        const isFixedQueueComplete = settings.sessionMode === 'fixed-count' && nextIndex >= queue.length;

        if (isFixedCountComplete || isFixedQueueComplete) {
            setCurrentIndex(Math.min(nextIndex, queue.length - 1));
            finish();
            return;
        }

        setCurrentIndex(settings.sessionMode === 'timed' ? nextIndex % queue.length : nextIndex);
    }, [attempts, combo, currentIndex, finish, input, isComposing, isFinished, maxCombo, queue.length, settings.durationSeconds, settings.sessionMode, settings.wordCount, startedAt, targetWord]);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInput(event.target.value);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            submit();
        }
    };

    const progressMax = settings.sessionMode === 'timed' ? settings.durationSeconds : Math.min(settings.wordCount, queue.length || settings.wordCount);
    const progressValue = settings.sessionMode === 'timed' ? Math.min(elapsedMs / 1000, settings.durationSeconds) : attempts.length;

    return {
        targetWord,
        input,
        attempts,
        metrics,
        progressValue,
        progressMax,
        isComposing,
        isFinished,
        resultOpen,
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

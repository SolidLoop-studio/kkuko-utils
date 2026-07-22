"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAllWords } from '../../lib/wordDB';
import { TypingPracticeLogic } from '../lib/TypingPracticeLogic';
import type {
    TypingPracticeAttempt,
    TypingPracticeMetrics,
    TypingPracticeSettings,
} from '../types/typing-practice.types';

const EMPTY_METRICS: TypingPracticeMetrics = {
    correctCharacters: 0,
    totalSubmittedCharacters: 0,
    accuracy: 0,
    wpm: 0,
    charactersPerMinute: 0,
    completedWords: 0,
    failedWords: 0,
    totalAttempts: 0,
    averageWordTime: 0,
    combo: 0,
    maxCombo: 0,
    elapsedMs: 1000,
};

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
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const loadQueue = useCallback(async () => {
        const words = await getAllWords();
        const nextQueue = TypingPracticeLogic.prepareQueue(words, settings);
        if (nextQueue.length === 0) {
            setBlockedMessage('조건에 맞는 단어가 없습니다. 언어나 최소 글자 수를 조정해주세요.');
            setQueue([]);
            return;
        }

        setBlockedMessage(null);
        setQueue(nextQueue);
        setCurrentIndex(0);
        setInput('');
        setAttempts([]);
        setCombo(0);
        setMaxCombo(0);
        setStartedAt(Date.now());
        setNow(Date.now());
        setIsFinished(false);
        setResultOpen(false);
    }, [settings]);

    useEffect(() => {
        void loadQueue();
    }, [loadQueue]);

    useEffect(() => {
        if (isFinished || blockedMessage) return;
        timerRef.current = setInterval(() => setNow(Date.now()), 250);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isFinished, blockedMessage]);

    const elapsedMs = Math.max(now - startedAt, 1000);
    const targetWord = queue[currentIndex] ?? '';
    const metrics = useMemo(
        () => TypingPracticeLogic.calculateMetrics(attempts, elapsedMs, combo, maxCombo),
        [attempts, elapsedMs, combo, maxCombo],
    );

    const finish = useCallback(() => {
        setIsFinished(true);
        setResultOpen(true);
        if (timerRef.current) clearInterval(timerRef.current);
    }, []);

    useEffect(() => {
        if (settings.sessionMode === 'timed' && elapsedMs >= settings.durationSeconds * 1000) {
            finish();
        }
    }, [elapsedMs, finish, settings.durationSeconds, settings.sessionMode]);

    const submit = useCallback(() => {
        if (!targetWord || input.trim() === '' || isFinished || isComposing) return;

        const attempt = TypingPracticeLogic.scoreAttempt(targetWord, input);
        const nextCombo = TypingPracticeLogic.nextCombo(attempt, combo, maxCombo);
        const nextAttempts = [...attempts, attempt];
        const nextIndex = currentIndex + 1;

        setAttempts(nextAttempts);
        setCombo(nextCombo.combo);
        setMaxCombo(nextCombo.maxCombo);
        setInput('');

        const countComplete = settings.sessionMode === 'fixed-count' && nextAttempts.length >= Math.min(settings.wordCount, queue.length);
        const queueComplete = nextIndex >= queue.length;

        if (countComplete || queueComplete) {
            setCurrentIndex(Math.min(nextIndex, queue.length - 1));
            finish();
            return;
        }

        setCurrentIndex(nextIndex);
    }, [attempts, combo, currentIndex, finish, input, isComposing, isFinished, maxCombo, queue.length, settings.sessionMode, settings.wordCount, targetWord]);

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
        handleInputChange,
        handleKeyDown,
        handleCompositionStart: () => setIsComposing(true),
        handleCompositionEnd: () => setIsComposing(false),
        restart: loadQueue,
        finish,
        closeResult: () => setResultOpen(false),
    };
};

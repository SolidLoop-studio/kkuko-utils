import { useState, useEffect, useRef } from 'react';
import { useChat } from './useChat';
import { soundManager } from '../lib/SoundManager';
import { BEAT } from '../const';
import gameManager from '../lib/GameManager';
import { useGameState } from './useGameState';

// defaults; will be updated from gameManager settings on init
let TURN_TIME_LIMIT = 5; // seconds
let ROUND_TIME_LIMIT = 120; // seconds

/**
 * 게임의 핵심 로직을 관리하는 커스텀 훅
 */
export const useGameLogic = () => {
    const { setChatInput, clearMessagesAndShowStartNotice } = useChat();
    const { pendingStart, clearPendingStart, blockStart } = useGameState();
    const [word, setWord] = useState("/시작을 입력하면 게임시작!");
    const [isFail, setIsFail] = useState(false);
    const [isGameStarted, setIsGameStarted] = useState(false);
    const [currentChar, setCurrentChar] = useState("");
    const [chainCount, setChainCount] = useState(0);
    const [turnTime, setTurnTime] = useState(TURN_TIME_LIMIT);
    const [roundTime, setRoundTime] = useState(ROUND_TIME_LIMIT);
    const [isPaused, setIsPaused] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [missionChar, setMissionChar] = useState("");
    const [historyItems, setHistoryItems] = useState<{ theme: string[]; word: string }[]>([]);
    const [inputVisible, setInputVisible] = useState(true);
    const [turnInstant, setTurnInstant] = useState(false);
    const [animatingWord, setAnimatingWord] = useState<string | null>(null);
    const [visibleChars, setVisibleChars] = useState<boolean[]>([]);
    const [pulseOn, setPulseOn] = useState(false);
    const [lastState, setLastState] = useState<{ turnTime: number; roundTime: number; speed: number } | null>(null);
    const [hintVisible, setHintVisible] = useState(false);
    const [gameResult, setGameResult] = useState<{ char: string, word: string, missionChar: string | null, useHintCount: number }[] | null>(null);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const failTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const beatTimeoutRefs = useRef<NodeJS.Timeout[]>([]);
    const hadFocusRef = useRef<boolean>(false);
    const prevInputVisibleRef = useRef<boolean>(inputVisible);

    const safeFocusHead = () => {
        if (typeof document === 'undefined') return;
        const chatEl = document.getElementById('TalkX');
        const active = document.activeElement as HTMLElement | null;
        const chatHasFocus = chatEl && active === chatEl;
        if (hadFocusRef.current || !chatHasFocus) {
            inputRef.current?.focus();
            hadFocusRef.current = false;
        }
    };

    const playBGMForSpeed = (speed?: number) => {
        try {
            if (typeof speed === 'number' && speed === 0) {
                soundManager.play('jaqwiBGM');
            } else {
                soundManager.play(`T${speed}`);
            }
        } catch (e) { console.error(e); }
    };

    const stopBGMForSpeed = (speed?: number) => {
        try {
            if (typeof speed === 'number' && speed === 0) {
                soundManager.stop('jaqwiBGM');
            } else {
                soundManager.stop(`T${speed}`);
            }
        } catch (e) { console.error(e); }
    };

    /**
     * 게임 종료 처리
     */
    const endGame = () => {
        try { soundManager.stopAllSounds(); } catch (e) { console.error(e); }
        try { soundManager.play('timeout'); } catch (e) { console.error(e); }

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (failTimeoutRef.current) {
            clearTimeout(failTimeoutRef.current);
            failTimeoutRef.current = null;
        }
        if (startTimeoutRef.current) {
            clearTimeout(startTimeoutRef.current);
            startTimeoutRef.current = null;
        }

        beatTimeoutRefs.current.forEach(timeout => clearTimeout(timeout));
        beatTimeoutRefs.current = [];

        setIsGameStarted(false);
        setIsStarting(false);
        setIsPaused(true);
        setIsFail(false);
        // clear chat input when game ends
        try { setChatInput(''); } catch (e) { console.error(e); }
        const hintWord = gameManager.gameEndHint();
        console.log('Game ended, hint word:', hintWord);
        setWord(hintWord);
        setHintVisible(!!hintWord);
        setInputVisible(false);
        setAnimatingWord(null);

        // 게임 결과 가져오기
        const result = gameManager.gameEnd();
        setGameResult(result.usedWords);
    };

    // 타이머 로직
    useEffect(() => {
        if (isGameStarted && !isPaused) {
            timerRef.current = setInterval(() => {
                setTurnTime((prev) => {
                    if (prev === Infinity) return prev;
                    const newVal = Math.max(0, +(prev - 0.05).toFixed(2));
                    if (newVal <= 0) {
                        endGame();
                        return 0;
                    }
                    return newVal;
                });
                setRoundTime((prev) => {
                    if (prev === Infinity) return prev;
                    const newVal = Math.max(0, +(prev - 0.05).toFixed(2));
                    if (newVal <= 0) {
                        endGame();
                        return 0;
                    }
                    return newVal;
                });
            }, 50);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isGameStarted, isPaused, chainCount]);

    // 입력창 포커스 관리
    useEffect(() => {
        const prev = prevInputVisibleRef.current;
        // became visible
        if (!prev && inputVisible) {
            // if chat currently has focus and head did not have focus before hide,
            // do not steal focus. If head had focus before hide, restore it.
            if (typeof document === 'undefined') return;
            const chatEl = document.getElementById('TalkX');
            const active = document.activeElement as HTMLElement | null;
            const chatHasFocus = chatEl && active === chatEl;
            if (hadFocusRef.current || !chatHasFocus) {
                const rafId = requestAnimationFrame(() => {
                    inputRef.current?.focus();
                    hadFocusRef.current = false;
                });
                prevInputVisibleRef.current = inputVisible;
                return () => cancelAnimationFrame(rafId);
            }
            prevInputVisibleRef.current = inputVisible;
            return;
        }

        // became hidden
        if (prev && !inputVisible) {
            if (typeof document !== 'undefined') {
                hadFocusRef.current = document.activeElement === inputRef.current;
            }
        }

        prevInputVisibleRef.current = inputVisible;
    }, [inputVisible]);

    /**
     * 새로운 턴 시작
     */
    const startNewCycle = () => {
        const currentState = gameManager.getCurrentState();
        if (currentState) {
            setCurrentChar(currentState.startChar);
            setWord(currentState.startChar);
            setMissionChar(currentState.missionChar || "");
        }
        setIsFail(false);
        setTurnInstant(true);
        setTurnTime(TURN_TIME_LIMIT);
        requestAnimationFrame(() => {
            setTurnInstant(false);
        });
        safeFocusHead();
    };

    /**
     * 사용자 입력 처리
     */
    const handleInput = (input: string) => {
        if (input === '/시작') {
            // prevent starting a new game while one is already active or already starting
            if (isGameStarted || isStarting) {
                try { setChatInput(''); } catch (e) { console.error(e); }
                return;
            }
            // if game cannot start (no valid start chars etc.), show modal and abort
            try {
                if (!gameManager.canGameStart()) {
                    try { setChatInput(''); } catch (e) { console.error(e); }
                    // set zustand store flag so UI can display modal
                    try { blockStart('게임을 시작할 수 없습니다.'); } catch (e) { console.error(e); }
                    return;
                }
            } catch (e) { console.error(e); }
            // mark that a start sequence is in progress so aliases cannot re-trigger it
            setIsStarting(true);
            // 게임 결과 다이얼로그 닫기
            setGameResult(null);
            // Initialize history and timings from gameManager
            setHistoryItems([]);
            setMissionChar("");
            const setting = gameManager.getSetting();
            // roundTime in gameManager is ms; 0 means unlimited
            if (setting.roundTime === 0) {
                ROUND_TIME_LIMIT = Infinity;
            } else {
                ROUND_TIME_LIMIT = Math.max(1, Math.round(setting.roundTime / 1000));
            }
            TURN_TIME_LIMIT = 5; // keep existing default for turn limit
            setRoundTime(ROUND_TIME_LIMIT);
            setTurnTime(TURN_TIME_LIMIT);
            // clear chat history and show start notice
            try { clearMessagesAndShowStartNotice(); } catch (e) { console.error(e); }
            setChatInput('');
            setIsPaused(true);
            setInputVisible(false);
            setHintVisible(false);
            setChainCount(0);
            setWord('게임이 곧 시작됩니다');

            try {
                let temps: number | undefined;
                // start the audio-start sequence; if the sound callbacks never fire
                // (or fail), a fallback timeout below will ensure the game actually starts.
                soundManager.playWithEnd('game_start', () => {
                    if (startTimeoutRef.current) { clearTimeout(startTimeoutRef.current); startTimeoutRef.current = null; }
                    // call gameManager.gameStart to select start char (and mission)
                    try {
                        const startState = gameManager.gameStart();
                        if (startState) {
                            setCurrentChar(startState.startChar);
                            setWord(startState.startChar);
                            if (startState.missionChar) setMissionChar(startState.missionChar);
                            else setMissionChar("");
                            TURN_TIME_LIMIT = startState.turnTime / 1000;
                            setLastState({
                                turnTime: startState.turnTime,
                                roundTime: ROUND_TIME_LIMIT,
                                speed: startState.turnSpeed
                            });
                            temps = startState.turnSpeed;
                        }
                    } catch (e) { console.error(e); }

                    let cycleStarted = false;
                    try {
                        startNewCycle();
                        cycleStarted = true;
                        soundManager.playWithEnd('round_start', () => {
                            setIsGameStarted(true);
                            setIsStarting(false);
                            setIsPaused(false);
                            setInputVisible(true);
                            try {
                                if (typeof temps !== 'undefined') playBGMForSpeed(temps);
                            } catch (e) { console.error(e); }
                        });
                    } catch (e) {
                        setIsGameStarted(true);
                        setIsPaused(false);
                        setInputVisible(true);
                        try { if (typeof temps !== 'undefined') playBGMForSpeed(temps); } catch (e) { console.error(e); }
                        if (!cycleStarted) startNewCycle();
                        console.error(e);
                    }
                });

                // fallback: if audio callback never runs, force-start the game after 3s
                if (startTimeoutRef.current) {
                    clearTimeout(startTimeoutRef.current);
                    startTimeoutRef.current = null;
                }
                startTimeoutRef.current = setTimeout(() => {
                    try {
                        const startState = gameManager.gameStart();
                        if (startState) {
                            setCurrentChar(startState.startChar);
                            setWord(startState.startChar);
                            if (startState.missionChar) setMissionChar(startState.missionChar);
                            else setMissionChar("");
                            TURN_TIME_LIMIT = startState.turnTime / 1000;
                            setLastState({
                                turnTime: startState.turnTime,
                                roundTime: ROUND_TIME_LIMIT,
                                speed: startState.turnSpeed
                            });
                            temps = startState.turnSpeed;
                        }
                    } catch (e) { console.error(e); }
                    try {
                        startNewCycle();
                        setIsGameStarted(true);
                        setIsStarting(false);
                        setIsPaused(false);
                        setInputVisible(true);
                        try { if (typeof temps !== 'undefined') playBGMForSpeed(temps); } catch (e) { console.error(e); }
                    } catch (e) { console.error(e); }
                    if (startTimeoutRef.current) { clearTimeout(startTimeoutRef.current); startTimeoutRef.current = null; }
                }, 3000);
            } catch (e) {
                setIsGameStarted(true);
                setIsStarting(false);
                setIsPaused(false);
                startNewCycle();
                console.error(e);
            }
            return;
        }

        // 즉시 게임 종료 명령어
        if (input === '/gg' || input === '/ㅈㅈ') {
            endGame();
            return;
        }

        if (!isGameStarted) {
            setChatInput('');
            return;
        }

        if (input.startsWith(currentChar)) {
            try { soundManager.stop('fail'); } catch (e) { console.error(e); }
            if (failTimeoutRef.current) {
                clearTimeout(failTimeoutRef.current);
                failTimeoutRef.current = null;
            }

            beatTimeoutRefs.current.forEach(timeout => clearTimeout(timeout));
            beatTimeoutRefs.current = [];

            setIsFail(false);
            setChatInput('');

            // submit to gameManager for validation and next state
            const remainingMs = roundTime === Infinity ? 0 : Math.round(roundTime * 1000);
            const submitRes = gameManager.submitWord(input, remainingMs);
            if (!submitRes.ok) {
                // failed by gameManager rules
                setWord(`${input}${submitRes.reason ? ": " + submitRes.reason : ""}`);
                setIsFail(true);
                setChatInput('');
                try { soundManager.play('fail'); } catch (e) { console.error(e); }
                setTimeout(() => {
                    setIsFail(false);
                    if (!hintVisible) { setWord(currentChar); }
                }, 2000);
                return;
            }
            setChainCount((v) => v + 1);
            setInputVisible(false);
            setLastState({
                turnTime: submitRes.trunTime,
                roundTime: ROUND_TIME_LIMIT,
                speed: submitRes.turnSpeed
            })
            TURN_TIME_LIMIT = submitRes.trunTime / 1000;

            setHistoryItems((prev) => {
                const newHistory = [{ theme: submitRes.wordEntry.theme, word: input }, ...prev];
                return newHistory.slice(0, 5);
            });

            setIsPaused(true);

            const wordLength = input.length;
            if (wordLength <= 8 && BEAT[wordLength]) {
                const beatPattern = BEAT[wordLength];
                if (lastState === null) return;
                try { stopBGMForSpeed(lastState.speed); } catch (e) { console.error(e); }
                setWord(input);
                setAnimatingWord(input);
                const initialVisible = new Array(wordLength).fill(false);
                setVisibleChars(initialVisible);

                let beatIndex = 0;
                if (lastState === null) return;
                const safeTurnTime = isFinite(lastState.turnTime) ? lastState.turnTime : 15000;
                const intervalTime = Math.max(10, Math.floor(safeTurnTime / 96));

                for (let i = 0; i < beatPattern.length; i++) {
                    if (beatPattern[i] === '1') {
                        const currentBeatIndex = beatIndex;
                        const timeout = setTimeout(() => {
                            setVisibleChars(prev => {
                                const newVisible = [...prev];
                                newVisible[currentBeatIndex] = true;
                                return newVisible;
                            });
                            try {
                                if (lastState === null) return;
                                soundManager.playOnce(`As${lastState.speed}`);
                                const char = input[currentBeatIndex];
                                if (char === missionChar) {
                                    soundManager.play('mission');
                                }
                            } catch (e) { console.error(e); }
                        }, i * intervalTime);
                        beatTimeoutRefs.current.push(timeout);
                        beatIndex++;
                    }
                }

                const totalAnimationTime = beatPattern.length * intervalTime + 120;
                const finalTimeout = setTimeout(() => {
                    if (lastState === null) return;
                    try { soundManager.play(`K${lastState.speed}`); } catch (e) { console.error(e); }

                    const runPulse = (repeats = 3) => {
                        if (lastState === null) return 0;
                        const safeBlinkSource = isFinite(lastState.turnTime) ? lastState.turnTime : 15000;
                        const blinkTick = Math.max(10, Math.floor(safeBlinkSource / 96));
                        let total = 0;
                        for (let r = 0; r < repeats; r++) {
                            const on = setTimeout(() => setPulseOn(true), total);
                            beatTimeoutRefs.current.push(on);
                            total += blinkTick;
                            const off = setTimeout(() => setPulseOn(false), total);
                            beatTimeoutRefs.current.push(off);
                            total += Math.floor(blinkTick * 1.5);
                        }
                        return total;
                    };

                    const pulseDuration = runPulse(2);
                    const cleanupTimeout = setTimeout(() => {
                        setAnimatingWord(null);
                        if (submitRes.nextMissionChar) {
                            setMissionChar(submitRes.nextMissionChar);
                        }
                        setIsPaused(false);
                        try { playBGMForSpeed(submitRes.turnSpeed); } catch (e) { console.error(e); }
                        if (typeof submitRes !== 'undefined' && submitRes && submitRes.nextChar) {
                            setCurrentChar(submitRes.nextChar);
                            if (submitRes.nextMissionChar) setMissionChar(submitRes.nextMissionChar);
                        }
                        startNewCycle();
                        setInputVisible(true);
                        setTimeout(() => {
                            safeFocusHead();
                        }, 0);
                    }, pulseDuration);
                    beatTimeoutRefs.current.push(cleanupTimeout);
                }, totalAnimationTime);
                beatTimeoutRefs.current.push(finalTimeout);
            } else if (wordLength >= 9) {
                if (lastState === null) return;
                try { stopBGMForSpeed(lastState.speed); } catch (e) { console.error(e); }
                setWord(input);
                setAnimatingWord(input);
                const initialVisible = new Array(wordLength).fill(false);
                setVisibleChars(initialVisible);

                if (lastState === null) return;
                const safeTurnTime2 = isFinite(lastState.turnTime) ? lastState.turnTime : 15000;
                const intervalTime = Math.max(10, Math.floor(safeTurnTime2 / 12 / wordLength));

                for (let i = 0; i < wordLength; i++) {
                    const timeout = setTimeout(() => {
                        setVisibleChars(prev => {
                            const newVisible = [...prev];
                            newVisible[i] = true;
                            return newVisible;
                        });
                        try {
                            soundManager.play('Al');
                        } catch (e) { console.error(e); }
                    }, i * intervalTime);
                    beatTimeoutRefs.current.push(timeout);
                }

                const totalAnimationTime = wordLength * intervalTime + 120;
                const finalTimeout = setTimeout(() => {
                    if (lastState === null) return;
                    try { soundManager.play(`K${lastState.speed}`); } catch (e) { console.error(e); }
                    const runPulse = (repeats = 2) => {
                        if (lastState === null) return 0;
                        const safeBlinkSource2 = isFinite(lastState.turnTime) ? lastState.turnTime : 15000;
                        const blinkTick = Math.max(10, Math.floor(safeBlinkSource2 / 46));
                        let total = 0;
                        for (let r = 0; r < repeats; r++) {
                            const on = setTimeout(() => setPulseOn(true), total);
                            beatTimeoutRefs.current.push(on);
                            total += blinkTick;
                            const off = setTimeout(() => setPulseOn(false), total);
                            beatTimeoutRefs.current.push(off);
                            total += Math.floor(blinkTick * 1.5);
                        }
                        return total;
                    };

                    const pulseDuration = runPulse();
                    const cleanup = setTimeout(() => {
                        setAnimatingWord(null);
                        if (submitRes.nextMissionChar) {
                            setMissionChar(submitRes.nextMissionChar);
                        }
                        setIsPaused(false);
                        try { playBGMForSpeed(submitRes.turnSpeed); } catch (e) { console.error(e); }
                        if (typeof submitRes !== 'undefined' && submitRes && submitRes.nextChar) {
                            setCurrentChar(submitRes.nextChar);
                            if (submitRes.nextMissionChar) setMissionChar(submitRes.nextMissionChar);
                        }
                        startNewCycle();
                        setInputVisible(true);
                        setTimeout(() => {
                            safeFocusHead();
                        }, 0);
                    }, pulseDuration);
                    beatTimeoutRefs.current.push(cleanup);
                }, totalAnimationTime);
                beatTimeoutRefs.current.push(finalTimeout);
            } else {
                setWord(input);
                setAnimatingWord(null);
                setTimeout(() => {
                    if (submitRes.nextMissionChar) {
                        setMissionChar(submitRes.nextMissionChar);
                    }
                    setIsPaused(false);
                    try { playBGMForSpeed(submitRes.turnSpeed); } catch (e) { console.error(e); }
                    if (typeof submitRes !== 'undefined' && submitRes && submitRes.nextChar) {
                        setCurrentChar(submitRes.nextChar);
                        if (submitRes.nextMissionChar) setMissionChar(submitRes.nextMissionChar);
                    }
                    startNewCycle();
                    setInputVisible(true);
                    setTimeout(() => {
                        safeFocusHead();
                    }, 0);
                }, 2000);
            }
        } else {
            if (failTimeoutRef.current) {
                clearTimeout(failTimeoutRef.current);
                failTimeoutRef.current = null;
            }

            setWord(input);
            setIsFail(true);
            setChatInput('');
            try { soundManager.play('fail'); } catch (e) { console.error(e); }
            failTimeoutRef.current = setTimeout(() => {
                setIsFail(false);
                if (!hintVisible) { setWord(currentChar); }
                failTimeoutRef.current = null;
            }, 2000);
        }
    };

    // load mock DB on mount
    useEffect(() => {
        // update local time limits from setting
        const s = gameManager.getSetting();
        if (s.roundTime === 0) {
            ROUND_TIME_LIMIT = Infinity;
        } else {
            ROUND_TIME_LIMIT = Math.max(1, Math.round(s.roundTime / 1000));
        }
        setRoundTime(ROUND_TIME_LIMIT);
        setTurnTime(TURN_TIME_LIMIT);
    }, []);

    // Also react to pendingStart changes while this hook is mounted.
    // This allows chat commands that set `pendingStart` (e.g. /ㄱ, /r)
    // to trigger a restart even when the game UI is already mounted
    // or when a game has just ended.
    useEffect(() => {
        if (pendingStart) {
            clearPendingStart();
            handleInput('/시작');
        }
    }, [pendingStart, clearPendingStart]);

    return {
        word,
        isFail,
        isGameStarted,
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
        closeGameResult: () => setGameResult(null)
    };
};
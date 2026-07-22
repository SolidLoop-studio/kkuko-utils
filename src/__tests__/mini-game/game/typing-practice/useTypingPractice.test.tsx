import { renderHook, act, waitFor } from '@testing-library/react';
import { useTypingPractice } from '../../../../app/mini-game/game/typing-practice/hooks/useTypingPractice';
import type { TypingPracticeSettings } from '../../../../app/mini-game/game/typing-practice/types/typing-practice.types';

jest.mock('../../../../app/mini-game/game/lib/wordDB', () => ({
    getAllWords: jest.fn(),
}));

const { getAllWords } = jest.requireMock('../../../../app/mini-game/game/lib/wordDB');

const settings: TypingPracticeSettings = {
    sessionMode: 'fixed-count',
    durationSeconds: 60,
    wordCount: 10,
    language: 'all',
    order: 'sorted',
    minLength: 2,
};

describe('useTypingPractice', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-07-22T00:00:00Z'));
        getAllWords.mockResolvedValue([
            { word: '가방', theme: '자유' },
            { word: '나무', theme: '자유' },
        ]);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('loads words and renders the first target', async () => {
        const { result } = renderHook(() => useTypingPractice(settings));

        await waitFor(() => expect(result.current.targetWord).toBe('가방'));
        expect(result.current.blockedMessage).toBeNull();
    });

    it('does not advance timed progress while word loading is pending', async () => {
        const timedSettings: TypingPracticeSettings = {
            ...settings,
            sessionMode: 'timed',
        };
        let resolveWords: (words: { word: string; theme: string }[]) => void;
        getAllWords.mockImplementation(() => new Promise((resolve) => {
            resolveWords = resolve;
        }));

        const { result } = renderHook(() => useTypingPractice(timedSettings));

        act(() => {
            jest.advanceTimersByTime(10_000);
        });

        expect(result.current.progressValue).toBe(0);
        expect(result.current.metrics.elapsedMs).toBe(0);

        await act(async () => {
            resolveWords([
                { word: '가방', theme: '자유' },
                { word: '나무', theme: '자유' },
            ]);
        });

        expect(result.current.targetWord).toBe('가방');
        expect(result.current.progressValue).toBe(0);
    });

    it('submits correct and incorrect attempts with combo updates', async () => {
        const { result } = renderHook(() => useTypingPractice(settings));
        await waitFor(() => expect(result.current.targetWord).toBe('가방'));

        act(() => {
            result.current.handleInputChange({ target: { value: '가방' } } as React.ChangeEvent<HTMLInputElement>);
        });

        act(() => {
            result.current.handleKeyDown({ key: 'Enter', preventDefault: jest.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>);
        });

        expect(result.current.targetWord).toBe('나무');
        expect(result.current.metrics.combo).toBe(1);

        act(() => {
            result.current.handleInputChange({ target: { value: '나비' } } as React.ChangeEvent<HTMLInputElement>);
        });

        act(() => {
            result.current.handleKeyDown({ key: 'Enter', preventDefault: jest.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>);
        });

        expect(result.current.metrics.combo).toBe(0);
        expect(result.current.isFinished).toBe(true);
        expect(result.current.resultOpen).toBe(true);
    });

    it('blocks when filters remove all words', async () => {
        jest.useRealTimers();
        getAllWords.mockResolvedValue([{ word: 'apple', theme: '자유' }]);

        const { result } = renderHook(() => useTypingPractice({ ...settings, language: 'ko' }));

        await waitFor(() => expect(result.current.blockedMessage).toBe('조건에 맞는 단어가 없습니다. 언어나 최소 글자 수를 조정해주세요.'));
    });

    it('resets the completed session when restart finds no matching words', async () => {
        const { result } = renderHook(() => useTypingPractice(settings));
        await waitFor(() => expect(result.current.targetWord).toBe('가방'));

        act(() => {
            result.current.handleInputChange({ target: { value: '가방' } } as React.ChangeEvent<HTMLInputElement>);
        });

        act(() => {
            result.current.handleKeyDown({ key: 'Enter', preventDefault: jest.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>);
        });

        act(() => {
            result.current.handleInputChange({ target: { value: '나무' } } as React.ChangeEvent<HTMLInputElement>);
        });

        act(() => {
            result.current.handleKeyDown({ key: 'Enter', preventDefault: jest.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>);
        });

        expect(result.current.isFinished).toBe(true);
        expect(result.current.resultOpen).toBe(true);

        act(() => {
            result.current.handleInputChange({ target: { value: 'residual input' } } as React.ChangeEvent<HTMLInputElement>);
        });

        getAllWords.mockResolvedValue([{ word: '!!', theme: '자유' }]);

        await act(async () => {
            await result.current.restart();
        });

        expect(result.current).toMatchObject({
            targetWord: '',
            input: '',
            attempts: [],
            isFinished: false,
            resultOpen: false,
            blockedMessage: '조건에 맞는 단어가 없습니다. 언어나 최소 글자 수를 조정해주세요.',
        });
        expect(result.current.metrics.combo).toBe(0);
    });

    it('finishes a timed session at its duration and clears the interval', async () => {
        const timedSettings: TypingPracticeSettings = {
            ...settings,
            sessionMode: 'timed',
            durationSeconds: 30,
        };
        const { result } = renderHook(() => useTypingPractice(timedSettings));
        await waitFor(() => expect(result.current.targetWord).toBe('가방'));

        await act(async () => {
            await result.current.restart();
        });

        act(() => {
            jest.advanceTimersByTime(29_750);
        });
        expect(result.current.isFinished).toBe(false);

        act(() => {
            jest.advanceTimersByTime(250);
        });

        expect(result.current.isFinished).toBe(true);
        expect(result.current.resultOpen).toBe(true);
        expect(result.current.progressValue).toBe(30);
        expect(jest.getTimerCount()).toBe(0);
    });

    it('cycles a timed queue and remains active until the timer expires', async () => {
        const timedSettings: TypingPracticeSettings = {
            ...settings,
            sessionMode: 'timed',
            durationSeconds: 30,
        };
        const { result } = renderHook(() => useTypingPractice(timedSettings));
        await waitFor(() => expect(result.current.targetWord).toBe('가방'));

        act(() => {
            result.current.handleInputChange({ target: { value: '가방' } } as React.ChangeEvent<HTMLInputElement>);
        });
        act(() => {
            result.current.handleKeyDown({ key: 'Enter', preventDefault: jest.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>);
        });
        expect(result.current.targetWord).toBe('나무');

        act(() => {
            result.current.handleInputChange({ target: { value: '나무' } } as React.ChangeEvent<HTMLInputElement>);
        });
        act(() => {
            result.current.handleKeyDown({ key: 'Enter', preventDefault: jest.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>);
        });

        expect(result.current.targetWord).toBe('가방');
        expect(result.current.attempts).toHaveLength(2);
        expect(result.current.isFinished).toBe(false);
        expect(result.current.resultOpen).toBe(false);
    });

    it('rejects a timed submission at the deadline before the sampled timer ticks', async () => {
        const timedSettings: TypingPracticeSettings = {
            ...settings,
            sessionMode: 'timed',
            durationSeconds: 30,
        };
        const { result } = renderHook(() => useTypingPractice(timedSettings));
        await waitFor(() => expect(result.current.targetWord).toBe('가방'));

        act(() => {
            result.current.handleInputChange({ target: { value: '가방' } } as React.ChangeEvent<HTMLInputElement>);
        });

        act(() => {
            jest.advanceTimersByTime(29_999);
            jest.setSystemTime(Date.now() + 1);
            result.current.handleKeyDown({ key: 'Enter', preventDefault: jest.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>);
        });

        expect(result.current.attempts).toHaveLength(0);
        expect(result.current.isFinished).toBe(true);
        expect(result.current.resultOpen).toBe(true);
    });

    it('exposes a retryable blocked state when loading words fails', async () => {
        jest.useRealTimers();
        const error = new Error('indexed db unavailable');
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        getAllWords.mockRejectedValueOnce(error);
        const { result } = renderHook(() => useTypingPractice(settings));

        await waitFor(() => expect(result.current.blockedMessage).toBe('단어를 불러오지 못했습니다. 다시 시도해주세요.'));
        expect(result.current.isLoading).toBe(false);
        expect(consoleError).toHaveBeenCalledWith(error);

        getAllWords.mockResolvedValue([
            { word: '가방', theme: '자유' },
            { word: '나무', theme: '자유' },
        ]);
        await act(async () => {
            await result.current.restart();
        });

        expect(result.current.targetWord).toBe('가방');
        expect(result.current.blockedMessage).toBeNull();
        consoleError.mockRestore();
    });

    it('ignores a stale word load after settings change', async () => {
        jest.useRealTimers();
        let resolveFirstLoad: (words: { word: string; theme: string }[]) => void;
        getAllWords
            .mockImplementationOnce(() => new Promise((resolve) => {
                resolveFirstLoad = resolve;
            }))
            .mockResolvedValueOnce([{ word: 'apple', theme: '자유' }]);

        const { result, rerender } = renderHook(
            ({ currentSettings }) => useTypingPractice(currentSettings),
            { initialProps: { currentSettings: settings } },
        );

        rerender({ currentSettings: { ...settings, language: 'en' } });
        await waitFor(() => expect(result.current.targetWord).toBe('apple'));

        await act(async () => {
            resolveFirstLoad([{ word: '가방', theme: '자유' }]);
        });

        expect(result.current.targetWord).toBe('apple');
        expect(result.current.blockedMessage).toBeNull();
    });

    it('does not commit a pending word load after unmount', async () => {
        let resolveLoad: (words: { word: string; theme: string }[]) => void = () => undefined;
        getAllWords.mockImplementationOnce(() => new Promise((resolve) => {
            resolveLoad = resolve;
        }));
        const { result, unmount } = renderHook(() => useTypingPractice(settings));
        const restart = result.current.restart;

        unmount();
        await act(async () => {
            resolveLoad([{ word: '가방', theme: '자유' }]);
        });

        await act(async () => {
            await restart();
        });
        expect(getAllWords).toHaveBeenCalledTimes(1);
    });
});

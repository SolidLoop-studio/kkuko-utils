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
    wordCount: 2,
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

        expect(result.current.progressValue).toBe(1);
        expect(result.current.metrics.elapsedMs).toBe(1_000);

        await act(async () => {
            resolveWords([
                { word: '가방', theme: '자유' },
                { word: '나무', theme: '자유' },
            ]);
        });

        expect(result.current.targetWord).toBe('가방');
        expect(result.current.progressValue).toBe(1);
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
});

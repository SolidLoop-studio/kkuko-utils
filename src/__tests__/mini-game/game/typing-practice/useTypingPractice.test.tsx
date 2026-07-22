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
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TypingPracticeBody from '../../../../app/mini-game/game/typing-practice/TypingPracticeBody';
import type { TypingPracticeSettings } from '../../../../app/mini-game/game/typing-practice/types/typing-practice.types';

jest.mock('../../../../app/mini-game/game/lib/wordDB', () => ({
    getAllWords: jest.fn().mockResolvedValue([
        { word: '가방', theme: '자유' },
        { word: '나무', theme: '자유' },
    ]),
}));
jest.mock('../../../../app/mini-game/game/lib/SoundManager', () => ({
    soundManager: {
        play: jest.fn(),
        playWithEnd: jest.fn((_: string, onEnd: () => void) => onEnd()),
        stop: jest.fn(),
    },
}));

const { getAllWords } = jest.requireMock('../../../../app/mini-game/game/lib/wordDB');
const { soundManager } = jest.requireMock('../../../../app/mini-game/game/lib/SoundManager');
const words = [
    { word: '가방', theme: '자유' },
    { word: '나무', theme: '자유' },
];

const settings: TypingPracticeSettings = {
    sessionMode: 'fixed-count',
    durationSeconds: 60,
    wordCount: 10,
    language: 'all',
    order: 'sorted',
    minLength: 2,
};

describe('TypingPracticeBody', () => {
    beforeEach(() => {
        soundManager.playWithEnd.mockImplementation((_: string, onEnd: () => void) => onEnd());
        getAllWords.mockResolvedValue(words);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('renders target word, live stats, and result modal after fixed count', async () => {
        const user = userEvent.setup();
        render(<TypingPracticeBody settings={settings} onExitToSetup={jest.fn()} />);

        expect(await screen.findByText('가방')).toBeInTheDocument();
        expect(screen.getByText('WPM')).toBeInTheDocument();
        expect(screen.getByText('분당타자수')).toBeInTheDocument();

        await user.type(screen.getByRole('textbox'), '가방{enter}');
        expect(await screen.findByText('나무')).toBeInTheDocument();

        await user.type(screen.getByRole('textbox'), '나비{enter}');
        expect(await screen.findByText('타자 연습 결과')).toBeInTheDocument();
        expect(screen.getByText('최대 콤보')).toBeInTheDocument();
    });

    it('shows provisional highlighting during IME composition', async () => {
        const { container } = render(<TypingPracticeBody settings={settings} onExitToSetup={jest.fn()} />);
        const input = await screen.findByRole('textbox');
        await screen.findByText('가방');

        fireEvent.compositionStart(input);
        fireEvent.change(input, { target: { value: '나' } });

        expect(container.querySelector('.text-red-300')).not.toBeInTheDocument();
        expect(container.querySelector('.text-yellow-200')).toBeInTheDocument();

        fireEvent.compositionEnd(input);
        expect(container.querySelector('.text-red-300')).toBeInTheDocument();
    });

    it('marks committed Korean IME mismatches red while only the active syllable is provisional', async () => {
        getAllWords.mockResolvedValueOnce([{ word: '단순누진율', theme: '경제' }]);
        const { container } = render(<TypingPracticeBody settings={settings} onExitToSetup={jest.fn()} />);
        const input = await screen.findByRole('textbox');
        await screen.findByText('단순누진율');

        fireEvent.compositionStart(input);
        fireEvent.change(input, { target: { value: '단수누' } });

        const targetCharacters = Array.from(container.querySelectorAll('[data-testid="typing-target-character"]'));
        expect(targetCharacters.map((node) => node.textContent)).toEqual(['단', '순', '누', '진', '율']);
        expect(targetCharacters[0]).toHaveClass('text-green-300');
        expect(targetCharacters[1]).toHaveClass('text-red-300');
        expect(targetCharacters[2]).toHaveClass('text-yellow-200');
    });

    it('keeps a partial visible fragment on a 100-character target', async () => {
        const longWord = '가'.repeat(100);
        const nextLongWord = '나'.repeat(100);
        getAllWords.mockResolvedValueOnce([
            { word: longWord, theme: '장문' },
            { word: nextLongWord, theme: '장문' },
        ]);
        const { container } = render(
            <TypingPracticeBody settings={settings} onExitToSetup={jest.fn()} />,
        );
        const input = await screen.findByRole('textbox');
        await screen.findByText(longWord);

        fireEvent.change(input, { target: { value: '가'.repeat(40) } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(input).toHaveValue('가'.repeat(40));
        expect(screen.getByRole('status')).toHaveTextContent('60자가 남았습니다.');
        expect(screen.getByTestId('typing-target-count')).toHaveTextContent('40 / 100');
        expect(screen.getByText(longWord)).toHaveClass('sr-only');
        expect(container.querySelectorAll('[data-testid="typing-target-character"]')).toHaveLength(100);
        expect(screen.queryByRole('dialog', { name: '타자 연습 결과' })).not.toBeInTheDocument();
    });

    it('keeps highlighted target characters hidden from assistive technology', async () => {
        const { container } = render(<TypingPracticeBody settings={settings} onExitToSetup={jest.fn()} />);
        await screen.findByText('가방');

        const highlightedCharacters = container.querySelectorAll('[aria-hidden="true"]');
        expect(highlightedCharacters).toHaveLength(2);
        expect(screen.getByText('가방')).toHaveClass('sr-only');
    });

    it('uses word-practice style progress, places stats below input, and shows success count in chain', async () => {
        const user = userEvent.setup();
        const { container } = render(<TypingPracticeBody settings={{ ...settings, sessionMode: 'timed', durationSeconds: 60 }} onExitToSetup={jest.fn()} />);
        const input = await screen.findByRole('textbox');
        await screen.findByText('다음: 나무');

        expect(screen.getByText(/초$/)).toBeInTheDocument();
        expect(screen.queryByText(/0 \/ 60/)).not.toBeInTheDocument();
        const progressFill = screen.getByTestId('typing-practice-progress-bar').firstElementChild?.firstElementChild;
        const nextWordFill = screen.getByTestId('typing-practice-next-word-bar').firstElementChild?.firstElementChild;
        expect(progressFill).toHaveStyle({ backgroundColor: '#223C6C' });
        expect(nextWordFill).toHaveStyle({ backgroundColor: '#E6E846' });
        expect(screen.getByText('다음: 나무')).toHaveClass('text-black');
        expect(screen.getByText('다음: 나무')).toHaveClass('text-center');
        expect(container.querySelector('.items')).not.toBeInTheDocument();
        expect(container.querySelector('.chain')).toHaveTextContent('0');

        const statPanel = screen.getByTestId('typing-practice-live-stats');
        expect(statPanel.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();

        await user.type(input, '가방{enter}');
        expect(container.querySelector('.chain')).toHaveTextContent('1');
    });

    it('hides the next word until the round_start sound finishes', async () => {
        const soundCallbacks = new Map<string, () => void>();
        soundManager.playWithEnd.mockImplementation((soundName: string, onEnd: () => void) => {
            soundCallbacks.set(soundName, onEnd);
        });

        render(<TypingPracticeBody settings={{ ...settings, sessionMode: 'timed', durationSeconds: 60 }} onExitToSetup={jest.fn()} />);

        expect(await screen.findByText('게임이 곧 시작됩니다')).toBeInTheDocument();
        expect(screen.queryByText('다음: 나무')).not.toBeInTheDocument();

        act(() => {
            soundCallbacks.get('game_start')?.();
        });

        expect(await screen.findByText('가방')).toBeInTheDocument();
        expect(screen.queryByText('다음: 나무')).not.toBeInTheDocument();

        act(() => {
            soundCallbacks.get('round_start')?.();
        });

        expect(await screen.findByText('다음: 나무')).toBeInTheDocument();
    });

    it('blurs the typing practice surface while the exit confirm modal is open', async () => {
        render(<TypingPracticeBody settings={settings} onExitToSetup={jest.fn()} isExitConfirmOpen />);
        await screen.findByRole('textbox');

        expect(screen.getByTestId('typing-practice-surface')).toHaveClass('blur-sm');
        expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
    });

    it('keeps the exit result open when word loading resolves after exit is confirmed', async () => {
        let resolveWords: (nextWords: typeof words) => void = () => undefined;
        getAllWords.mockImplementationOnce(() => new Promise((resolve) => {
            resolveWords = resolve;
        }));

        const { rerender } = render(<TypingPracticeBody settings={settings} onExitToSetup={jest.fn()} exitRequestToken={0} />);

        rerender(<TypingPracticeBody settings={settings} onExitToSetup={jest.fn()} exitRequestToken={1} />);
        expect(await screen.findByRole('dialog', { name: '타자 연습 결과' })).toBeInTheDocument();

        await act(async () => {
            resolveWords(words);
        });

        expect(screen.getByRole('dialog', { name: '타자 연습 결과' })).toBeInTheDocument();
        expect(screen.queryByText('가방')).not.toBeInTheDocument();
    });

    it('focuses the input when a target loads and after restart', async () => {
        const user = userEvent.setup();
        render(<TypingPracticeBody settings={settings} onExitToSetup={jest.fn()} />);
        const input = await screen.findByRole('textbox');

        await waitFor(() => expect(input).toHaveFocus());
        await user.type(input, '가방{enter}');
        await user.type(input, '나무{enter}');
        await screen.findByRole('dialog', { name: '타자 연습 결과' });

        await user.click(screen.getByRole('button', { name: '다시 시작' }));

        await waitFor(() => expect(input).toHaveFocus());
    });

    it('keeps the input read-only after a finished result is closed', async () => {
        const user = userEvent.setup();
        render(<TypingPracticeBody settings={settings} onExitToSetup={jest.fn()} />);
        const input = await screen.findByRole('textbox');

        await user.type(input, '가방{enter}');
        await user.type(input, '나무{enter}');
        await screen.findByRole('dialog', { name: '타자 연습 결과' });

        await user.click(screen.getByRole('button', { name: '닫기' }));

        expect(input).toHaveAttribute('readonly');
        expect(input).not.toHaveFocus();
    });

    it('keeps the result modal open when Enter is pressed immediately after finishing', async () => {
        const user = userEvent.setup();
        render(<TypingPracticeBody settings={settings} onExitToSetup={jest.fn()} />);
        const input = await screen.findByRole('textbox');

        await user.type(input, '가방{enter}');
        await user.type(input, '나무{enter}');
        await screen.findByRole('dialog', { name: '타자 연습 결과' });
        await user.keyboard('{Enter}');

        expect(screen.getByRole('dialog', { name: '타자 연습 결과' })).toBeInTheDocument();
    });

    it('offers a retry when loading words fails', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        getAllWords.mockRejectedValueOnce(new Error('indexed db unavailable')).mockResolvedValueOnce(words);
        const user = userEvent.setup();

        render(<TypingPracticeBody settings={settings} onExitToSetup={jest.fn()} />);

        expect(await screen.findByText('단어를 불러오지 못했습니다. 다시 시도해주세요.')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: '다시 시도' }));

        expect(await screen.findByText('가방')).toBeInTheDocument();
    });
});

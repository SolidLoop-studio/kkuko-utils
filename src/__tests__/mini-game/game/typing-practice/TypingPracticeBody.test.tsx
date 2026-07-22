import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TypingPracticeBody from '../../../../app/mini-game/game/typing-practice/TypingPracticeBody';
import type { TypingPracticeSettings } from '../../../../app/mini-game/game/typing-practice/types/typing-practice.types';

jest.mock('../../../../app/mini-game/game/lib/wordDB', () => ({
    getAllWords: jest.fn().mockResolvedValue([
        { word: '가방', theme: '자유' },
        { word: '나무', theme: '자유' },
    ]),
}));

const { getAllWords } = jest.requireMock('../../../../app/mini-game/game/lib/wordDB');
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

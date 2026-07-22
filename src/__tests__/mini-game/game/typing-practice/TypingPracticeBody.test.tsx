import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TypingPracticeBody from '../../../../app/mini-game/game/typing-practice/TypingPracticeBody';
import type { TypingPracticeSettings } from '../../../../app/mini-game/game/typing-practice/types/typing-practice.types';

jest.mock('../../../../app/mini-game/game/lib/wordDB', () => ({
    getAllWords: jest.fn().mockResolvedValue([
        { word: '가방', theme: '자유' },
        { word: '나무', theme: '자유' },
    ]),
}));

const settings: TypingPracticeSettings = {
    sessionMode: 'fixed-count',
    durationSeconds: 60,
    wordCount: 2,
    language: 'all',
    order: 'sorted',
    minLength: 2,
};

describe('TypingPracticeBody', () => {
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
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TypingPracticeResultModal from '@/src/app/mini-game/game/typing-practice/TypingPracticeResultModal';
import type { TypingPracticeMetrics } from '@/src/app/mini-game/game/typing-practice/types/typing-practice.types';

const metrics: TypingPracticeMetrics = {
    correctCharacters: 10,
    totalSubmittedCharacters: 10,
    accuracy: 100,
    wpm: 20,
    charactersPerMinute: 100,
    completedWords: 2,
    failedWords: 0,
    totalAttempts: 2,
    averageWordTime: 500,
    combo: 2,
    maxCombo: 2,
    elapsedMs: 1000,
};

describe('TypingPracticeResultModal', () => {
    it('exposes dialog semantics, focuses close, and closes on Escape', async () => {
        const user = userEvent.setup();
        const onClose = jest.fn();

        render(
            <TypingPracticeResultModal
                metrics={metrics}
                attempts={[]}
                onRestart={jest.fn()}
                onExitToSetup={jest.fn()}
                onClose={onClose}
            />,
        );

        expect(screen.getByRole('dialog', { name: '타자 연습 결과' })).toHaveAttribute('aria-modal', 'true');
        expect(screen.getByRole('button', { name: '결과 닫기' })).toHaveFocus();
        expect(screen.getByText('연습 시간')).toBeInTheDocument();
        expect(screen.getByText('1.0초')).toBeInTheDocument();

        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('keeps keyboard focus within the dialog', async () => {
        const user = userEvent.setup();
        render(
            <TypingPracticeResultModal
                metrics={metrics}
                attempts={[]}
                onRestart={jest.fn()}
                onExitToSetup={jest.fn()}
                onClose={jest.fn()}
            />,
        );
        const dialog = screen.getByRole('dialog', { name: '타자 연습 결과' });
        const buttons = within(dialog).getAllByRole('button');
        const firstButton = buttons[0];
        const lastButton = buttons[buttons.length - 1];

        lastButton.focus();
        await user.keyboard('{Tab}');
        expect(firstButton).toHaveFocus();

        firstButton.focus();
        await user.keyboard('{Shift>}{Tab}{/Shift}');
        expect(lastButton).toHaveFocus();
    });

    it('restores focus to the previously focused control when removed', () => {
        const previous = document.createElement('button');
        document.body.appendChild(previous);
        previous.focus();

        const { unmount } = render(
            <TypingPracticeResultModal
                metrics={metrics}
                attempts={[]}
                onRestart={jest.fn()}
                onExitToSetup={jest.fn()}
                onClose={jest.fn()}
            />,
        );

        unmount();
        expect(previous).toHaveFocus();
        previous.remove();
    });

    it('labels recent attempts with explicit success and failure status', () => {
        render(
            <TypingPracticeResultModal
                metrics={metrics}
                attempts={[
                    {
                        target: '가방',
                        submitted: '가방',
                        isCorrect: true,
                        correctCharacters: 2,
                        submittedCharacters: 2,
                        completedAt: 1,
                    },
                    {
                        target: '나무',
                        submitted: '나비',
                        isCorrect: false,
                        correctCharacters: 1,
                        submittedCharacters: 2,
                        completedAt: 2,
                    },
                ]}
                onRestart={jest.fn()}
                onExitToSetup={jest.fn()}
                onClose={jest.fn()}
            />,
        );

        expect(screen.getByText('성공')).toBeInTheDocument();
        expect(screen.getByText('실패')).toBeInTheDocument();
    });
});

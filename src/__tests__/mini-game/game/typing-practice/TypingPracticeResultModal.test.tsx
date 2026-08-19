import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TypingPracticeResultModal from '@/src/app/mini-game/game/typing-practice/TypingPracticeResultModal';
import type { TypingPracticeMetrics } from '@/src/app/mini-game/game/typing-practice/types/typing-practice.types';

const metrics: TypingPracticeMetrics = {
    correctCharacters: 10,
    totalSubmittedCharacters: 10,
    typingUnits: 10,
    mistakeCount: 0,
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
    it('exposes dialog semantics, focuses the dialog, and closes on Escape', async () => {
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

        const dialog = screen.getByRole('dialog', { name: '타자 연습 결과' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveFocus();
        expect(screen.getByText('연습 시간')).toBeInTheDocument();
        expect(screen.getByText('1.0초')).toBeInTheDocument();

        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close from a buffered Enter key when the result opens', async () => {
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

        await user.keyboard('{Enter}');

        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog', { name: '타자 연습 결과' })).toBeInTheDocument();
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

    it('shows a characters-per-minute timeline chart instead of recent attempts', () => {
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
                        typingUnits: 5,
                        completedAt: 1,
                    },
                    {
                        target: '나무',
                        submitted: '나비',
                        isCorrect: false,
                        correctCharacters: 1,
                        submittedCharacters: 2,
                        typingUnits: 0,
                        completedAt: 2,
                    },
                ]}
                onRestart={jest.fn()}
                onExitToSetup={jest.fn()}
                onClose={jest.fn()}
            />,
        );

        expect(screen.getByText('분당타자수 추이')).toBeInTheDocument();
        expect(screen.getByText('시간(초)')).toBeInTheDocument();
        expect(screen.getAllByText('분당타자수').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByTestId('typing-cpm-chart')).toBeInTheDocument();
        expect(screen.queryByText('최근 입력')).not.toBeInTheDocument();
        expect(screen.queryByText('성공')).not.toBeInTheDocument();
        expect(screen.queryByText('실패')).not.toBeInTheDocument();
    });

    it('uses the final session elapsed time for the chart final characters-per-minute value', () => {
        render(
            <TypingPracticeResultModal
                metrics={{
                    ...metrics,
                    charactersPerMinute: 54,
                    elapsedMs: 10_000,
                }}
                attempts={[
                    {
                        target: '가방',
                        submitted: '가방',
                        isCorrect: true,
                        correctCharacters: 2,
                        submittedCharacters: 2,
                        typingUnits: 5,
                        completedAt: 2_000,
                    },
                    {
                        target: '나무',
                        submitted: '나무',
                        isCorrect: true,
                        correctCharacters: 2,
                        submittedCharacters: 2,
                        typingUnits: 4,
                        completedAt: 4_000,
                    },
                ]}
                onRestart={jest.fn()}
                onExitToSetup={jest.fn()}
                onClose={jest.fn()}
            />,
        );

        expect(screen.getByText('54.0')).toBeInTheDocument();
        expect(screen.getByText('최종 54.0')).toBeInTheDocument();
    });

    it('shows an empty chart message when there is not enough timeline data', () => {
        render(
            <TypingPracticeResultModal
                metrics={metrics}
                attempts={[]}
                onRestart={jest.fn()}
                onExitToSetup={jest.fn()}
                onClose={jest.fn()}
            />,
        );

        expect(screen.getByText('분당타자수 추이')).toBeInTheDocument();
        expect(screen.getByText('기록이 부족합니다')).toBeInTheDocument();
    });
});

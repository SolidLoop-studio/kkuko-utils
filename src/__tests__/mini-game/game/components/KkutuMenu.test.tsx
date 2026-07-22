import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import KkutuMenu from '@/src/app/mini-game/game/components/KkutuMenu';
import { useGameState } from '@/src/app/mini-game/game/hooks/useGameState';

jest.mock('@/app/mini-game/game/hooks/useGameState');
jest.mock('@/app/mini-game/game/components/HelpModal', () => () => <div data-testid="help-modal">Help Modal</div>);
jest.mock('@/app/mini-game/game/components/SettingsModal', () => () => <div data-testid="settings-modal">Settings Modal</div>);
jest.mock('@/app/mini-game/game/components/DictionaryModal', () => () => <div data-testid="dict-modal">Dictionary Modal</div>);
jest.mock('@/app/mini-game/game/components/ConfirmModal', () => ({ message, onConfirm, onCancel }: any) => (
    <div data-testid="confirm-modal">
        {message}
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
    </div>
));

describe('KkutuMenu', () => {
    const mockRequestStart = jest.fn();
    const mockExitGame = jest.fn();
    const mockDismissStartBlocked = jest.fn();
    const mockStartTypingPractice = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (useGameState as unknown as jest.Mock).mockReturnValue({
            isPlaying: false,
            requestStart: mockRequestStart,
            exitGame: mockExitGame,
            startBlocked: false,
            startBlockedMessage: null,
            dismissStartBlocked: mockDismissStartBlocked,
        });
    });

    it('should render buttons correctly when not playing', () => {
        render(<KkutuMenu practiceType="word-chain" onStartTypingPractice={mockStartTypingPractice} />);
        expect(screen.getByText('도움말')).toBeInTheDocument();
        expect(screen.getByText('설정')).toBeInTheDocument();
        expect(screen.getByText('사전')).toBeInTheDocument();
        expect(screen.getByText('시작')).toBeInTheDocument();
        expect(screen.queryByText('나가기')).not.toBeInTheDocument();
    });

    it('should render buttons correctly when playing', () => {
        (useGameState as unknown as jest.Mock).mockReturnValue({
            isPlaying: true,
            requestStart: mockRequestStart,
            exitGame: mockExitGame,
            startBlocked: false,
            startBlockedMessage: null,
            dismissStartBlocked: mockDismissStartBlocked,
        });
        render(<KkutuMenu practiceType="word-chain" onStartTypingPractice={mockStartTypingPractice} />);
        expect(screen.queryByText('시작')).not.toBeInTheDocument();
        expect(screen.getByText('나가기')).toBeInTheDocument();
    });

    it('should open help modal', () => {
        render(<KkutuMenu practiceType="word-chain" onStartTypingPractice={mockStartTypingPractice} />);
        fireEvent.click(screen.getByText('도움말'));
        expect(screen.getByTestId('help-modal')).toBeInTheDocument();
    });

    it('should open settings modal', () => {
        render(<KkutuMenu practiceType="word-chain" onStartTypingPractice={mockStartTypingPractice} />);
        fireEvent.click(screen.getByText('설정'));
        expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    });

    it('should open dictionary modal', () => {
        render(<KkutuMenu practiceType="word-chain" onStartTypingPractice={mockStartTypingPractice} />);
        fireEvent.click(screen.getByText('사전'));
        expect(screen.getByTestId('dict-modal')).toBeInTheDocument();
    });

    it('should call requestStart when start button is clicked', () => {
        render(<KkutuMenu practiceType="word-chain" onStartTypingPractice={mockStartTypingPractice} />);
        fireEvent.click(screen.getByText('시작'));
        expect(mockRequestStart).toHaveBeenCalled();
    });

    it('should call typing practice start handler when typing start button is clicked', () => {
        render(<KkutuMenu practiceType="typing-practice" onStartTypingPractice={mockStartTypingPractice} />);
        fireEvent.click(screen.getByText('시작'));
        expect(mockStartTypingPractice).toHaveBeenCalledTimes(1);
        expect(mockRequestStart).not.toHaveBeenCalled();
    });

    it('should call exitGame when exit button is clicked', () => {
        (useGameState as unknown as jest.Mock).mockReturnValue({
            isPlaying: true,
            requestStart: mockRequestStart,
            exitGame: mockExitGame,
            startBlocked: false,
            startBlockedMessage: null,
            dismissStartBlocked: mockDismissStartBlocked,
        });
        render(<KkutuMenu practiceType="word-chain" onStartTypingPractice={mockStartTypingPractice} />);
        fireEvent.click(screen.getByText('나가기'));
        expect(mockExitGame).toHaveBeenCalled();
    });

    it('confirms before exiting an active typing-practice session', () => {
        (useGameState as unknown as jest.Mock).mockReturnValue({
            isPlaying: true,
            requestStart: mockRequestStart,
            exitGame: mockExitGame,
            startBlocked: false,
            startBlockedMessage: null,
            dismissStartBlocked: mockDismissStartBlocked,
        });
        render(<KkutuMenu practiceType="typing-practice" onStartTypingPractice={mockStartTypingPractice} />);

        fireEvent.click(screen.getByText('나가기'));

        expect(mockExitGame).not.toHaveBeenCalled();
        expect(screen.getByText('타자 연습을 종료하시겠습니까?')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Confirm'));
        expect(mockExitGame).toHaveBeenCalledTimes(1);
    });

    it('keeps an active typing-practice session when exit is cancelled', () => {
        (useGameState as unknown as jest.Mock).mockReturnValue({
            isPlaying: true,
            requestStart: mockRequestStart,
            exitGame: mockExitGame,
            startBlocked: false,
            startBlockedMessage: null,
            dismissStartBlocked: mockDismissStartBlocked,
        });
        render(<KkutuMenu practiceType="typing-practice" onStartTypingPractice={mockStartTypingPractice} />);

        fireEvent.click(screen.getByText('나가기'));
        fireEvent.click(screen.getByText('Cancel'));

        expect(mockExitGame).not.toHaveBeenCalled();
        expect(screen.queryByText('타자 연습을 종료하시겠습니까?')).not.toBeInTheDocument();
    });

    it('should show confirm modal when start is blocked', () => {
        (useGameState as unknown as jest.Mock).mockReturnValue({
            isPlaying: false,
            requestStart: mockRequestStart,
            exitGame: mockExitGame,
            startBlocked: true,
            startBlockedMessage: 'Blocked',
            dismissStartBlocked: mockDismissStartBlocked,
        });
        render(<KkutuMenu practiceType="word-chain" onStartTypingPractice={mockStartTypingPractice} />);
        expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
        expect(screen.getByText('Blocked')).toBeInTheDocument();
        
        fireEvent.click(screen.getByText('Confirm'));
        expect(mockDismissStartBlocked).toHaveBeenCalled();
    });
});

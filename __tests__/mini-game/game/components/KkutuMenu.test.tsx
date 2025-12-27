import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import KkutuMenu from '@/app/mini-game/game/components/KkutuMenu';
import { useGameState } from '@/app/mini-game/game/hooks/useGameState';

jest.mock('@/app/mini-game/game/hooks/useGameState');
jest.mock('@/app/mini-game/game/components/HelpModal', () => () => <div data-testid="help-modal">Help Modal</div>);
jest.mock('@/app/mini-game/game/components/SettingsModal', () => () => <div data-testid="settings-modal">Settings Modal</div>);
jest.mock('@/app/mini-game/game/components/DictionaryModal', () => () => <div data-testid="dict-modal">Dictionary Modal</div>);
jest.mock('@/app/mini-game/game/components/ConfirmModal', () => ({ message, onConfirm }: any) => (
    <div data-testid="confirm-modal">
        {message}
        <button onClick={onConfirm}>Confirm</button>
    </div>
));

describe('KkutuMenu', () => {
    const mockRequestStart = jest.fn();
    const mockExitGame = jest.fn();
    const mockDismissStartBlocked = jest.fn();

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
        render(<KkutuMenu />);
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
        render(<KkutuMenu />);
        expect(screen.queryByText('시작')).not.toBeInTheDocument();
        expect(screen.getByText('나가기')).toBeInTheDocument();
    });

    it('should open help modal', () => {
        render(<KkutuMenu />);
        fireEvent.click(screen.getByText('도움말'));
        expect(screen.getByTestId('help-modal')).toBeInTheDocument();
    });

    it('should open settings modal', () => {
        render(<KkutuMenu />);
        fireEvent.click(screen.getByText('설정'));
        expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    });

    it('should open dictionary modal', () => {
        render(<KkutuMenu />);
        fireEvent.click(screen.getByText('사전'));
        expect(screen.getByTestId('dict-modal')).toBeInTheDocument();
    });

    it('should call requestStart when start button is clicked', () => {
        render(<KkutuMenu />);
        fireEvent.click(screen.getByText('시작'));
        expect(mockRequestStart).toHaveBeenCalled();
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
        render(<KkutuMenu />);
        fireEvent.click(screen.getByText('나가기'));
        expect(mockExitGame).toHaveBeenCalled();
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
        render(<KkutuMenu />);
        expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
        expect(screen.getByText('Blocked')).toBeInTheDocument();
        
        fireEvent.click(screen.getByText('Confirm'));
        expect(mockDismissStartBlocked).toHaveBeenCalled();
    });
});
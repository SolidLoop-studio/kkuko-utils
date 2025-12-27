import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import GameHead from '@/app/mini-game/game/GameBody';
import { useChat } from '@/app/mini-game/game/hooks/useChat';
import { useGameLogic } from '@/app/mini-game/game/hooks/useGameLogic';

jest.mock('@/app/mini-game/game/hooks/useChat');
jest.mock('@/app/mini-game/game/hooks/useGameLogic');
jest.mock('@/app/mini-game/game/components/HistoryHolder', () => () => <div data-testid="history-holder">History</div>);
jest.mock('@/app/mini-game/game/components/GameInput', () => ({ value, onChange, onKeyDown }: any) => (
    <input 
        data-testid="game-input" 
        value={value} 
        onChange={onChange} 
        onKeyDown={onKeyDown} 
    />
));
jest.mock('@/app/mini-game/game/components/GraphBar', () => ({ label }: any) => <div data-testid="graph-bar">{label}</div>);
jest.mock('@/app/mini-game/game/components/GameResultModal', () => () => <div data-testid="game-result-modal">Result</div>);

describe('GameHead', () => {
    const mockHandleChatInputChange = jest.fn();
    const mockSendHint = jest.fn();
    const mockSetChatInput = jest.fn();
    const mockRegisterGameHandleInput = jest.fn();
    const mockSetGameInputVisible = jest.fn();
    const mockHandleInput = jest.fn();
    const mockCloseGameResult = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (useChat as jest.Mock).mockReturnValue({
            chatInput: '',
            handleChatInputChange: mockHandleChatInputChange,
            sendHint: mockSendHint,
            setChatInput: mockSetChatInput,
            registerGameHandleInput: mockRegisterGameHandleInput,
            setGameInputVisible: mockSetGameInputVisible,
        });
        (useGameLogic as jest.Mock).mockReturnValue({
            word: '가방',
            isFail: false,
            chainCount: 5,
            turnTime: 3.5,
            roundTime: 50.0,
            missionChar: '가',
            historyItems: [],
            inputVisible: true,
            turnInstant: false,
            animatingWord: null,
            visibleChars: [],
            pulseOn: false,
            inputRef: { current: null },
            handleInput: mockHandleInput,
            TURN_TIME_LIMIT: 5,
            ROUND_TIME_LIMIT: 60,
            hintVisible: false,
            gameResult: null,
            closeGameResult: mockCloseGameResult,
        });
    });

    it('should render correctly', () => {
        render(<GameHead />);
        expect(screen.getByText('가방')).toBeInTheDocument();
        expect(screen.getByText('가')).toBeInTheDocument(); // Mission char
        expect(screen.getByText('5')).toBeInTheDocument(); // Chain count
        expect(screen.getByText('3.5초')).toBeInTheDocument(); // Turn time
        expect(screen.getByText('50.0초')).toBeInTheDocument(); // Round time
        expect(screen.getByTestId('history-holder')).toBeInTheDocument();
        expect(screen.getByTestId('game-input')).toBeInTheDocument();
    });

    it('should handle input change', () => {
        render(<GameHead />);
        const input = screen.getByTestId('game-input');
        fireEvent.change(input, { target: { value: 'test' } });
        expect(mockHandleChatInputChange).toHaveBeenCalled();
    });

    it('should handle enter key', () => {
        (useChat as jest.Mock).mockReturnValue({
            chatInput: 'word',
            handleChatInputChange: mockHandleChatInputChange,
            sendHint: mockSendHint,
            setChatInput: mockSetChatInput,
            registerGameHandleInput: mockRegisterGameHandleInput,
            setGameInputVisible: mockSetGameInputVisible,
        });
        render(<GameHead />);
        const input = screen.getByTestId('game-input');
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
        expect(mockHandleInput).toHaveBeenCalledWith('word');
    });

    it('should handle hint command', () => {
        (useChat as jest.Mock).mockReturnValue({
            chatInput: '/ㅍ',
            handleChatInputChange: mockHandleChatInputChange,
            sendHint: mockSendHint,
            setChatInput: mockSetChatInput,
            registerGameHandleInput: mockRegisterGameHandleInput,
            setGameInputVisible: mockSetGameInputVisible,
        });
        render(<GameHead />);
        const input = screen.getByTestId('game-input');
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
        expect(mockSendHint).toHaveBeenCalled();
        expect(mockSetChatInput).toHaveBeenCalledWith('');
    });

    it('should show game result modal when gameResult is present', () => {
        (useGameLogic as jest.Mock).mockReturnValue({
            word: '가방',
            isFail: false,
            chainCount: 5,
            turnTime: 3.5,
            roundTime: 50.0,
            missionChar: '가',
            historyItems: [],
            inputVisible: true,
            turnInstant: false,
            animatingWord: null,
            visibleChars: [],
            pulseOn: false,
            inputRef: { current: null },
            handleInput: mockHandleInput,
            TURN_TIME_LIMIT: 5,
            ROUND_TIME_LIMIT: 60,
            hintVisible: false,
            gameResult: [],
            closeGameResult: mockCloseGameResult,
        });
        render(<GameHead />);
        expect(screen.getByTestId('game-result-modal')).toBeInTheDocument();
    });
});
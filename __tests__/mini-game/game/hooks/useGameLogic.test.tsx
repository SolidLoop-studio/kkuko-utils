import { renderHook, act } from '@testing-library/react';
import { useGameLogic } from '@/app/mini-game/game/hooks/useGameLogic';
import { useChat } from '@/app/mini-game/game/hooks/useChat';
import { soundManager } from '@/app/mini-game/game/lib/SoundManager';
import gameManager from '@/app/mini-game/game/lib/GameManager';
import { useGameState } from '@/app/mini-game/game/hooks/useGameState';

jest.mock('@/app/mini-game/game/hooks/useChat');
jest.mock('@/app/mini-game/game/lib/SoundManager');
jest.mock('@/app/mini-game/game/lib/GameManager');
jest.mock('@/app/mini-game/game/hooks/useGameState');

describe('useGameLogic', () => {
    const mockSetChatInput = jest.fn();
    const mockClearMessagesAndShowStartNotice = jest.fn();
    
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        
        (useChat as jest.Mock).mockReturnValue({
            chatInput: '',
            setChatInput: mockSetChatInput,
            clearMessagesAndShowStartNotice: mockClearMessagesAndShowStartNotice,
        });
        
        (useGameState as unknown as jest.Mock).mockImplementation((selector) => {
            const state = {
                pendingStart: false,
                clearPendingStart: jest.fn(),
                blockStart: jest.fn(),
            };
            return selector ? selector(state) : state;
        });

        (gameManager.getSetting as jest.Mock).mockReturnValue({ roundTime: 60000 });
        (gameManager.canGameStart as jest.Mock).mockReturnValue(true);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should initialize correctly', () => {
        const { result } = renderHook(() => useGameLogic());
        expect(result.current.word).toBe("/시작을 입력하면 게임시작!");
        expect(result.current.isGameStarted).toBe(false);
    });

    it('should handle start command', () => {
        const { result } = renderHook(() => useGameLogic());
        
        (gameManager.gameStart as jest.Mock).mockReturnValue({
            startChar: '가',
            missionChar: null,
            turnTime: 5000,
            turnSpeed: 5
        });
        (gameManager.getCurrentState as jest.Mock).mockReturnValue({
            startChar: '가',
            missionChar: null
        });

        act(() => {
            result.current.handleInput('/시작');
        });
        
        expect(mockClearMessagesAndShowStartNotice).toHaveBeenCalled();
        expect(soundManager.playWithEnd).toHaveBeenCalledWith('game_start', expect.any(Function));
        
        // Trigger callback manually
        const call = (soundManager.playWithEnd as jest.Mock).mock.calls.find(c => c[0] === 'game_start');
        if (call) {
            act(() => {
                call[1]();
            });
        }
        
        // Trigger round_start callback
        const call2 = (soundManager.playWithEnd as jest.Mock).mock.calls.find(c => c[0] === 'round_start');
        if (call2) {
            act(() => {
                call2[1]();
            });
        }

        expect(result.current.isGameStarted).toBe(true);
        expect(result.current.word).toBe('가');
    });

    it('should handle valid word submission', () => {
        const { result } = renderHook(() => useGameLogic());
        
        // Start game first
        (gameManager.gameStart as jest.Mock).mockReturnValue({
            startChar: '가',
            missionChar: null,
            turnTime: 5000,
            turnSpeed: 5
        });
        (gameManager.getCurrentState as jest.Mock).mockReturnValue({
            startChar: '가',
            missionChar: null
        });
        
        act(() => {
            result.current.handleInput('/시작');
        });
        
        // Trigger callbacks
        const call = (soundManager.playWithEnd as jest.Mock).mock.calls.find(c => c[0] === 'game_start');
        if (call) act(() => { call[1](); });
        const call2 = (soundManager.playWithEnd as jest.Mock).mock.calls.find(c => c[0] === 'round_start');
        if (call2) act(() => { call2[1](); });

        // Submit word
        (gameManager.submitWord as jest.Mock).mockReturnValue({
            ok: true,
            wordEntry: { theme: ['자유'] },
            nextChar: '나',
            nextMissionChar: null,
            turnSpeed: 5,
            trunTime: 5000
        });
        (gameManager.getCurrentState as jest.Mock).mockReturnValue({
            startChar: '나',
            missionChar: null
        });

        act(() => {
            result.current.handleInput('가방');
        });
        
        expect(gameManager.submitWord).toHaveBeenCalledWith('가방', expect.any(Number));
        expect(result.current.chainCount).toBe(1);
        
        // Animation logic uses setTimeout
        act(() => {
            jest.advanceTimersByTime(5000);
        });
        
        expect(result.current.word).toBe('나');
    });

    it('should handle invalid word submission', () => {
        const { result } = renderHook(() => useGameLogic());
        
        // Start game
        (gameManager.gameStart as jest.Mock).mockReturnValue({
            startChar: '가',
            missionChar: null,
            turnTime: 5000,
            turnSpeed: 5
        });
        (gameManager.getCurrentState as jest.Mock).mockReturnValue({
            startChar: '가',
            missionChar: null
        });
        
        act(() => {
            result.current.handleInput('/시작');
        });
        
        // Trigger callbacks
        const call = (soundManager.playWithEnd as jest.Mock).mock.calls.find(c => c[0] === 'game_start');
        if (call) act(() => { call[1](); });
        const call2 = (soundManager.playWithEnd as jest.Mock).mock.calls.find(c => c[0] === 'round_start');
        if (call2) act(() => { call2[1](); });

        // Submit invalid word
        (gameManager.submitWord as jest.Mock).mockReturnValue({
            ok: false,
            reason: 'Invalid'
        });

        act(() => {
            result.current.handleInput('다람쥐');
        });
        
        expect(result.current.isFail).toBe(true);
        expect(soundManager.play).toHaveBeenCalledWith('fail');
        
        act(() => {
            jest.advanceTimersByTime(2500);
        });
        
        expect(result.current.isFail).toBe(false);
    });
});
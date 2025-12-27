import { renderHook, act } from '@testing-library/react';
import { useChatLog } from '@/app/mini-game/game/hooks/useChatLog';
import { useChat } from '@/app/mini-game/game/hooks/useChat';
import { useGameState } from '@/app/mini-game/game/hooks/useGameState';
import gameManager from '@/app/mini-game/game/lib/GameManager';

jest.mock('@/app/mini-game/game/hooks/useChat');
jest.mock('@/app/mini-game/game/hooks/useGameState');
jest.mock('@/app/mini-game/game/lib/GameManager');
describe('useChatLog', () => {
    const mockSetMessages = jest.fn();
    const mockSetChatInput = jest.fn();
    const mockCallGameInput = jest.fn();
    const mockRegisterSendHint = jest.fn();
    const mockRequestStart = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (useChat as jest.Mock).mockReturnValue({
            messages: [],
            setMessages: mockSetMessages,
            chatInput: '',
            setChatInput: mockSetChatInput,
            callGameInput: mockCallGameInput,
            registerSendHint: mockRegisterSendHint,
            chatRef: { current: null },
        });
        (useGameState as unknown as jest.Mock).mockImplementation((selector) => {
            const state = {
                requestStart: mockRequestStart,
                isPlaying: false,
            };
            return selector ? selector(state) : state;
        });
    });

    it('should handle send message (normal)', () => {
        (useChat as jest.Mock).mockReturnValue({
            messages: [],
            setMessages: mockSetMessages,
            chatInput: 'hello',
            setChatInput: mockSetChatInput,
            callGameInput: mockCallGameInput,
            registerSendHint: mockRegisterSendHint,
            chatRef: { current: null },
        });

        const { result } = renderHook(() => useChatLog());
        
        act(() => {
            result.current.handleSendMessage();
        });
        
        expect(mockSetMessages).toHaveBeenCalled();
        expect(mockSetChatInput).toHaveBeenCalledWith('');
    });

    it('should handle start command when not playing', () => {
        (useChat as jest.Mock).mockReturnValue({
            messages: [],
            setMessages: mockSetMessages,
            chatInput: '/시작',
            setChatInput: mockSetChatInput,
            callGameInput: mockCallGameInput,
            registerSendHint: mockRegisterSendHint,
            chatRef: { current: null },
        });

        const { result } = renderHook(() => useChatLog());
        
        act(() => {
            result.current.handleSendMessage();
        });
        
        expect(mockRequestStart).toHaveBeenCalled();
        expect(mockSetMessages).toHaveBeenCalled(); // Notice message
    });

    it('should handle start command when playing', () => {
        (useChat as jest.Mock).mockReturnValue({
            messages: [],
            setMessages: mockSetMessages,
            chatInput: '/시작',
            setChatInput: mockSetChatInput,
            callGameInput: mockCallGameInput,
            registerSendHint: mockRegisterSendHint,
            chatRef: { current: null },
        });
        (useGameState as unknown as jest.Mock).mockImplementation((selector) => {
            const state = {
                requestStart: mockRequestStart,
                isPlaying: true,
            };
            return selector ? selector(state) : state;
        });

        const { result } = renderHook(() => useChatLog());
        
        act(() => {
            result.current.handleSendMessage();
        });
        
        expect(mockCallGameInput).toHaveBeenCalledWith('/시작');
    });

    it('should handle gg command', () => {
        (useChat as jest.Mock).mockReturnValue({
            messages: [],
            setMessages: mockSetMessages,
            chatInput: '/gg',
            setChatInput: mockSetChatInput,
            callGameInput: mockCallGameInput,
            registerSendHint: mockRegisterSendHint,
            chatRef: { current: null },
        });

        const { result } = renderHook(() => useChatLog());
        
        act(() => {
            result.current.handleSendMessage();
        });
        
        expect(mockCallGameInput).toHaveBeenCalledWith('/gg');
        expect(mockSetMessages).toHaveBeenCalled(); // Notice message
    });

    it('should handle hint command', () => {
        (useChat as jest.Mock).mockReturnValue({
            messages: [],
            setMessages: mockSetMessages,
            chatInput: '/ㅍ',
            setChatInput: mockSetChatInput,
            callGameInput: mockCallGameInput,
            registerSendHint: mockRegisterSendHint,
            chatRef: { current: null },
        });
        (gameManager.getHintWord as jest.Mock).mockReturnValue('힌트단어');

        const { result } = renderHook(() => useChatLog());
        
        act(() => {
            result.current.handleSendMessage();
        });
        
        expect(mockSetMessages).toHaveBeenCalled();
        expect(mockSetChatInput).toHaveBeenCalledWith('');
    });
});
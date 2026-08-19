import { renderHook, act } from '@testing-library/react';
import { useChatLog } from '@/src/app/mini-game/game/hooks/useChatLog';
import { useChat } from '@/src/app/mini-game/game/hooks/useChat';
import { useGameState } from '@/src/app/mini-game/game/hooks/useGameState';
import gameManager from '@/src/app/mini-game/game/lib/GameManager';

jest.mock('@/app/mini-game/game/hooks/useChat');
jest.mock('@/app/mini-game/game/hooks/useGameState');
jest.mock('@/app/mini-game/game/lib/GameManager');
describe('useChatLog', () => {
    const mockSetMessages = jest.fn();
    const mockSetChatInput = jest.fn();
    const mockCallGameInput = jest.fn();
    const mockRegisterSendHint = jest.fn();
    const mockRequestStart = jest.fn();
    const mockStartTypingPractice = jest.fn();
    const mockRestartTypingPractice = jest.fn();
    const mockExitTypingPractice = jest.fn();

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

    it('starts typing practice from chat without using word-chain start', () => {
        (useChat as jest.Mock).mockReturnValue({
            messages: [],
            setMessages: mockSetMessages,
            chatInput: '/시작',
            setChatInput: mockSetChatInput,
            callGameInput: mockCallGameInput,
            registerSendHint: mockRegisterSendHint,
            chatRef: { current: null },
        });

        const { result } = renderHook(() => useChatLog({
            practiceType: 'typing-practice',
            onStartTypingPractice: mockStartTypingPractice,
            onRestartTypingPractice: mockRestartTypingPractice,
            onExitTypingPractice: mockExitTypingPractice,
        }));

        act(() => {
            result.current.handleSendMessage();
        });

        expect(mockStartTypingPractice).toHaveBeenCalledTimes(1);
        expect(mockRequestStart).not.toHaveBeenCalled();
        expect(mockCallGameInput).not.toHaveBeenCalled();
    });

    it('restarts active typing practice from chat without forwarding to word-chain input', () => {
        (useChat as jest.Mock).mockReturnValue({
            messages: [],
            setMessages: mockSetMessages,
            chatInput: '/r',
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

        const { result } = renderHook(() => useChatLog({
            practiceType: 'typing-practice',
            onStartTypingPractice: mockStartTypingPractice,
            onRestartTypingPractice: mockRestartTypingPractice,
            onExitTypingPractice: mockExitTypingPractice,
        }));

        act(() => {
            result.current.handleSendMessage();
        });

        expect(mockRestartTypingPractice).toHaveBeenCalledTimes(1);
        expect(mockCallGameInput).not.toHaveBeenCalled();
    });

    it('exits active typing practice from chat without forwarding to word-chain input', () => {
        (useChat as jest.Mock).mockReturnValue({
            messages: [],
            setMessages: mockSetMessages,
            chatInput: '/gg',
            setChatInput: mockSetChatInput,
            callGameInput: mockCallGameInput,
            registerSendHint: mockRegisterSendHint,
            chatRef: { current: null },
        });

        const { result } = renderHook(() => useChatLog({
            practiceType: 'typing-practice',
            onStartTypingPractice: mockStartTypingPractice,
            onRestartTypingPractice: mockRestartTypingPractice,
            onExitTypingPractice: mockExitTypingPractice,
        }));

        act(() => {
            result.current.handleSendMessage();
        });

        expect(mockExitTypingPractice).toHaveBeenCalledTimes(1);
        expect(mockCallGameInput).not.toHaveBeenCalled();
    });

    it.each(['/ㅍ', '/v'])('blocks %s hint commands in typing practice without reading word-chain hints', (command) => {
        (useChat as jest.Mock).mockReturnValue({
            messages: [],
            setMessages: mockSetMessages,
            chatInput: command,
            setChatInput: mockSetChatInput,
            callGameInput: mockCallGameInput,
            registerSendHint: mockRegisterSendHint,
            chatRef: { current: null },
        });

        const { result } = renderHook(() => useChatLog({ practiceType: 'typing-practice' }));

        act(() => {
            result.current.handleSendMessage();
        });

        expect(gameManager.getHintWord).not.toHaveBeenCalled();
        expect(mockSetMessages).toHaveBeenCalledWith(expect.any(Function));
        const appendMessage = mockSetMessages.mock.calls[0][0];
        expect(appendMessage([])).toEqual([
            expect.objectContaining({
                username: '알림',
                message: '타자 연습에서는 힌트를 사용할 수 없습니다.',
                isNotice: true,
            }),
        ]);
        expect(mockSetChatInput).toHaveBeenCalledWith('');
    });

    it('blocks returned typing-practice sendHint without reading word-chain hints', () => {
        const { result } = renderHook(() => useChatLog({ practiceType: 'typing-practice' }));

        act(() => {
            result.current.sendHint();
        });

        expect(gameManager.getHintWord).not.toHaveBeenCalled();
        expect(mockSetMessages).toHaveBeenCalledWith(expect.any(Function));
        expect(mockSetChatInput).toHaveBeenCalledWith('');
    });

    it('registers a mode-aware typing-practice hint callback', () => {
        renderHook(() => useChatLog({ practiceType: 'typing-practice' }));
        const registeredHint = mockRegisterSendHint.mock.calls[0][0];

        act(() => {
            registeredHint();
        });

        expect(gameManager.getHintWord).not.toHaveBeenCalled();
        expect(mockSetMessages).toHaveBeenCalledWith(expect.any(Function));
        expect(mockSetChatInput).toHaveBeenCalledWith('');
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

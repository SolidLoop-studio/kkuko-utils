import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { ChatProvider, useChat } from '@/app/mini-game/game/hooks/useChat';

describe('useChat', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ChatProvider>{children}</ChatProvider>
    );

    it('should provide initial state', () => {
        const { result } = renderHook(() => useChat(), { wrapper });
        expect(result.current.chatInput).toBe('');
        expect(result.current.messages.length).toBeGreaterThan(0); // Initial notice
        expect(result.current.gameInputVisible).toBe(false);
    });

    it('should update chat input', () => {
        const { result } = renderHook(() => useChat(), { wrapper });
        act(() => {
            result.current.setChatInput('hello');
        });
        expect(result.current.chatInput).toBe('hello');
    });

    it('should handle chat input change event', () => {
        const { result } = renderHook(() => useChat(), { wrapper });
        const event = { target: { value: 'world' } } as React.ChangeEvent<HTMLInputElement>;
        act(() => {
            result.current.handleChatInputChange(event);
        });
        expect(result.current.chatInput).toBe('world');
    });

    it('should register and call game input handler', () => {
        const { result } = renderHook(() => useChat(), { wrapper });
        const handler = jest.fn();
        
        act(() => {
            result.current.registerGameHandleInput(handler);
        });
        
        act(() => {
            result.current.callGameInput('test');
        });
        
        expect(handler).toHaveBeenCalledWith('test');
    });

    it('should register and call send hint', () => {
        const { result } = renderHook(() => useChat(), { wrapper });
        const handler = jest.fn();
        
        act(() => {
            result.current.registerSendHint(handler);
        });
        
        act(() => {
            result.current.sendHint();
        });
        
        expect(handler).toHaveBeenCalled();
    });

    it('should clear messages and show start notice', () => {
        const { result } = renderHook(() => useChat(), { wrapper });
        act(() => {
            result.current.setMessages([]);
            result.current.setChatInput('some input');
        });
        
        act(() => {
            result.current.clearMessagesAndShowStartNotice();
        });
        
        expect(result.current.messages.length).toBe(1);
        expect(result.current.messages[0].message).toBe('게임을 시작합니다!');
        expect(result.current.chatInput).toBe('');
    });
});
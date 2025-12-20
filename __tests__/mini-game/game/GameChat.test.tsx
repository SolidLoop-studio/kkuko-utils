import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import KkutuChat from '@/app/mini-game/game/GameChat';
import { useChat } from '@/app/mini-game/game/hooks/useChat';
import { useChatLog } from '@/app/mini-game/game/hooks/useChatLog';

jest.mock('@/app/mini-game/game/hooks/useChat');
jest.mock('@/app/mini-game/game/hooks/useChatLog');

describe('KkutuChat', () => {
    const mockHandleChatInputChange = jest.fn();
    const mockCallGameInput = jest.fn();
    const mockHandleSendMessage = jest.fn();
    const mockSendHint = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (useChat as jest.Mock).mockReturnValue({
            chatInput: '',
            handleChatInputChange: mockHandleChatInputChange,
            callGameInput: mockCallGameInput,
            gameInputVisible: false,
        });
        (useChatLog as jest.Mock).mockReturnValue({
            messages: [
                { id: 1, timestamp: '12:00', username: 'User1', message: 'Hello', isNotice: false },
                { id: 2, timestamp: '12:01', username: 'System', message: 'Welcome', isNotice: true },
            ],
            chatRef: { current: null },
            handleSendMessage: mockHandleSendMessage,
            sendHint: mockSendHint,
        });
    });

    it('should render correctly', () => {
        render(<KkutuChat />);
        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getByText('Welcome')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('메시지를 입력하세요...')).toBeInTheDocument();
    });

    it('should handle input change', () => {
        render(<KkutuChat />);
        const input = screen.getByPlaceholderText('메시지를 입력하세요...');
        fireEvent.change(input, { target: { value: 'test' } });
        expect(mockHandleChatInputChange).toHaveBeenCalled();
    });

    it('should handle send message on button click', () => {
        render(<KkutuChat />);
        const button = screen.getByRole('button'); // Send button
        fireEvent.click(button);
        expect(mockHandleSendMessage).toHaveBeenCalled();
    });

    it('should handle send message on Enter key when game input is not visible', () => {
        render(<KkutuChat />);
        const input = screen.getByPlaceholderText('메시지를 입력하세요...');
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
        expect(mockHandleSendMessage).toHaveBeenCalled();
    });

    it('should call game input on Enter key when game input is visible', () => {
        (useChat as jest.Mock).mockReturnValue({
            chatInput: 'word',
            handleChatInputChange: mockHandleChatInputChange,
            callGameInput: mockCallGameInput,
            gameInputVisible: true,
        });
        render(<KkutuChat />);
        const input = screen.getByPlaceholderText('메시지를 입력하세요...');
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
        expect(mockCallGameInput).toHaveBeenCalledWith('word');
        expect(mockHandleSendMessage).not.toHaveBeenCalled();
    });

    it('should send hint on Enter key when input is /ㅍ', () => {
        (useChat as jest.Mock).mockReturnValue({
            chatInput: '/ㅍ',
            handleChatInputChange: mockHandleChatInputChange,
            callGameInput: mockCallGameInput,
            gameInputVisible: true,
        });
        render(<KkutuChat />);
        const input = screen.getByPlaceholderText('메시지를 입력하세요...');
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
        expect(mockSendHint).toHaveBeenCalled();
        expect(mockCallGameInput).not.toHaveBeenCalled();
    });
});
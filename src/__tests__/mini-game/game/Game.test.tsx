import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import Game from '@/src/app/mini-game/game/Game';
import { soundManager } from '@/src/app/mini-game/game/lib/SoundManager';
import gameReducer from '@/src/app/mini-game/game/store/gameSlice';
import gameManager from '@/src/app/mini-game/game/lib/GameManager';

jest.mock('@/app/mini-game/game/lib/SoundManager');
jest.mock('@/app/mini-game/game/lib/wordDB', () => ({
    getAllWords: jest.fn().mockResolvedValue([
        { word: '가방', theme: '자유' },
        { word: '나무', theme: '자유' },
    ]),
    hasWords: jest.fn().mockResolvedValue(true),
}));
jest.mock('@/app/mini-game/game/hooks/useChat', () => ({
    ChatProvider: ({ children }: any) => <div data-testid="chat-provider">{children}</div>
}));
jest.mock('@/app/mini-game/game/GameBox', () => ({ children }: any) => <div data-testid="game-box">{children}</div>);
jest.mock('@/app/mini-game/game/GameBody', () => () => <div data-testid="game-body">Head</div>);
jest.mock('@/app/mini-game/game/GameSetup', () => ({
    __esModule: true,
    ...jest.requireActual('@/app/mini-game/game/GameSetup'),
    default: () => <div data-testid="game-setup">Setup</div>,
}));
jest.mock('@/app/mini-game/game/GameChat', () => () => <div data-testid="game-chat">Chat</div>);
jest.mock('@/app/mini-game/game/components/HelpModal', () => () => null);
jest.mock('@/app/mini-game/game/components/SettingsModal', () => () => null);
jest.mock('@/app/mini-game/game/components/DictionaryModal', () => () => null);

const renderGame = () => {
    const store = configureStore({ reducer: { game: gameReducer } });
    return render(
        <Provider store={store}>
            <Game />
        </Provider>
    );
};

describe('Game', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        const { hasWords } = jest.requireMock('@/app/mini-game/game/lib/wordDB');
        hasWords.mockResolvedValue(true);
    });

    it('should render setup when not playing', () => {
        renderGame();
        
        expect(soundManager.load).toHaveBeenCalled();
        expect(screen.getByRole('button', { name: /시작/ })).toBeInTheDocument();
        expect(screen.getByTestId('game-setup')).toBeInTheDocument();
        expect(screen.getByTestId('game-chat')).toBeInTheDocument();
        expect(screen.queryByTestId('game-box')).not.toBeInTheDocument();
    });

    it('renders typing practice body when typing practice is selected and start is requested', async () => {
        localStorage.setItem('kkutu_practice_type', 'typing-practice');
        localStorage.setItem('kkutu_typing_practice_setting', JSON.stringify({
            sessionMode: 'fixed-count',
            durationSeconds: 60,
            wordCount: 10,
            language: 'all',
            order: 'sorted',
            minLength: 2,
        }));

        renderGame();

        await userEvent.click(screen.getByRole('button', { name: /시작/ }));

        expect(await screen.findByPlaceholderText('표시된 단어를 정확히 입력하세요.')).toBeInTheDocument();
    });

    it('blocks typing practice start when no words are uploaded', async () => {
        const { hasWords } = jest.requireMock('@/app/mini-game/game/lib/wordDB');
        hasWords.mockResolvedValue(false);
        localStorage.setItem('kkutu_practice_type', 'typing-practice');

        renderGame();

        await userEvent.click(screen.getByRole('button', { name: /시작/ }));

        expect(await screen.findByText('단어를 먼저 업로드해주세요.')).toBeInTheDocument();
    });

    it('blocks typing practice start when checking words fails without using the word-chain start path', async () => {
        const { hasWords } = jest.requireMock('@/app/mini-game/game/lib/wordDB');
        const error = new Error('word storage unavailable');
        hasWords.mockRejectedValue(error);
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        const canGameStart = jest.spyOn(gameManager, 'canGameStart');
        localStorage.setItem('kkutu_practice_type', 'typing-practice');

        renderGame();

        await userEvent.click(screen.getByRole('button', { name: /시작/ }));

        expect(await screen.findByText('단어를 확인할 수 없습니다. 다시 시도해주세요.')).toBeInTheDocument();
        expect(canGameStart).not.toHaveBeenCalled();
        expect(consoleError).toHaveBeenCalledWith(error);
        consoleError.mockRestore();
    });
});

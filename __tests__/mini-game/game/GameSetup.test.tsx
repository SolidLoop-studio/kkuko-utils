import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import GameSetup from '@/app/mini-game/game/GameSetup';
import * as wordDB from '@/app/mini-game/game/lib/wordDB';
import gameManager from '@/app/mini-game/game/lib/GameManager';

jest.mock('@/app/mini-game/game/lib/wordDB');
jest.mock('@/app/mini-game/game/lib/GameManager');
jest.mock('@/app/mini-game/game/lib/SoundManager');
jest.mock('@/app/mini-game/game/components/WordManagerModal', () => ({ onClose }: any) => (
    <div data-testid="word-manager-modal"><button onClick={onClose}>Close</button></div>
));
jest.mock('@/app/mini-game/game/components/ConfirmModal', () => ({ onConfirm, onCancel }: any) => (
    <div data-testid="confirm-modal">
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
    </div>
));
jest.mock('@/app/mini-game/game/components/StartCharModal', () => ({ onClose, onSave }: any) => (
    <div data-testid="start-char-modal">
        <button onClick={() => onSave('가나다')}>Save</button>
        <button onClick={onClose}>Close</button>
    </div>
));

describe('GameSetup', () => {
    const mockUpdateSetting = jest.fn();
    const mockLoadWordDB = jest.fn();
    const mockGameStart = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock localStorage
        const localStorageMock = (function() {
            let store: any = {};
            return {
                getItem: jest.fn((key) => store[key] || null),
                setItem: jest.fn((key, value) => {
                    store[key] = value.toString();
                }),
                clear: jest.fn(() => {
                    store = {};
                }),
                removeItem: jest.fn((key) => {
                    delete store[key];
                })
            };
        })();
        Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

        // Mock GameManager
        (gameManager.getSetting as jest.Mock).mockReturnValue({
            roundTime: 60000,
            notAgainSameChar: false,
            lang: 'ko',
            mode: 'normal',
            hintMode: 'auto',
            wantStartChar: new Set(['가']),
        });
        gameManager.updateSetting = mockUpdateSetting;
        gameManager.loadWordDB = mockLoadWordDB;
        gameManager.gameStart = mockGameStart;
        gameManager.clearDB = jest.fn();

        // Mock wordDB
        (wordDB.hasWords as jest.Mock).mockResolvedValue(false);
        (wordDB.getAllWords as jest.Mock).mockResolvedValue([]);
        (wordDB.loadWordsFromFile as jest.Mock).mockResolvedValue(100);
        (wordDB.clearAllWords as jest.Mock).mockResolvedValue(undefined);
    });

    it('should render correctly', async () => {
        await act(async () => {
            render(<GameSetup />);
        });
        expect(screen.getByText(/게임 설정/i)).toBeInTheDocument();
        expect(screen.getByText(/단어 데이터베이스 설정/i)).toBeInTheDocument();
    });

    it('should load existing words on mount', async () => {
        (wordDB.hasWords as jest.Mock).mockResolvedValue(true);
        (wordDB.getAllWords as jest.Mock).mockResolvedValue([{ word: '사과', theme: 'fruit' }]);
        
        await act(async () => {
            render(<GameSetup />);
        });
        
        await waitFor(() => {
            expect(wordDB.hasWords).toHaveBeenCalled();
            expect(wordDB.getAllWords).toHaveBeenCalled();
            expect(mockLoadWordDB).toHaveBeenCalled();
            expect(screen.getByText(/저장된 단어가 1개 있습니다/i)).toBeInTheDocument();
        });
    });

    it('should handle file upload', async () => {
        await act(async () => {
            render(<GameSetup />);
        });
        
        const file = new File(['test'], 'test.txt', { type: 'text/plain' });
        const input = screen.getByLabelText(/단어 파일 업로드/i);
        
        await act(async () => {
            fireEvent.change(input, { target: { files: [file] } });
        });
        
        expect(screen.getByText(/선택된 파일: test.txt/i)).toBeInTheDocument();
        
        const uploadButton = screen.getByText('단어 불러오기');
        await act(async () => {
            fireEvent.click(uploadButton);
        });
        
        await waitFor(() => {
            expect(wordDB.loadWordsFromFile).toHaveBeenCalledWith(file);
            expect(screen.getByText(/100개의 단어를 성공적으로 불러왔습니다/i)).toBeInTheDocument();
        });
    });

    it('should handle setting changes', async () => {
        await act(async () => {
            render(<GameSetup />);
        });
        
        // Find select by display value since label is not associated
        const roundTimeSelect = screen.getByDisplayValue('60초');
        fireEvent.change(roundTimeSelect, { target: { value: '30' } });
        
        expect(mockUpdateSetting).toHaveBeenCalledWith(expect.objectContaining({
            roundTime: 30000
        }));
    });

    it('should open and close word manager modal', async () => {
        await act(async () => {
            render(<GameSetup />);
        });
        
        fireEvent.click(screen.getByText(/단어 목록 조회/i));
        const modal = screen.getByTestId('word-manager-modal');
        expect(modal).toBeInTheDocument();
        
        fireEvent.click(within(modal).getByText('Close'));
        expect(screen.queryByTestId('word-manager-modal')).not.toBeInTheDocument();
    });

    it('should handle clear words', async () => {
        (wordDB.hasWords as jest.Mock).mockResolvedValue(true);
        (wordDB.getAllWords as jest.Mock).mockResolvedValue([{ word: '사과', theme: 'fruit' }]);
        
        await act(async () => {
            render(<GameSetup />);
        });
        
        await waitFor(() => {
            expect(screen.getByText('모든 단어 삭제')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('모든 단어 삭제'));
        expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
        
        await act(async () => {
            fireEvent.click(screen.getByText('Confirm'));
        });
        
        expect(wordDB.clearAllWords).toHaveBeenCalled();
        expect(gameManager.clearDB).toHaveBeenCalled();
        expect(screen.getByText('모든 단어가 삭제되었습니다.')).toBeInTheDocument();
    });

    it('should handle start char modal', async () => {
        await act(async () => {
            render(<GameSetup />);
        });
        
        fireEvent.click(screen.getByRole('button', { name: '제시어 설정' }));
        expect(screen.getByTestId('start-char-modal')).toBeInTheDocument();
        
        await act(async () => {
            fireEvent.click(screen.getByText('Save'));
        });
        
        expect(mockUpdateSetting).toHaveBeenCalledWith(expect.objectContaining({
            wantStartChar: new Set(['가', '나', '다'])
        }));
    });
});
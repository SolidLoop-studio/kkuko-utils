import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import WordManagerModal from '@/app/mini-game/game/components/WordManagerModal';
import * as wordDB from '@/app/mini-game/game/lib/wordDB';
import gameManager from '@/app/mini-game/game/lib/GameManager';

jest.mock('@/app/mini-game/game/lib/wordDB');
jest.mock('@/app/mini-game/game/lib/GameManager');
jest.mock('@/app/mini-game/game/components/ConfirmModal', () => ({ message, onConfirm, onCancel }: any) => (
    <div data-testid="confirm-modal">
        {message}
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
    </div>
));

// Mock useVirtualizer
jest.mock('@tanstack/react-virtual', () => ({
    useVirtualizer: ({ count, getScrollElement }: any) => ({
        getVirtualItems: () => Array.from({ length: count }).map((_, i) => ({
            index: i,
            start: i * 56,
            size: 56,
            measureElement: jest.fn(),
        })),
        getTotalSize: () => count * 56,
    }),
}));

describe('WordManagerModal', () => {
    const mockWords = [
        { word: '가방', theme: '자유' },
        { word: '나비', theme: '자유' },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        (wordDB.getAllWords as jest.Mock).mockResolvedValue(mockWords);
        (wordDB.searchWordsByPrefix as jest.Mock).mockResolvedValue([mockWords[0]]);
    });

    it('should render and load words', async () => {
        await act(async () => {
            render(<WordManagerModal onClose={() => {}} />);
        });
        
        expect(screen.getByText('단어 목록 관리')).toBeInTheDocument();
        expect(wordDB.getAllWords).toHaveBeenCalled();
        expect(screen.getByText('가방')).toBeInTheDocument();
        expect(screen.getByText('나비')).toBeInTheDocument();
    });

    it('should search words', async () => {
        jest.useFakeTimers();
        await act(async () => {
            render(<WordManagerModal onClose={() => {}} />);
        });
        
        const searchInput = screen.getByPlaceholderText('예: 끝말, 게임...');
        fireEvent.change(searchInput, { target: { value: '가' } });
        
        act(() => {
            jest.advanceTimersByTime(300);
        });
        
        await waitFor(() => {
            expect(wordDB.searchWordsByPrefix).toHaveBeenCalledWith('가');
        });
        
        jest.useRealTimers();
    });

    it('should add a word', async () => {
        await act(async () => {
            render(<WordManagerModal onClose={() => {}} />);
        });
        
        const addInput = screen.getByPlaceholderText('새 단어 추가...');
        fireEvent.change(addInput, { target: { value: '다람쥐' } });
        
        await act(async () => {
            fireEvent.click(screen.getByText('추가'));
        });
        
        expect(wordDB.addWord).toHaveBeenCalledWith('다람쥐');
        expect(gameManager.addWordToDB).toHaveBeenCalledWith('다람쥐', ['자유']);
        expect(wordDB.getAllWords).toHaveBeenCalledTimes(2); // Initial + after add
    });

    it('should delete a word', async () => {
        await act(async () => {
            render(<WordManagerModal onClose={() => {}} />);
        });
        
        // Find delete button for '가방'
        const deleteBtns = screen.getAllByText('삭제');
        fireEvent.click(deleteBtns[0]); // First one
        
        expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
        
        await act(async () => {
            fireEvent.click(screen.getByText('Confirm'));
        });
        
        expect(wordDB.deleteWord).toHaveBeenCalledWith('가방');
        expect(gameManager.deleteWordFromDB).toHaveBeenCalledWith('가방');
    });

    it('should edit a word', async () => {
        await act(async () => {
            render(<WordManagerModal onClose={() => {}} />);
        });
        
        const editBtns = screen.getAllByText('수정');
        fireEvent.click(editBtns[0]); // '가방'
        
        const editInput = screen.getByDisplayValue('가방');
        fireEvent.change(editInput, { target: { value: '가방끈' } });
        
        await act(async () => {
            fireEvent.click(screen.getByText('저장'));
        });
        
        expect(wordDB.updateWord).toHaveBeenCalledWith('가방', '가방끈');
        expect(gameManager.editWordInDB).toHaveBeenCalledWith('가방', '가방끈');
    });
});
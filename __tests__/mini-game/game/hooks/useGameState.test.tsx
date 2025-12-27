import { renderHook, act } from '@testing-library/react';
import { useGameState } from '@/app/mini-game/game/hooks/useGameState';
import gameManager from '@/app/mini-game/game/lib/GameManager';
import * as hooks from '@/app/mini-game/game/store/hooks';
import { setPlaying, setPendingStart, setStartBlocked, resetGame } from '@/app/mini-game/game/store/gameSlice';

jest.mock('@/app/mini-game/game/lib/GameManager', () => ({
    __esModule: true,
    default: {
        canGameStart: jest.fn(),
    },
}));

jest.mock('@/app/mini-game/game/store/hooks');

describe('useGameState', () => {
    const mockDispatch = jest.fn();
    const mockSelector = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (hooks.useAppDispatch as jest.Mock).mockReturnValue(mockDispatch);
        (hooks.useAppSelector as jest.Mock).mockImplementation((selector) => mockSelector(selector));
        
        // Default selector behavior
        mockSelector.mockImplementation((selector) => selector({
            game: {
                isPlaying: false,
                pendingStart: false,
                startBlocked: false,
                startBlockedMessage: null,
            }
        }));
    });

    it('should return current state', () => {
        const { result } = renderHook(() => useGameState());
        
        expect(result.current.isPlaying).toBe(false);
        expect(result.current.pendingStart).toBe(false);
        expect(result.current.startBlocked).toBe(false);
        expect(result.current.startBlockedMessage).toBeNull();
    });

    it('should request start successfully', () => {
        (gameManager.canGameStart as jest.Mock).mockReturnValue(true);
        
        const { result } = renderHook(() => useGameState());
        
        act(() => {
            result.current.requestStart();
        });
        
        expect(mockDispatch).toHaveBeenCalledWith(setPlaying(true));
        expect(mockDispatch).toHaveBeenCalledWith(setPendingStart(true));
    });

    it('should block start if gameManager says no', () => {
        (gameManager.canGameStart as jest.Mock).mockReturnValue(false);
        
        const { result } = renderHook(() => useGameState());
        
        act(() => {
            result.current.requestStart();
        });
        
        expect(mockDispatch).toHaveBeenCalledWith(setStartBlocked({ blocked: true, message: '게임을 시작할 수 없습니다.' }));
    });

    it('should clear pending start', () => {
        const { result } = renderHook(() => useGameState());
        
        act(() => {
            result.current.clearPendingStart();
        });
        
        expect(mockDispatch).toHaveBeenCalledWith(setPendingStart(false));
    });

    it('should exit game', () => {
        const { result } = renderHook(() => useGameState());
        
        act(() => {
            result.current.exitGame();
        });
        
        expect(mockDispatch).toHaveBeenCalledWith(resetGame());
    });

    it('should dismiss start blocked', () => {
        const { result } = renderHook(() => useGameState());
        
        act(() => {
            result.current.dismissStartBlocked();
        });
        
        expect(mockDispatch).toHaveBeenCalledWith(setStartBlocked({ blocked: false, message: null }));
    });

    it('should block start with message', () => {
        const { result } = renderHook(() => useGameState());
        
        act(() => {
            result.current.blockStart('Custom message');
        });
        
        expect(mockDispatch).toHaveBeenCalledWith(setStartBlocked({ blocked: true, message: 'Custom message' }));
    });
});
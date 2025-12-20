import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setPlaying, setPendingStart, setStartBlocked, resetGame } from '../store/gameSlice';
import gameManager from '../lib/GameManager';

/**
 * 게임 상태를 관리하는 커스텀 훅 (Redux Wrapper)
 * 기존 Zustand 인터페이스를 최대한 유지하여 마이그레이션 용이성 확보
 */
export const useGameState = () => {
    const dispatch = useAppDispatch();
    const { isPlaying, pendingStart, startBlocked, startBlockedMessage } = useAppSelector((state) => state.game);

    const requestStart = () => {
        try {
            if (gameManager.canGameStart()) {
                dispatch(setPlaying(true));
                dispatch(setPendingStart(true));
            } else {
                dispatch(setStartBlocked({ blocked: true, message: '게임을 시작할 수 없습니다.' }));
            }
        } catch (e) {
            dispatch(setStartBlocked({ blocked: true, message: '게임을 시작할 수 없습니다.' }));
        }
    };

    const clearPendingStart = () => dispatch(setPendingStart(false));
    const exitGame = () => dispatch(resetGame());
    const dismissStartBlocked = () => dispatch(setStartBlocked({ blocked: false, message: null }));
    const blockStart = (message: string) => dispatch(setStartBlocked({ blocked: true, message }));

    return {
        isPlaying,
        pendingStart,
        startBlocked,
        startBlockedMessage,
        requestStart,
        clearPendingStart,
        exitGame,
        dismissStartBlocked,
        blockStart,
    };
};
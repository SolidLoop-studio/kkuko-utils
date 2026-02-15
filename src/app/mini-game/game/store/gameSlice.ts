import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface GameState {
    isPlaying: boolean;
    pendingStart: boolean;
    startBlocked: boolean;
    startBlockedMessage: string | null;
}

const initialState: GameState = {
    isPlaying: false,
    pendingStart: false,
    startBlocked: false,
    startBlockedMessage: null,
};

export const gameSlice = createSlice({
    name: 'game',
    initialState,
    reducers: {
        setPlaying: (state, action: PayloadAction<boolean>) => {
            state.isPlaying = action.payload;
        },
        setPendingStart: (state, action: PayloadAction<boolean>) => {
            state.pendingStart = action.payload;
        },
        setStartBlocked: (state, action: PayloadAction<{ blocked: boolean; message: string | null }>) => {
            state.startBlocked = action.payload.blocked;
            state.startBlockedMessage = action.payload.message;
        },
        resetGame: (state) => {
            state.isPlaying = false;
            state.pendingStart = false;
        },
    },
});

export const { setPlaying, setPendingStart, setStartBlocked, resetGame } = gameSlice.actions;
export default gameSlice.reducer;
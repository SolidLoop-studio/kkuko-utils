import { configureStore } from '@reduxjs/toolkit';
import { userReducer, loadingReducer, themeReducer } from './slice';

export const store = configureStore({
    reducer:{
        user: userReducer,
        loading: loadingReducer,
        theme: themeReducer,
    }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
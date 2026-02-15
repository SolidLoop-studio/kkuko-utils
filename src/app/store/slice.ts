import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { LoadingState } from "@/src/app/types/type";

type Theme = 'light' | 'dark'

const getInitialTheme = (): Theme => {
    if (typeof window === 'undefined') return 'light'
    const stored = localStorage.getItem('theme') as Theme | null
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return stored || (prefersDark ? 'dark' : 'light')
}

interface RootState{
    user:{
        username:string | undefined ;
        uuid: string | undefined;
        role: "guest" | "r1" | "r2" | "r3" | "r4" | "admin"
    },
    loading: LoadingState,
    themeState: {
        theme: Theme
    }
}

const initialState: RootState = {
    user:{
        username: undefined,
        uuid: undefined,
        role: "guest",
    },
    loading:{
        isLoading: true,
        progress: 0,
        currentTask: '초기화 중...',
    },
    themeState:{
        theme: getInitialTheme()
    }
};

const UserSlice = createSlice({
    name: "user",
    initialState: initialState.user,
    reducers:{
        setInfo: (state,action:PayloadAction<{username?:string, role: "guest" | "r1" | "r2" | "r3" | "r4" | "admin", uuid?: string}>) => {
            state.username = action.payload.username;
            state.role = action.payload.role;
            state.uuid = action.payload.uuid;
        }
    }
});

const LoadingSlice = createSlice({
    name: 'loading',
    initialState: initialState.loading,
    reducers:{
        updateLoadingState: (
            state,
            action: PayloadAction<{ progress: number; task: string }>
          ) => {
            state.progress = action.payload.progress;
            state.currentTask = action.payload.task;
            state.isLoading = action.payload.progress < 100;
          },
          resetLoadingState: () => initialState.loading,
    }
})

const themeSlice = createSlice({
    name: 'theme',
    initialState: initialState.themeState,
    reducers:{
        setTheme(state, action: PayloadAction<Theme>){
            state.theme = action.payload;
            if (typeof window !== 'undefined'){
                localStorage.setItem('theme', action.payload)
                document.documentElement.classList.toggle('dark', action.payload === 'dark')
            }
        }
    }
})


export const userAction = UserSlice.actions;
export const { updateLoadingState, resetLoadingState } = LoadingSlice.actions;
export const { setTheme } = themeSlice.actions

export const userReducer = UserSlice.reducer;
export const loadingReducer = LoadingSlice.reducer;
export const themeReducer = themeSlice.reducer;
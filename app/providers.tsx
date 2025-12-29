"use client";

import { Provider } from "react-redux";
import { store } from "./store/store";
import { ThemeProvider } from 'next-themes'
import React from "react";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <Provider store={store}>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                {children}
            </ThemeProvider>
        </Provider>
    );
}
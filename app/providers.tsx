"use client";

import { Provider } from "react-redux";
import { store } from "./store/store";
import { ThemeProvider } from 'next-themes'
import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
        queries: {
                staleTime: 60 * 1000, // 1분 동안 데이터를 '신선한' 상태로 간주
            },
        },
    }));
    
    return (
        <Provider store={store}>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                    {children}
                </ThemeProvider>
            </QueryClientProvider>
        </Provider>
    );
}
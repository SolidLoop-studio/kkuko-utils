"use client";
import Spinner from "@/src/app/components/Spinner";
import ProgressBar from "@/src/app/components/ProgressBar";
import { useDispatch, useSelector } from 'react-redux';
import { updateLoadingState } from '@/src/app/store/slice';
import type { RootState } from '@/src/app/store/store';
import { useCallback } from 'react';

export const useLoadingState = () => {
    const dispatch = useDispatch();
    const loadingState = useSelector((state: RootState) => state.loading);

    const updateState = useCallback((progress: number, task: string) => {
        dispatch(updateLoadingState({ progress, task }));
    }, [dispatch]);

    return {
        loadingState,
        updateLoadingState: updateState,
    };
};

export default function LoadingPage({ title, forceVisible = false }: { title: string; forceVisible?: boolean }) {
    const { loadingState } = useLoadingState();
    const isForcedLoading = forceVisible && !loadingState.isLoading;
    const isVisible = loadingState.isLoading || forceVisible;
    const progress = isForcedLoading ? 0 : loadingState.progress;
    const task = isForcedLoading ? '로딩 중...' : loadingState.currentTask;

    if (isVisible) {
        return (
            <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-900 rounded-lg shadow min-h-screen min-w-full text-gray-800 dark:text-gray-100">
                <h2 className="text-xl font-bold mb-4">
                    {title} 로딩 중
                </h2>
                <div className="w-full max-w-md mb-4">
                    <ProgressBar
                        completed={progress}
                        label={`${progress}% 완료`}
                    />
                </div>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                    {task}
                </p>
                <div className="mt-4">
                    <Spinner />
                </div>
            </div>
        );
    }

    return null;
};

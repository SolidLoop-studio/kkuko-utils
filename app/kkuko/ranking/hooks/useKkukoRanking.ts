import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchModes as fetchModesApi, fetchRanking as fetchRankingApi } from '../../shared/lib/api';
import type { RankingEntry, RankingOption, Mode } from '@/app/types/kkuko.types';

interface ErrorMessage {
    ErrName: string;
    ErrMessage: string;
    ErrStackRace: string | null;
    inputValue: string;
    location: string;
}

export const useKkukoRanking = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const [selectedMode, setSelectedMode] = useState<string>('');
    const [option, setOption] = useState<RankingOption>('win');
    const [page, setPage] = useState(1);
    const [detailedError, setDetailedError] = useState<ErrorMessage | null>(null);

    // Helper to create error object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createError = (err: any, inputValue: string, location: string): ErrorMessage => ({
        ErrName: err.name || "Error",
        ErrMessage: err.message || "Unknown error",
        ErrStackRace: err.stack || null,
        inputValue: inputValue,
        location: location
    });

    // 1. Fetch Modes
    const { 
        data: modes = [], 
        isLoading: modesLoading,
        error: modesError
    } = useQuery({
        queryKey: ['kkuko-modes'],
        queryFn: async () => {
            const response = await fetchModesApi();
            const modesData = response.data.data as Mode[];
            return [...modesData, { modeId: 'ALL', modeName: '전체 모드', group: 'def' }];
        },
        staleTime: 60 * 60 * 1000, // 1 hour
    });

    // Handle modes error
    useEffect(() => {
        if (modesError) {
            setDetailedError(createError(modesError, 'fetchModes', 'fetchModes'));
        }
    }, [modesError]);

    // 2. Fetch Rankings
    const {
        data: rankings = [],
        isLoading: rankingsLoading,
        error: rankingsError
    } = useQuery({
        queryKey: ['kkuko-rankings', selectedMode, page, option],
        queryFn: async () => {
            if (!selectedMode) return [];
            const response = await fetchRankingApi(selectedMode, page, option);
            return response.data.data as RankingEntry[];
        },
        enabled: !!selectedMode,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    // Handle rankings error
    useEffect(() => {
        if (rankingsError) {
            setDetailedError(createError(rankingsError, `mode: ${selectedMode}, page: ${page}, option: ${option}`, 'fetchRankings'));
        }
    }, [rankingsError, selectedMode, page, option]);

    // Sync mode with URL
    useEffect(() => {
        if (modes.length === 0) return;

        const queryMode = searchParams.get('mode');
        const isValidQueryMode = queryMode && modes.some(m => m.modeId === queryMode);
        
        if (isValidQueryMode) {
            if (selectedMode !== queryMode) {
                setSelectedMode(queryMode);
                setPage(1);
            }
        } else {
            if (modes.length > 0) {
                 const defaultMode = modes[0].modeId;
                 if (selectedMode !== defaultMode && !queryMode) {
                     setSelectedMode(defaultMode);
                 }
                 if (queryMode !== defaultMode) {
                     const params = new URLSearchParams(searchParams.toString());
                     params.set('mode', defaultMode);
                     router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                 }
            }
        }
    }, [modes, searchParams, pathname, router, selectedMode]);

    // Sync option with URL
    useEffect(() => {
        const queryOption = searchParams.get('option');
        if (queryOption && ['win', 'exp', 'total'].includes(queryOption)) {
            if (option !== queryOption) {
                setOption(queryOption as RankingOption);
                setPage(1);
            }
        }
    }, [searchParams, option]);

    const handleModeChange = useCallback((modeId: string) => {
        setSelectedMode(modeId);
        setPage(1);
        
        const params = new URLSearchParams(searchParams.toString());
        params.set('mode', modeId);
        params.delete('page');
        
        router.push(`${pathname}?${params.toString()}`);
    }, [pathname, router, searchParams]);

    const handleOptionChange = useCallback((value: string) => {
        setOption(value as RankingOption);
        setPage(1);
        
        const params = new URLSearchParams(searchParams.toString());
        params.set('option', value);
        params.delete('page');
        
        router.push(`${pathname}?${params.toString()}`);
    }, [pathname, router, searchParams]);

    const handlePageChange = useCallback((newPage: number) => {
        setPage(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    return {
        modes,
        selectedMode,
        rankings,
        option,
        page,
        loading: rankingsLoading,
        modesLoading,
        detailedError,
        setDetailedError,
        handleModeChange,
        handleOptionChange,
        handlePageChange
    };
};
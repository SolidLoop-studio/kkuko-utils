import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    fetchModes as fetchModesApi,
    fetchTotalUsers as fetchTotalUsersApi,
    fetchProfile as fetchProfileApi,
    fetchProfileByNickname as fetchProfileByNicknameApi,
    fetchItems as fetchItemsApi,
    fetchExpRank as fetchExpRankApi
} from '../../shared/lib/api';
import { Equipment, Mode, ProfileData } from '@/app/types/kkuko.types';
import { useRecentSearches } from './useRecentSearches';

interface ErrorMessage {
    ErrName: string;
    ErrMessage: string;
    ErrStackRace: string | null;
    inputValue: string;
    location: string;
}

export const useKkukoProfile = () => {
    // Search state
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchType, setSearchType] = useState<'nick' | 'id'>('nick');
    const [shouldFetchProfile, setShouldFetchProfile] = useState(false);
    
    // New state for selection from list
    const [selectedProfile, setSelectedProfile] = useState<ProfileData | null>(null);

    // Error state
    const [detailedError, setDetailedError] = useState<ErrorMessage | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { recentSearches, saveToRecentSearches, removeFromRecentSearches } = useRecentSearches();

    // Helper to create error object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createError = (err: any, inputValue: string, location: string): ErrorMessage => ({
        ErrName: err.name || "Error",
        ErrMessage: err.message || "Unknown error",
        ErrStackRace: err.stack || null,
        inputValue: inputValue,
        location: location
    });

    // 1. Fetch Modes (independent, 1 hour stale time)
    const { data: modesData = [] } = useQuery({
        queryKey: ['kkuko-modes-raw'],
        queryFn: async () => {
            const response = await fetchModesApi();
            return response.data.data as Mode[];
        },
        staleTime: 60 * 60 * 1000,
    });

    // 2. Fetch Total Users (independent, 5 minutes stale time)
    const { data: totalUserCount = 0 } = useQuery({
        queryKey: ['kkuko-total-users'],
        queryFn: async () => {
            const response = await fetchTotalUsersApi();
            return response.data.data.totalUsers as number;
        },
        staleTime: 5 * 60 * 1000,
    });

    // 3. Fetch Profile (dependent on search)
    const { 
        data: queryResult = null, 
        isLoading: profileLoading,
        error: profileError,
        isSuccess: profileSuccess
    } = useQuery({
        queryKey: ['kkuko-profile', searchQuery, searchType],
        queryFn: async () => {
            if (searchType === 'nick') {
                 try {
                     const response = await fetchProfileByNicknameApi(searchQuery);
                     const data = response.data.data;
                     
                     if (Array.isArray(data)) {
                        if (data.length === 0) throw new Error('NOT_FOUND');
                        if (data.length === 1) return { type: 'single', data: data[0] as ProfileData };
                        return { type: 'list', data: data as ProfileData[] };
                     }
                     return { type: 'single', data: data as ProfileData };
                 // eslint-disable-next-line @typescript-eslint/no-explicit-any
                 } catch (err: any) {
                     if (err.response?.status === 404) throw new Error('NOT_FOUND');
                     if (err.response?.status === 403) throw new Error('PRIVATE_PROFILE');
                     throw err;
                 }
            } else {
                 try {
                     const response = await fetchProfileApi(searchQuery, searchType);
                     return { type: 'single', data: response.data.data as ProfileData };
                 // eslint-disable-next-line @typescript-eslint/no-explicit-any
                 } catch (err: any) {
                     if (err.response?.status === 404) throw new Error('NOT_FOUND');
                     if (err.response?.status === 403) throw new Error('PRIVATE_PROFILE');
                     throw err;
                 }
            }
        },
        enabled: shouldFetchProfile && !!searchQuery,
        staleTime: 5 * 60 * 1000,
        retry: false,
    });

    const profileList = queryResult?.type === 'list' ? (queryResult.data as ProfileData[]) : null;

    // Update selectedProfile when query result changes (for single result)
    useEffect(() => {
        if (profileSuccess && queryResult) {
             if (queryResult.type === 'single') {
                 setSelectedProfile(queryResult.data as ProfileData);
             } else {
                 // For list, we wait for user selection, so start with null
                 setSelectedProfile(null);
             }
        }
    }, [profileSuccess, queryResult]);

    // Derived profileData is the Selected Profile
    const profileData = selectedProfile;

    // Handle Profile Errors & Success side effects
    useEffect(() => {
        if (profileError) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const err = profileError as any;
            const isPrivate = err.message === 'PRIVATE_PROFILE' || err.response?.status === 403;
            const isNotFound = err.message === 'NOT_FOUND' || err.response?.status === 404;

            if (isNotFound) {
                setError('등록된 유저가 아닙니다.');
            } else if (isPrivate) {
                setError('프로필이 비공개된 유저 입니다.'); 
                setDetailedError(null); 
            } else {
                setError('프로필을 불러오는데 실패했습니다.');
                setDetailedError(createError(profileError, searchQuery, 'fetchProfile'));
            }
            setShouldFetchProfile(false);
        }
    }, [profileError, searchQuery]);

    useEffect(() => {
        if (profileSuccess) {
            saveToRecentSearches(searchQuery, searchType);
            setError(null);
            setDetailedError(null);
        }
    }, [profileSuccess, saveToRecentSearches, searchQuery, searchType]);


    // 4. Fetch Items (dependent on selectedProfile)
    const itemIds = profileData?.equipment?.length 
        ? profileData.equipment.map((eq: Equipment) => eq.itemId).join(',') 
        : null;

    const { data: itemsData = [] } = useQuery({
        queryKey: ['kkuko-items', itemIds],
        queryFn: async () => {
            if (!itemIds) return [];
            const response = await fetchItemsApi(itemIds);
            const result = response.data;
            return Array.isArray(result.data) ? result.data : [result.data];
        },
        enabled: !!itemIds,
        staleTime: 5 * 60 * 1000,
    });

    // 5. Fetch Exp Rank (dependent on selectedProfile)
    const userId = profileData?.user?.id;

    const { data: expRank = null } = useQuery({
        queryKey: ['kkuko-exp-rank', userId],
        queryFn: async () => {
            if (!userId) return null;
            const response = await fetchExpRankApi(userId);
            return response.data.rank as number;
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000,
    });

    // Trigger fetch
    const fetchProfile = useCallback((query: string, type: 'nick' | 'id') => {
        setSearchQuery(query);
        setSearchType(type);
        setShouldFetchProfile(true);
        setError(null);
        setDetailedError(null);
        setSelectedProfile(null);
    }, []);

    return {
        profileData,
        profileList,
        itemsData,
        modesData,
        loading: profileLoading && shouldFetchProfile,
        error,
        detailedError,
        setDetailedError,
        totalUserCount,
        expRank,
        recentSearches,
        fetchProfile,
        removeFromRecentSearches,
        selectProfile: setSelectedProfile
    };
};

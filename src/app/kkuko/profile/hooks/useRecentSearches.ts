import { useState, useEffect, useCallback } from 'react';

export type SearchHistoryItem = {
    query: string;
    type: 'nick' | 'id';
};

export const useRecentSearches = () => {
    const [recentSearches, setRecentSearches] = useState<SearchHistoryItem[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem('kkuko-recent-searches');
        if (saved) {
            try {
                setRecentSearches(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse recent searches:', e);
            }
        }
    }, []);

    const saveToRecentSearches = useCallback((query: string, type: 'nick' | 'id') => {
        setRecentSearches(prev => {
            const newSearch = { query, type };
            const filtered = prev.filter(
                s => !(s.query === query && s.type === type)
            );
            const updated = [newSearch, ...filtered].slice(0, 7);
            localStorage.setItem('kkuko-recent-searches', JSON.stringify(updated));
            return updated;
        });
    }, []);

    const removeFromRecentSearches = useCallback((query: string, type: 'nick' | 'id') => {
        setRecentSearches(prev => {
            const updated = prev.filter(
                s => !(s.query === query && s.type === type)
            );
            localStorage.setItem('kkuko-recent-searches', JSON.stringify(updated));
            return updated;
        });
    }, []);

    return {
        recentSearches,
        saveToRecentSearches,
        removeFromRecentSearches
    };
};

import { renderHook, act } from '@testing-library/react';
import { useRecentSearches } from '@/src/app/kkuko/profile/hooks/useRecentSearches';

describe('useRecentSearches', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should initialize with empty array if nothing in localStorage', () => {
        const { result } = renderHook(() => useRecentSearches());
        expect(result.current.recentSearches).toEqual([]);
    });

    it('should load recent searches from localStorage', () => {
        const initialData = [{ query: 'test', type: 'nick' }];
        localStorage.setItem('kkuko-recent-searches', JSON.stringify(initialData));
        const { result } = renderHook(() => useRecentSearches());
        expect(result.current.recentSearches).toEqual(initialData);
    });

    it('should save to recent searches', () => {
        const { result } = renderHook(() => useRecentSearches());

        act(() => {
            result.current.saveToRecentSearches('test1', 'nick');
        });

        expect(result.current.recentSearches).toHaveLength(1);
        expect(result.current.recentSearches[0]).toEqual({ query: 'test1', type: 'nick' });
        expect(JSON.parse(localStorage.getItem('kkuko-recent-searches') || '[]')).toHaveLength(1);
    });

    it('should move duplicate search to top', () => {
        const { result } = renderHook(() => useRecentSearches());

        act(() => {
            result.current.saveToRecentSearches('test1', 'nick');
            result.current.saveToRecentSearches('test2', 'id');
            result.current.saveToRecentSearches('test1', 'nick');
        });

        expect(result.current.recentSearches).toHaveLength(2);
        expect(result.current.recentSearches[0]).toEqual({ query: 'test1', type: 'nick' });
    });

    it('should remove from recent searches', () => {
        const { result } = renderHook(() => useRecentSearches());

        act(() => {
            result.current.saveToRecentSearches('test1', 'nick');
            result.current.removeFromRecentSearches('test1', 'nick');
        });

        expect(result.current.recentSearches).toHaveLength(0);
        expect(JSON.parse(localStorage.getItem('kkuko-recent-searches') || '[]')).toHaveLength(0);
    });

    it('should limit history to 7 items', () => {
        const { result } = renderHook(() => useRecentSearches());

        act(() => {
            for (let i = 0; i < 10; i++) {
                result.current.saveToRecentSearches(`test${i}`, 'nick');
            }
        });

        expect(result.current.recentSearches).toHaveLength(7);
        // The last one added (test9) should be first
        expect(result.current.recentSearches[0].query).toBe('test9');
    });
});

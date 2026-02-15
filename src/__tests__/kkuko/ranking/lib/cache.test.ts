import { rankingCache } from '@/src/app/kkuko/ranking/lib/cache';
import { RankingEntry } from '@/src/app/types/kkuko.types';

describe('RankingCache', () => {
    const mockData: RankingEntry[] = [
        {
            rank: 1,
            userRecord: {
                id: 1,
                userId: 'user1',
                modeId: 'mode1',
                win: 10,
                total: 20,
                exp: 1000,
                playtime: 0
            },
            userInfo: {
                id: 'user1',
                nickname: 'User One',
                level: 5,
                exp: 1000,
                exordial: 'Hello',
                observedAt: ''
            }
        }
    ];

    const cacheKey = {
        mode: 'test-mode',
        page: 1,
        option: 'win' as const
    };

    beforeEach(() => {
        rankingCache.clear();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should return null for non-existent key', () => {
        expect(rankingCache.get(cacheKey)).toBeNull();
    });

    it('should store and retrieve data', () => {
        rankingCache.set(cacheKey, mockData);
        expect(rankingCache.get(cacheKey)).toEqual(mockData);
    });

    it('should return null for expired data', () => {
        rankingCache.set(cacheKey, mockData);
        
        // Fast-forward time by 5 minutes + 1 ms (TTL is 5 minutes)
        jest.advanceTimersByTime(5 * 60 * 1000 + 1);

        expect(rankingCache.get(cacheKey)).toBeNull();
    });

    it('should return data if not expired', () => {
        rankingCache.set(cacheKey, mockData);
        
        // Fast-forward time by 4 minutes 59 seconds
        jest.advanceTimersByTime(5 * 60 * 1000 - 1000);

        expect(rankingCache.get(cacheKey)).toEqual(mockData);
    });

    it('should clear all data', () => {
        rankingCache.set(cacheKey, mockData);
        rankingCache.clear();
        expect(rankingCache.get(cacheKey)).toBeNull();
    });

    it('should cleanup expired entries only', () => {
        const key1 = { ...cacheKey, mode: 'mode1' };
        const key2 = { ...cacheKey, mode: 'mode2' };

        rankingCache.set(key1, mockData);

        // Advance time partially
        jest.advanceTimersByTime(2 * 60 * 1000); // 2 mins elapsed

        rankingCache.set(key2, mockData); // key2 created 2 mins late

        // Advance time to expire key1 but not key2
        // key1 age: 2min + 3min + 1ms = 5min 1ms (Expired)
        // key2 age: 3min + 1ms (Valid)
        jest.advanceTimersByTime(3 * 60 * 1000 + 1);

        rankingCache.cleanup();

        // Testing internal state via public get method
        // get() also checks expiry, but cleanup() should have removed it from the map internally
        // We can verify behavior is correct regardless
        expect(rankingCache.get(key1)).toBeNull();
        expect(rankingCache.get(key2)).toEqual(mockData);
    });
});

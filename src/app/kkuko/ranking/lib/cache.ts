import type { RankingEntry } from '@/src/app/types/kkuko.types';

interface CacheEntry {
    data: RankingEntry[];
    timestamp: number;
}

interface CacheKey {
    mode: string;
    page: number;
    option: 'win' | 'exp';
}

class RankingCache {
    private cache: Map<string, CacheEntry> = new Map();
    private readonly TTL = 5 * 60 * 1000; // 5 minutes

    private getCacheKey(key: CacheKey): string {
        return `${key.mode}-${key.page}-${key.option}`;
    }

    get(key: CacheKey): RankingEntry[] | null {
        const cacheKey = this.getCacheKey(key);
        const entry = this.cache.get(cacheKey);

        if (!entry) {
            return null;
        }

        const now = Date.now();
        if (now - entry.timestamp > this.TTL) {
            this.cache.delete(cacheKey);
            return null;
        }

        return entry.data;
    }

    set(key: CacheKey, data: RankingEntry[]): void {
        const cacheKey = this.getCacheKey(key);
        this.cache.set(cacheKey, {
            data,
            timestamp: Date.now(),
        });
    }

    clear(): void {
        this.cache.clear();
    }

    // Clean up expired entries periodically
    cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.TTL) {
                this.cache.delete(key);
            }
        }
    }
}

export const rankingCache = new RankingCache();

// Clean up expired cache entries every minute
if (typeof window !== 'undefined') {
    setInterval(() => {
        rankingCache.cleanup();
    }, 60 * 1000);
}

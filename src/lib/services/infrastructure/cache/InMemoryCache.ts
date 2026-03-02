/**
 * 범용 인메모리 캐시 유틸리티
 *
 * 기존 GetManager의 wordsCache, wordLetterCountsCacheTime 등의 캐시 로직을 범용화합니다.
 * TTL(Time To Live) 기반으로 캐시 만료를 관리합니다.
 *
 * @template K - 캐시 키 타입
 * @template V - 캐시 값 타입
 */
export class InMemoryCache<K extends string | number, V> {
    private readonly cache = new Map<K, { value: V; timestamp: number }>();

    /**
     * @param duration - 캐시 유효 기간 (밀리초, 기본: 10분)
     */
    constructor(private readonly duration: number = 10 * 60 * 1000) {}

    /**
     * 캐시에서 값을 가져옵니다.
     * 만료된 경우 null을 반환하고 해당 키를 삭제합니다.
     *
     * @param key - 캐시 키
     * @returns 캐시된 값 또는 null
     */
    get(key: K): V | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const now = Date.now();
        if (now - entry.timestamp >= this.duration) {
            this.cache.delete(key);
            return null;
        }

        return entry.value;
    }

    /**
     * 캐시에 값을 저장합니다.
     *
     * @param key - 캐시 키
     * @param value - 저장할 값
     */
    set(key: K, value: V): void {
        this.cache.set(key, { value, timestamp: Date.now() });
    }

    /**
     * 특정 키의 캐시를 무효화합니다.
     *
     * @param key - 무효화할 캐시 키
     */
    invalidate(key: K): void {
        this.cache.delete(key);
    }

    /**
     * 전체 캐시를 초기화합니다.
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * 캐시에 유효한 값이 있는지 확인합니다.
     *
     * @param key - 확인할 캐시 키
     * @returns 유효한 캐시 존재 여부
     */
    has(key: K): boolean {
        return this.get(key) !== null;
    }
}

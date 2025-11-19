class DefaultDict<K, V> {
    private store: Map<K, V>;
    private defaultValue: () => V;

    /**
     * py의 collections.defaultdict를 비슷하게 구현한 클래스
     * 
     * @param defaultValue () => 기본값
     * @example
     * const dict = new DefaultDict<string,string[]>(()=>[])
     */
    constructor(defaultValue: () => V) {
        this.store = new Map();
        this.defaultValue = defaultValue;
    }

    /**
     * 원하는 키에 해당하는 값 얻기
     * 
     * @param key 원하는 키
     * @returns 등록된 값 또는 기본값
     */
    get(key: K): V {
        if (!this.store.has(key)) {
            this.store.set(key, this.defaultValue());
        }
        return this.store.get(key)!;  // store.get(key) 값은 null이 아니므로 non-null assertion
    }

    /**
     * 키에 값 설정
     * 
     * @param key 키
     * @param value 설정할 값
     */
    set(key: K, value: V): void {
        this.store.set(key, value);
    }

    /**
     * 키를 기준으로 정렬하거나, 사용자 정의 비교함수 사용
     * 
     * @param compareFn (optional) 정렬에 사용할 비교 함수
     */
    sortedEntries(
        compareFn?: (a: [K, V], b: [K, V]) => number
    ): [K, V][] {
        const entries = [...this.store.entries()];

        if (compareFn) {
            return entries.sort(compareFn);
        }

        // 기본 정렬 로직
        return entries.sort(([a], [b]) => {
            if (typeof a === "string" && typeof b === "string") {
                return a.localeCompare(b, "ko-KR");
            }
            return a > b ? 1 : a < b ? -1 : 0;
        });
    }

    /** Map.prototype.entries과 동일함
     * 
     * @returns 전체 키/값 쌍 반환
     */
    entries(): [K, V][] {
        return [...this.store.entries()]
    }
    

}

class Counter<T> {
    private store: Map<T, number>;

    constructor(iterable?: Iterable<T>) {
        this.store = new Map<T, number>();

        if (iterable) {
            for (const item of iterable) {
                this.increment(item);
            }
        }
    }

    /**
     * 특정 키의 값 증가
     * 
     * @param key 키
     * @param count 증가할 수, 기본값 1
     */
    increment(key: T, count: number = 1): void {
        this.store.set(key, (this.store.get(key) || 0) + count);
    }

    /**
     * 특정 키의 값 감소
     * 
     * @param key 키
     * @param count 감소할 수, 기본값 1
     */
    decrement(key: T, count: number = 1): void {
        if (this.store.has(key)) {
            const newCount = (this.store.get(key) || 0) - count;
            if (newCount > 0) {
                this.store.set(key, newCount);
            } else {
                this.store.delete(key); // 값이 0 이하가 되면 삭제
            }
        }
    }

    /**
     * 키에 해당하는 값 가지고 오기
     * 
     * @param key 키
     * @returns 해당 키의 값
     */
    get(key: T): number {
        return this.store.get(key) || 0;
    }

    /**
     * 특정키의 값 설정
     * 
     * @param key 키
     * @param count 설정할 값
     */
    set(key: T, count: number): void {
        this.store.set(key, count);
    }

    /**
     * 가장 많이 카운트된 값 반환
     * 
     * @param n 몇개 까지 가지고 올것인가
     * @returns 값 상위 n개
     */
    mostCommon(n?: number): [T, number][] {
        const sorted = Array.from(this.store.entries()).sort((a, b) => b[1] - a[1]);
        return n ? sorted.slice(0, n) : sorted;
    }

    /**
     * 전체 키/값 쌍 반환
     * 
     * @returns [키,값][] 형식
     */
    entries(): [T, number][] {
        return Array.from(this.store.entries());
    }

    /**
     * 전체값 삭제
     * 
     */
    clear(): void {
        this.store.clear();
    }
}


export { DefaultDict, Counter };
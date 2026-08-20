import { SupabaseClientManager } from './supabase/SupabaseClientManager';
import { chunk as chunkArray } from 'es-toolkit';
import type { ProgressCallback, SupabaseResult, SupabaseArrayResult } from '@/src/app/types/supabase.types';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';

export { browserSupabaseClient as supabase };
const supabase = browserSupabaseClient;

export const SCM = new SupabaseClientManager(supabase);

/**
 * 대용량 데이터를 청크 단위로 나누어 Supabase 쿼리를 실행하는 유틸리티 함수
 *
 * @template T - 반환되는 데이터의 타입
 * @template P - 입력 값들의 타입
 *
 * @param values - 처리할 값들의 배열
 * @param fn - 각 청크에 대해 실행할 Supabase 쿼리 함수
 * @param options - 실행 옵션
 * @param options.chunkSize - 각 청크의 크기 (기본값: 1000)
 * @param options.concurrency - 동시 실행할 청크 수 (기본값: 1)
 * @param options.onProgress - 진행 상황을 알려주는 콜백 함수
 * @param options.continueOnError - 에러 발생 시 계속 실행할지 여부 (기본값: false)
 *
 * @returns Promise<SupabaseArrayResult<T>> - 성공 시 모든 데이터를 합친 결과, 실패 시 에러 정보
 */
export async function supabaseInQueryChunk<T, P>(
    values: P[],
    fn: (chunk: P[]) => Promise<SupabaseResult<T>>,
    options: {
        chunkSize?: number;
        concurrency?: number;
        onProgress?: ProgressCallback;
        continueOnError?: boolean;
    } = {}
): Promise<SupabaseArrayResult<T>> {
    if (values.length === 0) {
        return { data: [], error: null, count: 0 };
    }

    const { chunkSize = 350, concurrency = 1, onProgress, continueOnError = false } = options;
    const result: T[] = [];

    // 전체 청크 배열 생성
    const chunks: P[][] = values.length > chunkSize ? chunkArray(values, chunkSize) : [values];

    for (let i = 0; i < chunks.length; i += concurrency) {
        const concurrentChunks = chunks.slice(i, i + concurrency);

        const results = await Promise.all(
            concurrentChunks.map(async (chunk, index) => {
                const currentChunk = i + index + 1;
                const res = await fn(chunk);

                onProgress?.(
                    Math.min(currentChunk * chunkSize, values.length),
                    values.length,
                    currentChunk,
                    chunks.length
                );

                return res;
            })
        );

        // 결과 처리
        for (const res of results) {
            if (res.error && !continueOnError) {
                // 에러가 있고 continueOnError가 false인 경우 즉시 반환
                return { data: null, error: res.error, count: null };
            }

            // 성공한 데이터만 추가
            if (res.data) {
                if (Array.isArray(res.data)) {
                    result.push(...res.data);
                } else {
                    result.push(res.data);
                }
            }
        }
    }

    return { data: result, error: null, count: result.length };
}

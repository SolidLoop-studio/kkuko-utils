import type { Result, CustomError } from '../result';
import type { WordLogEntity, WordLogFilter } from './LogEntity';

/**
 * Log Repository 인터페이스 (Port)
 *
 * 단어/문서 로그 데이터 접근을 추상화합니다.
 */
export interface ILogRepository {
    /**
     * 필터 조건으로 단어 로그를 조회합니다.
     *
     * @param filter - 로그 필터
     * @returns 로그 목록과 전체 개수
     */
    findWordLogsByFilter(filter: WordLogFilter): Promise<Result<{ data: WordLogEntity[]; count: number }, CustomError>>;

    /**
     * 단어 로그를 삭제합니다.
     *
     * @param ids - 삭제할 로그 ID 배열
     * @returns 처리 결과
     */
    deleteWordLogsByIds(ids: number[]): Promise<Result<void, CustomError>>;

    /**
     * 문서 로그를 삭제합니다.
     *
     * @param ids - 삭제할 로그 ID 배열
     * @returns 처리 결과
     */
    deleteDocsLogsByIds(ids: number[]): Promise<Result<void, CustomError>>;

    /**
     * 단어 로그를 기록합니다.
     *
     * @param logsData - 기록할 로그 데이터
     */
    saveWordLogs(logsData: { word: string; make_by: string | null; processed_by: string | null; r_type: 'add' | 'delete'; state: 'approved' | 'rejected' }[]): Promise<void>;

    /**
     * 문서 로그를 기록합니다.
     *
     * @param logsData - 기록할 로그 데이터
     */
    saveDocsLogs(logsData: { word: string; docs_id: number; add_by: string | null; type: 'add' | 'delete' }[]): Promise<void>;
}

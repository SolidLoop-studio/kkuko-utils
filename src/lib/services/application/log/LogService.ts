import type { ILogRepository } from '../../domain/log/LogRepository';
import type { Result, CustomError } from '../../domain/result';
import type { WordLogEntity, WordLogFilter } from '../../domain/log/LogEntity';
import type { IWordLogWriter } from '../word/WordCommandService';

/**
 * Log 유즈케이스 서비스 (Application Layer)
 *
 * 단어/문서 로그 조회 및 삭제, 그리고 로그 기록을 담당합니다.
 */
export class LogService implements IWordLogWriter {
    constructor(private readonly repo: ILogRepository) {}

    /**
     * 필터 조건으로 단어 로그를 조회합니다.
     *
     * @param filter - 로그 필터
     * @returns 로그 목록과 전체 개수
     */
    async getWordLogsByFilter(
        filter: WordLogFilter
    ): Promise<Result<{ data: WordLogEntity[]; count: number }, CustomError>> {
        return this.repo.findWordLogsByFilter(filter);
    }

    /**
     * 단어 로그를 삭제합니다.
     *
     * @param ids - 삭제할 로그 ID 배열
     * @returns 처리 결과
     */
    async deleteWordLogsByIds(ids: number[]): Promise<Result<void, CustomError>> {
        return this.repo.deleteWordLogsByIds(ids);
    }

    /**
     * 문서 로그를 삭제합니다.
     *
     * @param ids - 삭제할 로그 ID 배열
     * @returns 처리 결과
     */
    async deleteDocsLogsByIds(ids: number[]): Promise<Result<void, CustomError>> {
        return this.repo.deleteDocsLogsByIds(ids);
    }

    /**
     * 단어 로그를 기록합니다.
     *
     * @param logsData - 기록할 로그 데이터
     */
    async writeWordLog(logsData: { word: string; make_by: string | null; processed_by: string | null; r_type: 'add' | 'delete'; state: 'approved' | 'rejected' }[]): Promise<void> {
        await this.repo.saveWordLogs(logsData);
    }

    /**
     * 문서 로그를 기록합니다.
     *
     * @param logsData - 기록할 로그 데이터
     */
    async writeDocsLog(logsData: { word: string; docs_id: number; add_by: string | null; type: 'add' | 'delete' }[]): Promise<void> {
        await this.repo.saveDocsLogs(logsData);
    }
}

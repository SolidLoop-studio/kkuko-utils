import type { Result } from '../result';
import type { CustomError } from '../result';
import type {
    DocsEntity,
    DocsWithUser,
    DocsLogEntity,
    DocsLogWithDocs,
    NewDocs,
    NewDocsLog,
    DocsLogFilter,
    DocsWordCountInput,
} from './DocsEntity';

/**
 * Docs Repository 인터페이스 (Port)
 *
 * 단어장 엔티티에 대한 데이터 접근 추상화 레이어입니다.
 * 인프라 구현체(Supabase 등)와 도메인을 분리합니다.
 */
export interface IDocsRepository {
    // ========== 조회 메서드 ==========

    /**
     * 모든 단어장을 조회합니다.
     *
     * @returns 사용자 정보가 포함된 단어장 배열
     */
    findAll(): Promise<Result<DocsWithUser[], CustomError>>;

    /**
     * ID로 단어장을 조회합니다.
     *
     * @param id - 단어장 ID
     * @returns 사용자 정보가 포함된 단어장 또는 null
     */
    findById(id: number): Promise<Result<DocsWithUser | null, CustomError>>;

    /**
     * 종류로 단어장을 조회합니다.
     *
     * @param typez - 단어장 종류 ('letter' | 'theme')
     * @returns 단어장 배열
     */
    findByType(typez: 'letter' | 'theme'): Promise<Result<DocsEntity[], CustomError>>;

    /**
     * 테마 이름 배열로 단어장을 조회합니다.
     *
     * @param names - 테마 이름 배열
     * @returns 단어장 배열
     */
    findByThemeNames(names: string[]): Promise<Result<DocsEntity[], CustomError>>;

    /**
     * 단어장의 마지막 업데이트 시간을 조회합니다.
     *
     * @param id - 단어장 ID
     * @returns 마지막 업데이트 시각 문자열 또는 null
     */
    findLastUpdate(id: number): Promise<Result<string | null, CustomError>>;

    /**
     * 단어장의 단어 개수를 조회합니다.
     *
     * @param input - 단어 개수 조회 입력 파라미터
     * @returns 단어 개수
     */
    findWordCount(input: DocsWordCountInput): Promise<Result<number, CustomError>>;

    /**
     * 단어장의 조회수 랭킹을 조회합니다.
     *
     * @param id - 단어장 ID
     * @returns 순위 번호
     */
    findViewRank(id: number): Promise<Result<number, CustomError>>;

    /**
     * 단어장의 별 개수(좋아요 수)를 조회합니다.
     *
     * @param id - 단어장 ID
     * @returns 별 개수
     */
    findStarCount(id: number): Promise<Result<number, CustomError>>;

    /**
     * 단어장을 별표한 사용자 목록을 조회합니다.
     *
     * @param id - 단어장 ID
     * @returns 사용자 ID 배열
     */
    findStarUsers(id: number): Promise<Result<string[], CustomError>>;

    // ========== 로그 메서드 ==========

    /**
     * 특정 단어장의 변경 로그를 조회합니다.
     *
     * @param docsId - 단어장 ID
     * @returns 변경 로그 배열
     */
    findLogs(docsId: number): Promise<Result<DocsLogEntity[], CustomError>>;

    /**
     * 필터 조건에 맞는 변경 로그를 조회합니다.
     *
     * @param filter - 로그 필터 옵션
     * @returns 단어장 정보가 포함된 로그 배열 및 전체 개수
     */
    findLogsByFilter(
        filter: DocsLogFilter,
    ): Promise<Result<{ data: DocsLogWithDocs[]; count: number }, CustomError>>;

    /**
     * 변경 로그를 저장합니다.
     *
     * @param logs - 저장할 로그 배열
     * @returns void
     */
    saveLogs(logs: NewDocsLog[]): Promise<Result<void, CustomError>>;

    /**
     * ID로 변경 로그를 삭제합니다.
     *
     * @param ids - 삭제할 로그 ID 배열
     * @returns void
     */
    deleteLogsByIds(ids: number[]): Promise<Result<void, CustomError>>;

    // ========== 별표(좋아요) 메서드 ==========

    /**
     * 단어장에 별표를 추가합니다.
     *
     * @param docsId - 단어장 ID
     * @param userId - 사용자 ID
     * @returns void
     */
    saveStar(docsId: number, userId: string): Promise<Result<void, CustomError>>;

    /**
     * 단어장의 별표를 제거합니다.
     *
     * @param docsId - 단어장 ID
     * @param userId - 사용자 ID
     * @returns void
     */
    deleteStar(docsId: number, userId: string): Promise<Result<void, CustomError>>;

    // ========== 쓰기 메서드 ==========

    /**
     * 새로운 단어장을 추가합니다.
     *
     * @param docs - 추가할 단어장 데이터 배열
     * @returns 추가된 단어장 엔티티 배열
     */
    save(docs: NewDocs[]): Promise<Result<DocsEntity[], CustomError>>;

    /**
     * 단어장의 마지막 업데이트 시간을 갱신합니다.
     *
     * @param docsIds - 업데이트할 단어장 ID 배열
     * @returns void
     */
    updateLastUpdate(docsIds: number[]): Promise<Result<void, CustomError>>;

    /**
     * 단어장의 조회수를 증가시킵니다.
     *
     * @param id - 단어장 ID
     * @returns void
     */
    incrementView(id: number): Promise<Result<void, CustomError>>;
}

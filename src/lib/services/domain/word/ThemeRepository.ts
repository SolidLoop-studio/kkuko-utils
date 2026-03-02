import type { CustomError } from '../result';
import type { Result } from '../result';
import type {
    ThemeEntity,
    WordThemeMapping,
    WordThemeResult,
    WordThemeRequest,
    ThemeRequestResult,
    WaitThemeInfo,
} from './ThemeEntity';

/**
 * Theme Repository 인터페이스 (Port)
 *
 * 테마 엔티티 및 단어-테마 관계에 대한 데이터 접근 추상화 레이어입니다.
 */
export interface IThemeRepository {
    /**
     * 전체 테마 목록을 조회합니다.
     *
     * @returns 테마 엔티티 배열
     */
    findAll(): Promise<Result<ThemeEntity[], CustomError>>;

    /**
     * 테마 이름으로 단일 테마를 조회합니다.
     *
     * @param name - 테마 이름
     * @returns 테마 엔티티 또는 null
     */
    findByName(name: string): Promise<Result<ThemeEntity | null, CustomError>>;

    /**
     * 단어 ID에 연결된 테마 목록을 조회합니다.
     *
     * @param wordId - 단어 ID
     * @returns 테마 매핑 배열
     */
    findThemesByWordId(wordId: number): Promise<Result<WordThemeMapping[], CustomError>>;

    /**
     * 여러 단어 ID에 연결된 테마 목록을 일괄 조회합니다.
     *
     * @param wordIds - 단어 ID 배열
     * @returns 테마 매핑 배열
     */
    findThemesByWordIds(wordIds: number[]): Promise<Result<WordThemeMapping[], CustomError>>;

    /**
     * 대기 단어 ID에 연결된 테마 목록을 조회합니다.
     *
     * @param waitWordId - 대기 단어 ID
     * @returns 테마 엔티티 배열 (theme_id, themes 포함)
     */
    findWaitWordThemes(waitWordId: number): Promise<Result<{ themeId: number; theme: ThemeEntity }[], CustomError>>;

    /**
     * 여러 대기 단어 ID에 연결된 테마 목록을 일괄 조회합니다.
     *
     * @param waitWordIds - 대기 단어 ID 배열
     * @returns 대기 단어별 테마 매핑 배열
     */
    findWaitWordThemesByIds(waitWordIds: number[]): Promise<Result<{ waitWordId: number; waitWord: string; theme: ThemeEntity }[], CustomError>>;

    /**
     * 단어-테마 관계를 추가합니다.
     *
     * @param data - 추가할 단어-테마 관계 배열
     * @returns 추가 결과
     */
    saveWordThemes(data: { wordId: number; themeId: number }[]): Promise<Result<WordThemeResult[], CustomError>>;

    /**
     * 단어-테마 관계를 삭제합니다.
     *
     * @param data - 삭제할 단어-테마 관계 배열
     */
    deleteWordThemes(data: { wordId: number; themeId: number }[]): Promise<Result<void, CustomError>>;

    /**
     * 대기 단어-테마 관계를 추가합니다.
     *
     * @param data - 추가할 대기단어-테마 관계 배열
     */
    saveWaitWordThemes(data: { waitWordId: number; themeId: number }[]): Promise<Result<void, CustomError>>;

    /**
     * 단어 테마 요청(word_themes_wait)을 추가합니다.
     *
     * @param data - 추가할 테마 요청 배열
     * @returns 요청 결과
     */
    saveWordThemeRequests(data: WordThemeRequest[]): Promise<Result<ThemeRequestResult[], CustomError>>;

    /**
     * 단어 ID 기준 대기 테마를 조회합니다.
     *
     * @param wordId - 단어 ID
     * @returns 대기 테마 정보 배열
     */
    findWaitThemesByWordId(wordId: number): Promise<Result<WaitThemeInfo[], CustomError>>;

    /**
     * 전체 대기 테마를 조회합니다.
     *
     * @param filter - 요청 타입 필터 (add / delete)
     * @returns 대기 테마 정보 배열
     */
    findAllWaitThemes(filter?: 'add' | 'delete'): Promise<Result<WaitThemeInfo[], CustomError>>;

    /**
     * 대기 테마(word_themes_wait)를 ID 기준 삭제합니다.
     *
     * @param wordIds - word_id 배열
     */
    deleteWaitThemesByWordIds(wordIds: number[]): Promise<Result<void, CustomError>>;
}

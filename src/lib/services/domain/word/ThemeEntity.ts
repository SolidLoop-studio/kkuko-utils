/**
 * Theme(테마) 도메인 엔티티
 *
 * DB의 `themes` 테이블 Row를 도메인 관점에서 표현한 타입입니다.
 */
export interface ThemeEntity {
    /** 테마 고유 ID */
    readonly id: number;
    /** 테마 이름 */
    readonly name: string;
    /** 테마 코드 */
    readonly code: string;
}

/**
 * 단어-테마 매핑 정보
 */
export interface WordThemeMapping {
    /** 단어 ID */
    readonly wordId: number;
    /** 테마 ID */
    readonly themeId: number;
    /** 테마 이름 */
    readonly themeName: string;
    /** 테마 코드 */
    readonly themeCode: string;
}

/**
 * 단어-테마 관계 추가/삭제 결과
 */
export interface WordThemeResult {
    /** 단어 ID */
    readonly wordId: number;
    /** 단어 문자열 */
    readonly word: string;
    /** 테마 ID */
    readonly themeId: number;
    /** 테마 이름 */
    readonly themeName: string;
}

/**
 * 단어 테마 요청 (word_themes_wait) 입력 타입
 */
export interface WordThemeRequest {
    /** 단어 ID */
    readonly wordId: number;
    /** 테마 ID */
    readonly themeId: number;
    /** 요청 타입 (추가 / 삭제) */
    readonly typez: 'add' | 'delete';
    /** 요청한 사용자 ID */
    readonly reqBy: string | null;
}

/**
 * 대기 테마 정보 (word_themes_wait 조회 결과)
 */
export interface WaitThemeInfo {
    /** word_themes_wait 행의 word_id */
    readonly wordId: number;
    /** 단어 문자열 */
    readonly word: string;
    /** 테마 정보 */
    readonly theme: ThemeEntity;
    /** 요청 타입 (추가 / 삭제) */
    readonly typez: 'add' | 'delete';
    /** 요청한 사용자 ID */
    readonly reqBy: string | null;
}

/**
 * 테마 요청 결과 (word_themes_wait upsert 결과)
 */
export interface ThemeRequestResult {
    /** 테마 이름 */
    readonly themeName: string;
    /** 요청 타입 */
    readonly typez: 'add' | 'delete';
}

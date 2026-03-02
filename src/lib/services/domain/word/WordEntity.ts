/**
 * Word 도메인 엔티티
 *
 * DB의 `words` 테이블 Row를 도메인 관점에서 표현한 타입입니다.
 */
export interface WordEntity {
    /** 단어 고유 ID */
    readonly id: number;
    /** 단어 문자열 */
    readonly word: string;
    /** 단어 길이 */
    readonly length: number | null;
    /** 단어 첫 글자 */
    readonly firstLetter: string | null;
    /** 단어 마지막 글자 */
    readonly lastLetter: string | null;
    /** 노인정 사용 가능 여부 */
    readonly noinCanuse: boolean;
    /** 끄코(끝말잇기) 사용 가능 여부 */
    readonly kCanuse: boolean;
    /** 미션 문자 비트마스크 */
    readonly missionMark: number;
    /** 초성 문자열 */
    readonly chosungs: string | null;
    /** 추가한 사용자 ID */
    readonly addedBy: string | null;
    /** 추가된 시각 */
    readonly addedAt: string;
}

/**
 * 단어 정보에 사용자 닉네임이 포함된 상세 타입
 */
export interface WordWithUser extends WordEntity {
    /** 추가한 사용자 닉네임 */
    readonly userNickname: string | null;
}

/**
 * 단어 목록 아이템 (다운로드/조합기 등에서 사용)
 */
export interface WordListItem {
    /** 단어 문자열 */
    readonly word: string;
    /** 노인정 사용 가능 여부 */
    readonly noinCanuse: boolean;
    /** 끄코 사용 가능 여부 */
    readonly kCanuse: boolean;
    /** 단어 상태 */
    readonly status: 'ok' | 'add' | 'delete';
}

/**
 * 단어 추가 시 사용하는 입력 타입
 */
export interface NewWord {
    /** 단어 문자열 */
    readonly word: string;
    /** 노인정 사용 가능 여부 */
    readonly noinCanuse: boolean;
    /** 추가한 사용자 ID */
    readonly addedBy: string | null;
}

/**
 * 고급 검색 결과 아이템
 */
export interface WordSearchResult {
    /** 단어 문자열 */
    readonly word: string;
    /** 다음 단어 개수 (공격력 등에 활용) */
    readonly nextWordCount: number;
}

/**
 * 단어 필터 옵션 (allWords에서 사용)
 */
export interface WordFilter {
    /** 추가 요청 포함 여부 */
    readonly includeAddReq?: boolean;
    /** 삭제 요청 포함 여부 */
    readonly includeDeleteReq?: boolean;
    /** 인정 단어 포함 여부 */
    readonly includeInjung?: boolean;
    /** 노인정 단어 포함 여부 */
    readonly includeNoInjung?: boolean;
    /** 끝말잇기 전용 여부 */
    readonly onlyWordChain?: boolean;
}

/**
 * 단어와 테마 ID 배열이 포함된 타입 (wordsByWords RPC 결과)
 */
export interface WordWithThemeIds extends WordEntity {
    /** 연결된 테마 ID 배열 */
    readonly themeIds: number[];
}

/**
 * 글자별 단어 개수 정보
 */
export interface LetterCountInfo {
    /** 첫 글자별 단어 수 정보 */
    readonly firstLetterCounts: Record<string, FirstLetterCount>;
    /** 마지막 글자별 단어 수 정보 */
    readonly lastLetterCounts: Record<string, LastLetterCount>;
}

/**
 * 첫 글자별 단어 수 상세
 */
export interface FirstLetterCount {
    readonly count: number;
    readonly kCount: number;
    readonly nCount: number;
    readonly len3KCount: number;
    readonly len3NCount: number;
}

/**
 * 마지막 글자별 단어 수 상세
 */
export interface LastLetterCount {
    readonly count: number;
    readonly kCount: number;
    readonly nCount: number;
}

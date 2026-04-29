/**
 * Docs 도메인 엔티티
 *
 * DB의 `docs` 테이블 Row를 도메인 관점에서 표현한 타입입니다.
 */
export interface DocsEntity {
    /** 문제집 고유 ID */
    readonly id: number;
    /** 문제집 이름 */
    readonly name: string;
    /** 문제집 종류 */
    readonly typez: 'letter' | 'theme' | 'ect';
    /** 문제집 작성자 ID */
    readonly maker: string | null;
    /** 기한 있음 여부 */
    readonly duem: boolean;
    /** 숨김 여부 */
    readonly isHidden: boolean;
    /** 조회수 */
    readonly views: number;
    /** 생성 시각 */
    readonly createdAt: string;
    /** 마지막 업데이트 시각 */
    readonly lastUpdate: string;
}

/**
 * 문제집 정보에 사용자 닉네임이 포함된 상세 타입
 */
export interface DocsWithUser extends DocsEntity {
    /** 작성자 닉네임 */
    readonly userNickname: string | null;
}

/**
 * Docs 변경 로그 엔티티
 *
 * DB의 `docs_log` 테이블 Row를 도메인 관점에서 표현한 타입입니다.
 */
export interface DocsLogEntity {
    /** 로그 고유 ID */
    readonly id: number;
    /** 문제집 ID */
    readonly docsId: number;
    /** 단어 문자열 */
    readonly word: string;
    /** 변경 타입 */
    readonly type: 'add' | 'delete';
    /** 변경을 수행한 사용자 ID */
    readonly addBy: string | null;
    /** 변경 시각 */
    readonly date: string;
}

/**
 * 변경 로그에 문제집 이름이 포함된 상세 타입
 */
export interface DocsLogWithDocs extends DocsLogEntity {
    /** 문제집 이름 */
    readonly docsName: string;
}

/**
 * 대기 중인 문제집 요청 엔티티
 *
 * DB의 `wait_docs` 테이블 Row를 도메인 관점에서 표현한 타입입니다.
 */
export interface WaitDocsEntity {
    /** 대기 요청 고유 ID */
    readonly id: number;
    /** 요청한 문제집 이름 */
    readonly docsName: string;
    /** 요청자 ID */
    readonly reqBy: string | null;
    /** 요청 시각 */
    readonly reqAt: string;
}

/**
 * 대기 중인 문제집 요청에 사용자 닉네임이 포함된 상세 타입
 */
export interface WaitDocsWithUser extends WaitDocsEntity {
    /** 요청자 닉네임 */
    readonly userNickname: string | null;
}

/**
 * 새로운 문제집 추가 시 사용하는 입력 타입
 */
export interface NewDocs {
    /** 문제집 이름 */
    readonly name: string;
    /** 작성자 ID */
    readonly maker: string | null;
    /** 기한 있음 여부 */
    readonly duem: boolean;
    /** 문제집 종류 */
    readonly typez: 'letter';
}

/**
 * 새로운 문제집 로그 추가 시 사용하는 입력 타입
 */
export interface NewDocsLog {
    /** 문제집 ID */
    readonly docsId: number;
    /** 단어 문자열 */
    readonly word: string;
    /** 변경 타입 */
    readonly type: 'add' | 'delete';
    /** 변경을 수행한 사용자 ID */
    readonly addBy: string | null;
}

/**
 * Docs 로그 조회 필터 옵션
 */
export interface DocsLogFilter {
    /** 문제집 이름 (선택사항) */
    readonly docsName?: string;
    /** 로그 타입 필터 */
    readonly logType: 'add' | 'delete' | 'all';
    /** 시작 페이지 번호 */
    readonly from: number;
    /** 종료 페이지 번호 */
    readonly to: number;
}

/**
 * 단어 개수 조회 입력 타입
 * letter/theme 타입과 ect 타입에서 서로 다른 파라미터를 요구합니다.
 */
export type DocsWordCountInput =
    | { readonly name: string; readonly duem: boolean; readonly typez: 'letter' | 'theme' }
    | { readonly name: number; readonly duem: boolean; readonly typez: 'ect' };

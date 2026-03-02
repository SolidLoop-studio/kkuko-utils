import type { ThemeEntity } from './ThemeEntity';

/**
 * WaitWord(대기 단어) 도메인 엔티티
 *
 * DB의 `wait_words` 테이블 Row를 도메인 관점에서 표현한 타입입니다.
 */
export interface WaitWordEntity {
    /** 대기 단어 고유 ID */
    readonly id: number;
    /** 대기 단어 문자열 */
    readonly word: string;
    /** 요청 타입 (추가 / 삭제) */
    readonly requestType: 'add' | 'delete';
    /** 요청 상태 */
    readonly status: 'pending' | 'approved' | 'rejected';
    /** 요청한 사용자 ID */
    readonly requestedBy: string | null;
    /** 요청 시각 */
    readonly requestedAt: string;
    /** 삭제 요청 시 원본 단어 ID */
    readonly wordId: number | null;
}

/**
 * 대기 단어 + 사용자 정보 포함 타입
 */
export interface WaitWordWithUser extends WaitWordEntity {
    /** 요청한 사용자 닉네임 */
    readonly userNickname: string | null;
}

/**
 * 대기 단어 + 원본 단어 + 사용자 정보 포함 타입
 */
export interface WaitWordWithDetails extends WaitWordWithUser {
    /** 원본 단어 정보 (삭제 요청 시) */
    readonly originalWord: {
        readonly id: number;
        readonly word: string;
    } | null;
    /** 연결된 테마 목록 */
    readonly themes: ThemeEntity[];
}

/**
 * 새 대기 단어(추가 요청) 입력 타입
 */
export interface NewWaitWordAdd {
    /** 단어 문자열 */
    readonly word: string;
    /** 요청한 사용자 ID */
    readonly requestedBy: string | null;
    /** 요청 타입: 추가 */
    readonly requestType: 'add';
}

/**
 * 새 대기 단어(삭제 요청) 입력 타입
 */
export interface NewWaitWordDelete {
    /** 단어 문자열 */
    readonly word: string;
    /** 요청한 사용자 ID */
    readonly requestedBy: string | null;
    /** 요청 타입: 삭제 */
    readonly requestType: 'delete';
    /** 원본 단어 ID */
    readonly wordId: number;
}

/** 새 대기 단어 입력 타입 (추가 또는 삭제) */
export type NewWaitWord = NewWaitWordAdd | NewWaitWordDelete;

/**
 * 게임 설정 타입 정의
 */
export type GameSetting = {
    /** 언어 설정 ('ko': 한국어, 'en': 영어) */
    lang: 'ko' | 'en';
    /** 게임 모드 ('normal': 일반, 'mission': 미션) */
    mode: 'normal' | 'mission';
    /** 힌트 모드 ('special': 특수, 'auto': 자동) */
    hintMode: 'special' | 'auto';
    /** 한방 단어(한 번 쓰면 다시 못 쓰는 글자) 사용 여부 */
    notAgainSameChar: boolean;
    /** 라운드 시간 (ms) */
    roundTime: number;
    /** 시작 글자 제한 (원하는 시작 글자 집합) */
    wantStartChar: Set<string>;
}

/**
 * 단어 제출 결과 타입
 */
export type SubminWordResult = {
    /** 실패 */
    ok: false;
    /** 실패 사유 (실패 시) */
    reason: string;
} | {
    /** 성공 */
    ok: true;
    /** 제출된 단어 정보 */
    wordEntry: { word: string, theme: string[] };
    /** 다음 시작 글자 */
    nextChar: string;
    /** 다음 미션 글자 (미션 모드 시) */
    nextMissionChar: string | null;
    /** 턴 속도 */
    turnSpeed: number;
    /** 턴 시간 */
    trunTime: number;
}

/**
 * 사용된 단어 기록 타입
 */
export type UsedWord = {
    /** 시작 글자 */
    char: string;
    /** 단어 */
    word: string;
    /** 미션 글자 */
    missionChar: string | null;
    /** 사용된 힌트 횟수 */
    useHintCount: number;
    /** 실패 여부 */
    isFailed?: boolean;
}

/**
 * 현재 게임 상태 (시작 글자, 미션 글자)
 */
export type CurrentState = {
    startChar: string;
    missionChar: string | null;
} | null;
export type IdentityRole = 'guest' | 'r1' | 'r2' | 'r3' | 'r4' | 'admin';

/** 인증 SDK와 분리된 최소 세션 식별자입니다. */
export interface AuthSession {
    userId: string;
}

/** 현재 로그인 사용자를 화면과 전역 상태에 전달하는 공개 projection입니다. */
export interface CurrentUserProfile {
    id: string;
    nickname: string;
    role: IdentityRole;
}

/** 로그아웃 상태와 아직 프로필이 없는 신규 로그인 상태를 구분합니다. */
export type AuthSessionState =
    | { isAuthenticated: false; profile: null }
    | { isAuthenticated: true; profile: CurrentUserProfile | null };

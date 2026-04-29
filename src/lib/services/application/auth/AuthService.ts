import type { Session } from '@supabase/supabase-js';
import type { IAuthRepository } from '../../domain/auth/AuthRepository';
import type { Result, CustomError } from '../../domain/result';

/**
 * Auth 유즈케이스 서비스 (Application Layer)
 *
 * 세션 조회, 로그인/로그아웃, 인증 상태 구독을 담당합니다.
 */
export class AuthService {
    constructor(private readonly authRepo: IAuthRepository) {}

    /**
     * 현재 세션을 조회합니다.
     *
     * @returns 세션 또는 null
     */
    async getSession(): Promise<Result<Session | null, CustomError>> {
        return this.authRepo.getSession();
    }

    /**
     * 현재 JWT를 조회합니다.
     *
     * @returns JWT 또는 null
     */
    async getJWT(): Promise<Result<string | null, CustomError>> {
        return this.authRepo.getJWT();
    }

    /**
     * Google OAuth 로그인을 시작합니다.
     *
     * @param originUrl - OAuth 리다이렉트 기준 URL
     * @returns 처리 결과
     */
    async loginByGoogle(originUrl: string): Promise<Result<void, CustomError>> {
        return this.authRepo.loginByGoogle(originUrl);
    }

    /**
     * 로그아웃합니다.
     *
     * @returns 처리 결과
     */
    async logout(): Promise<Result<void, CustomError>> {
        return this.authRepo.logout();
    }

    /**
     * 인증 상태 변경을 구독합니다.
     *
     * @param callback - 세션 변경 콜백
     * @returns 구독 해제 핸들러
     */
    onAuthStateChange(
        callback: (session: Session | null) => Promise<void>
    ): { unsubscribe: () => void } {
        return this.authRepo.onAuthStateChange(callback);
    }
}

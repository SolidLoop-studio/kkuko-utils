import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import { SupabaseAuthRepository } from './infrastructure/supabase/SupabaseAuthRepository';
import { AuthService } from './application/auth/AuthService';

/**
 * Auth 서비스 컨테이너
 *
 * Supabase 기반 리포지토리를 구성하고 AuthService를 제공합니다.
 */
export class AuthServiceContainer {
    public readonly authService: AuthService;

    constructor(supabase: SupabaseClient<Database>) {
        const authRepo = new SupabaseAuthRepository(supabase);
        this.authService = new AuthService(authRepo);
    }
}

/**
 * AuthServiceContainer 팩토리
 *
 * @param supabase - Supabase 클라이언트
 * @returns AuthServiceContainer 인스턴스
 */
export function createAuthServiceContainer(
    supabase: SupabaseClient<Database>
): AuthServiceContainer {
    return new AuthServiceContainer(supabase);
}

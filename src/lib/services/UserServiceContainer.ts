import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import { SupabaseUserRepository } from './infrastructure/supabase/SupabaseUserRepository';
import { UserService } from './application/user/UserService';

/**
 * User 서비스 컨테이너
 *
 * Supabase 기반 User 리포지토리를 구성하고 UserService를 제공합니다.
 */
export class UserServiceContainer {
    public readonly userService: UserService;

    constructor(supabase: SupabaseClient<Database>) {
        const userRepo = new SupabaseUserRepository(supabase);
        this.userService = new UserService(userRepo);
    }
}

/**
 * UserServiceContainer 팩토리
 *
 * @param supabase - Supabase 클라이언트
 * @returns UserServiceContainer 인스턴스
 */
export function createUserServiceContainer(
    supabase: SupabaseClient<Database>
): UserServiceContainer {
    return new UserServiceContainer(supabase);
}

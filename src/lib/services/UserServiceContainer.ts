import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import { SupabaseUserRepository } from './infrastructure/supabase/SupabaseUserRepository';
import { UserService } from './application/user/UserService';

export class UserServiceContainer {
    public readonly userService: UserService;

    constructor(supabase: SupabaseClient<Database>) {
        const userRepo = new SupabaseUserRepository(supabase);
        this.userService = new UserService(userRepo);
    }
}

export function createUserServiceContainer(
    supabase: SupabaseClient<Database>
): UserServiceContainer {
    return new UserServiceContainer(supabase);
}

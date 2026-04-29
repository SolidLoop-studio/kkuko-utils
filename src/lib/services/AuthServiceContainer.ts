import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import { SupabaseAuthRepository } from './infrastructure/supabase/SupabaseAuthRepository';
import { AuthService } from './application/auth/AuthService';

export class AuthServiceContainer {
    public readonly authService: AuthService;

    constructor(supabase: SupabaseClient<Database>) {
        const authRepo = new SupabaseAuthRepository(supabase);
        this.authService = new AuthService(authRepo);
    }
}

export function createAuthServiceContainer(
    supabase: SupabaseClient<Database>
): AuthServiceContainer {
    return new AuthServiceContainer(supabase);
}

import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import type { IAuthRepository } from '../../domain/auth/AuthRepository';
import type { Result, CustomError } from '../../domain/result';
import { success, failure } from '../../domain/result';
import { infrastructureError } from '../../domain/errors';

export class SupabaseAuthRepository implements IAuthRepository {
    constructor(private readonly supabase: SupabaseClient<Database>) {}

    async getSession(): Promise<Result<Session | null, CustomError>> {
        const { data, error } = await this.supabase.auth.getSession();
        if (error) return failure(infrastructureError({ message: error.message }));
        return success(data.session);
    }

    async getJWT(): Promise<Result<string | null, CustomError>> {
        const { data, error } = await this.supabase.auth.getSession();
        if (error) return failure(infrastructureError({ message: error.message }));
        return success(data.session?.access_token ?? null);
    }

    async loginByGoogle(originUrl: string): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${originUrl}/api/auth/callback` },
        });
        if (error) return failure(infrastructureError({ message: error.message }));
        return success(undefined);
    }

    async logout(): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.auth.signOut();
        if (error) return failure(infrastructureError({ message: error.message }));
        return success(undefined);
    }

    onAuthStateChange(
        callback: (session: Session | null) => Promise<void>
    ): { unsubscribe: () => void } {
        const { data } = this.supabase.auth.onAuthStateChange(async (_event, session) => {
            try {
                await callback(session);
            } finally {}
        });
        return { unsubscribe: () => data.subscription.unsubscribe() };
    }
}

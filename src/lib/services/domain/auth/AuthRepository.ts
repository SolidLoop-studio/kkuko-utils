import type { Session } from '@supabase/supabase-js';
import type { Result, CustomError } from '../result';

export interface IAuthRepository {
    getSession(): Promise<Result<Session | null, CustomError>>;
    getJWT(): Promise<Result<string | null, CustomError>>;
    loginByGoogle(originUrl: string): Promise<Result<void, CustomError>>;
    logout(): Promise<Result<void, CustomError>>;
    onAuthStateChange(
        callback: (session: Session | null) => Promise<void>
    ): { unsubscribe: () => void };
}

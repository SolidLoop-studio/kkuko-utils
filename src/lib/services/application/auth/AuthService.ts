import type { Session } from '@supabase/supabase-js';
import type { IAuthRepository } from '../../domain/auth/AuthRepository';
import type { Result, CustomError } from '../../domain/result';

export class AuthService {
    constructor(private readonly authRepo: IAuthRepository) {}

    async getSession(): Promise<Result<Session | null, CustomError>> {
        return this.authRepo.getSession();
    }

    async getJWT(): Promise<Result<string | null, CustomError>> {
        return this.authRepo.getJWT();
    }

    async loginByGoogle(originUrl: string): Promise<Result<void, CustomError>> {
        return this.authRepo.loginByGoogle(originUrl);
    }

    async logout(): Promise<Result<void, CustomError>> {
        return this.authRepo.logout();
    }

    onAuthStateChange(
        callback: (session: Session | null) => Promise<void>
    ): { unsubscribe: () => void } {
        return this.authRepo.onAuthStateChange(callback);
    }
}

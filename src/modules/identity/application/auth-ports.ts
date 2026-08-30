import type { Result } from '@/src/shared/application/result';
import type { AuthSession } from './auth-types';

export type AuthStateListener = (session: AuthSession | null) => void;

export interface AuthStateSubscription {
    unsubscribe(): void;
}

/** 브라우저 인증 공급자가 제공해야 하는 최소 기능 계약입니다. */
export interface AuthGateway {
    getSession(): Promise<Result<AuthSession | null>>;
    onAuthStateChange(listener: AuthStateListener): Result<AuthStateSubscription>;
    signInWithGoogle(origin: string): Promise<Result<void>>;
    signOut(): Promise<Result<void>>;
}

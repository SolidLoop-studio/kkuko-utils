import { err, type Result } from '@/src/shared/application/result';
import type {
    AuthGateway,
    AuthStateListener,
    AuthStateSubscription,
} from './auth-ports';
import type { AuthSession } from './auth-types';

const restoreError = () => ({
    kind: 'infrastructure' as const,
    message: '로그인 상태를 확인하는 중 오류가 발생했습니다.',
});

const listenerError = () => ({
    kind: 'infrastructure' as const,
    message: '로그인 상태를 연결하는 중 오류가 발생했습니다.',
});

const loginError = () => ({
    kind: 'infrastructure' as const,
    message: 'Google 로그인을 시작하는 중 오류가 발생했습니다.',
});

const logoutError = () => ({
    kind: 'infrastructure' as const,
    message: '로그아웃 중 오류가 발생했습니다.',
});

/** 세션 복원, 상태 구독, Google 로그인과 로그아웃을 조정합니다. */
export class ManageAuthSessionService {
    constructor(private readonly gateway: AuthGateway) {}

    async getSession(): Promise<Result<AuthSession | null>> {
        try {
            return await this.gateway.getSession();
        } catch {
            return err(restoreError());
        }
    }

    onAuthStateChange(listener: AuthStateListener): Result<AuthStateSubscription> {
        try {
            return this.gateway.onAuthStateChange(listener);
        } catch {
            return err(listenerError());
        }
    }

    async signInWithGoogle(origin: string): Promise<Result<void>> {
        try {
            return await this.gateway.signInWithGoogle(origin);
        } catch {
            return err(loginError());
        }
    }

    async signOut(): Promise<Result<void>> {
        try {
            return await this.gateway.signOut();
        } catch {
            return err(logoutError());
        }
    }
}

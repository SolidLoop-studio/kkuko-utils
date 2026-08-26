import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type {
    AuthGateway,
    AuthStateListener,
    AuthStateSubscription,
} from '../../application/auth-ports';
import type { AuthSession } from '../../application/auth-types';

interface AuthResponse {
    data?: unknown;
    error?: unknown;
}

interface SupabaseAuthClientContract {
    auth: {
        getSession(): PromiseLike<AuthResponse>;
        onAuthStateChange(listener: (event: unknown, session: unknown) => void): unknown;
        signInWithOAuth(options: {
            provider: 'google';
            options: { redirectTo: string };
        }): PromiseLike<AuthResponse>;
        signOut(): PromiseLike<AuthResponse>;
    };
}

const restoreError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '로그인 상태를 확인하는 중 오류가 발생했습니다.',
});

const listenerError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '로그인 상태를 연결하는 중 오류가 발생했습니다.',
});

const loginError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: 'Google 로그인을 시작하는 중 오류가 발생했습니다.',
});

const logoutError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '로그아웃 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const parseSession = (value: unknown): AuthSession | null | undefined => {
    if (value === null) return null;
    if (!isRecord(value) || !isRecord(value.user) || typeof value.user.id !== 'string') {
        return undefined;
    }
    return { userId: value.user.id };
};

const parseSessionResponse = (response: unknown): AuthSession | null | undefined => {
    if (!isRecord(response) || response.error !== null || !isRecord(response.data)) {
        return undefined;
    }
    return parseSession(response.data.session);
};

const parseSdkSubscription = (value: unknown): { unsubscribe(): void } | null => {
    if (!isRecord(value) || !isRecord(value.data) || !isRecord(value.data.subscription)) {
        return null;
    }
    return typeof value.data.subscription.unsubscribe === 'function'
        ? value.data.subscription as unknown as { unsubscribe(): void }
        : null;
};

/** Supabase Auth 응답을 identity Application 계약으로 변환합니다. */
export class SupabaseAuthGateway implements AuthGateway {
    constructor(
        private readonly client: SupabaseAuthClientContract = (
            browserSupabaseClient as unknown as SupabaseAuthClientContract
        ),
    ) {}

    async getSession(): Promise<Result<AuthSession | null>> {
        try {
            const response = await this.client.auth.getSession();
            const session = parseSessionResponse(response);
            return session === undefined ? err(restoreError()) : ok(session);
        } catch {
            return err(restoreError());
        }
    }

    onAuthStateChange(listener: AuthStateListener): Result<AuthStateSubscription> {
        try {
            const response = this.client.auth.onAuthStateChange((_event, sessionValue) => {
                const session = parseSession(sessionValue);
                if (session !== undefined) listener(session);
            });
            const sdkSubscription = parseSdkSubscription(response);
            if (sdkSubscription === null) return err(listenerError());

            let isUnsubscribed = false;
            return ok({
                unsubscribe: () => {
                    if (isUnsubscribed) return;
                    isUnsubscribed = true;
                    sdkSubscription.unsubscribe();
                },
            });
        } catch {
            return err(listenerError());
        }
    }

    async signInWithGoogle(origin: string): Promise<Result<void>> {
        try {
            const normalizedOrigin = origin.replace(/\/+$/, '');
            const response = await this.client.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: `${normalizedOrigin}/api/auth/callback` },
            });
            return response.error === null ? ok(undefined) : err(loginError());
        } catch {
            return err(loginError());
        }
    }

    async signOut(): Promise<Result<void>> {
        try {
            const response = await this.client.auth.signOut();
            return response.error === null ? ok(undefined) : err(logoutError());
        } catch {
            return err(logoutError());
        }
    }
}

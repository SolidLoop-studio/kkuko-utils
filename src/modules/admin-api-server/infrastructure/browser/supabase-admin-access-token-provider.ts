import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';

interface BrowserSessionClient {
    auth: {
        getSession(): Promise<unknown>;
    };
}

const unauthorized = () => err<string>({ kind: 'unauthorized', message: '관리자 인증이 필요합니다.' });
const infrastructure = () => err<string>({ kind: 'infrastructure', message: '인증 정보를 확인하는 중 오류가 발생했습니다.' });

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

/** 브라우저 Supabase 세션에서만 비어 있지 않은 관리자 API 토큰을 읽습니다. */
export class SupabaseAdminAccessTokenProvider {
    constructor(private readonly client: BrowserSessionClient = browserSupabaseClient) {}

    async getAccessToken(): Promise<Result<string>> {
        try {
            const response = await this.client.auth.getSession();
            if (!isRecord(response)) return infrastructure();
            if (response.error !== null && response.error !== undefined) return infrastructure();
            if (!isRecord(response.data)) return infrastructure();
            const session = response.data.session;
            if (session === null || session === undefined) return unauthorized();
            if (!isRecord(session)) return infrastructure();
            const token = session.access_token;
            return typeof token === 'string' && token.trim().length > 0 ? ok(token) : unauthorized();
        } catch {
            return infrastructure();
        }
    }
}

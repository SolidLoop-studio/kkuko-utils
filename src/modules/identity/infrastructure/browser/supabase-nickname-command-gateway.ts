import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { IdentityRole } from '../../application/auth-types';
import type { NicknameCommandGateway } from '../../application/nickname-ports';
import type { NicknameRegistrationProfile } from '../../application/nickname-types';

interface HttpResponse {
    ok: boolean;
    json(): PromiseLike<unknown>;
}

type FetchClient = (input: string, init: RequestInit) => PromiseLike<HttpResponse>;

const identityRoles = new Set<IdentityRole>(['guest', 'r1', 'r2', 'r3', 'r4', 'admin']);

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '닉네임 등록 중 오류가 발생했습니다.',
});

const conflictError = (): ApplicationError => ({
    kind: 'conflict',
    code: 'NICKNAME_CONFLICT',
    message: '이미 사용 중인 닉네임입니다.',
});

const unauthorizedError = (): ApplicationError => ({
    kind: 'unauthorized',
    code: 'NICKNAME_UNAUTHORIZED',
    message: '인증이 필요합니다.',
});

const validationError = (): ApplicationError => ({
    kind: 'validation',
    code: 'NICKNAME_INVALID',
    field: 'nickname',
    message: '닉네임을 입력해주세요.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const mapServerError = (value: unknown): ApplicationError => {
    if (!isRecord(value)) return infrastructureError();
    if (value.code === 'NICKNAME_UNAUTHORIZED') return unauthorizedError();
    if (value.code === 'NICKNAME_INVALID') return validationError();
    if (value.code === 'NICKNAME_CONFLICT') return conflictError();
    return infrastructureError();
};

const parseProfile = (
    value: unknown,
    nickname: string,
): NicknameRegistrationProfile | null => {
    if (!isRecord(value)
        || typeof value.id !== 'string'
        || value.id.length === 0
        || value.nickname !== nickname
        || (value.role !== null && !identityRoles.has(value.role as IdentityRole))) {
        return null;
    }
    return {
        id: value.id,
        nickname: value.nickname,
        role: value.role === null ? 'guest' : value.role as IdentityRole,
    };
};

/** 닉네임만 서버 경계로 전달하고 인증 주체에서 생성된 users 행을 검증합니다. */
export class SupabaseNicknameCommandGateway implements NicknameCommandGateway {
    constructor(private readonly fetchClient: FetchClient = fetch) {}

    async register(nickname: string): Promise<Result<NicknameRegistrationProfile>> {
        try {
            const response = await this.fetchClient('/api/auth/set_nickname', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname }),
            });
            const body = await response.json();
            if (!isRecord(body) || !Object.prototype.hasOwnProperty.call(body, 'error')) {
                return err(infrastructureError());
            }
            if (body.error !== null) return err(mapServerError(body.error));
            if (!response.ok) return err(infrastructureError());

            const profile = parseProfile(body.data, nickname);
            return profile === null ? err(infrastructureError()) : ok(profile);
        } catch {
            return err(infrastructureError());
        }
    }
}

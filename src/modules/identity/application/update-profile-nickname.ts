import { err, type Result } from '@/src/shared/application/result';
import type { CurrentUserProfile } from './auth-types';
import { normalizeNickname } from './nickname-types';
import type { ProfileNicknameCommandGateway } from './profile-nickname-command-ports';

const validationError = () => ({
    kind: 'validation' as const,
    code: 'NICKNAME_INVALID',
    field: 'nickname',
    message: '닉네임을 입력해주세요.',
});

const infrastructureError = () => ({
    kind: 'infrastructure' as const,
    message: '닉네임 변경 중 오류가 발생했습니다.',
});

const unauthorizedError = () => ({
    kind: 'unauthorized' as const,
    code: 'NICKNAME_UNAUTHORIZED',
    message: '인증이 필요합니다.',
});

const conflictError = () => ({
    kind: 'conflict' as const,
    code: 'NICKNAME_CONFLICT',
    message: '이미 사용 중인 닉네임입니다.',
});

/** 닉네임만 받으며 실제 변경 주체는 Infrastructure의 인증 경계에서 결정됩니다. */
export class UpdateProfileNicknameService {
    constructor(private readonly gateway: ProfileNicknameCommandGateway) {}

    async update(nickname: string): Promise<Result<CurrentUserProfile>> {
        const normalizedNickname = normalizeNickname(nickname);
        if (normalizedNickname.length === 0) return err(validationError());

        try {
            const result = await this.gateway.update(normalizedNickname);
            if (!result.ok) {
                if (result.error.kind === 'validation') return err(validationError());
                if (result.error.kind === 'unauthorized') return err(unauthorizedError());
                if (result.error.kind === 'conflict') return err(conflictError());
                return err(infrastructureError());
            }
            return result.value.nickname === normalizedNickname
                ? result
                : err(infrastructureError());
        } catch {
            return err(infrastructureError());
        }
    }
}

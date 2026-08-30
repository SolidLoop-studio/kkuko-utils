import { err, type Result } from '@/src/shared/application/result';
import type { NicknameCommandGateway } from './nickname-ports';
import {
    normalizeNickname,
    type NicknameRegistrationProfile,
} from './nickname-types';

const validationError = () => ({
    kind: 'validation' as const,
    field: 'nickname',
    message: '닉네임을 입력해주세요.',
});

const infrastructureError = () => ({
    kind: 'infrastructure' as const,
    message: '닉네임 등록 중 오류가 발생했습니다.',
});

/** 닉네임만 받으며 실제 등록 주체는 Infrastructure의 인증 경계에서 결정됩니다. */
export class RegisterNicknameService {
    constructor(private readonly gateway: NicknameCommandGateway) {}

    async register(nickname: string): Promise<Result<NicknameRegistrationProfile>> {
        const normalizedNickname = normalizeNickname(nickname);
        if (normalizedNickname.length === 0) return err(validationError());

        try {
            const result = await this.gateway.register(normalizedNickname);
            if (!result.ok) return result;
            return result.value.nickname === normalizedNickname
                ? result
                : err(infrastructureError());
        } catch {
            return err(infrastructureError());
        }
    }
}

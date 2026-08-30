import { err, type Result } from '@/src/shared/application/result';
import type { NicknameQueryGateway } from './nickname-ports';
import { normalizeNickname, type NicknameAvailability } from './nickname-types';

const validationError = () => ({
    kind: 'validation' as const,
    field: 'nickname',
    message: '닉네임을 입력해주세요.',
});

const infrastructureError = () => ({
    kind: 'infrastructure' as const,
    message: '닉네임 확인 중 오류가 발생했습니다.',
});

/** 닉네임을 한 번 정규화·검증한 뒤 정확한 중복 여부를 조회합니다. */
export class CheckNicknameAvailabilityService {
    constructor(private readonly gateway: NicknameQueryGateway) {}

    async check(nickname: string): Promise<Result<NicknameAvailability>> {
        const normalizedNickname = normalizeNickname(nickname);
        if (normalizedNickname.length === 0) return err(validationError());

        try {
            const result = await this.gateway.isAvailable(normalizedNickname);
            return result.ok
                ? { ok: true, value: { nickname: normalizedNickname, isAvailable: result.value } }
                : result;
        } catch {
            return err(infrastructureError());
        }
    }
}

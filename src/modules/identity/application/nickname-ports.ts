import type { Result } from '@/src/shared/application/result';
import type { NicknameRegistrationProfile } from './nickname-types';

/** 정규화된 닉네임의 존재 여부만 조회하는 read port입니다. */
export interface NicknameQueryGateway {
    isAvailable(nickname: string): Promise<Result<boolean>>;
}

/** 인증 주체를 받지 않고 정규화된 닉네임만 등록하는 command port입니다. */
export interface NicknameCommandGateway {
    register(nickname: string): Promise<Result<NicknameRegistrationProfile>>;
}

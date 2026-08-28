import type { Result } from '@/src/shared/application/result';
import type { CurrentUserProfile } from './auth-types';

/** 인증 주체를 받지 않고 정규화된 닉네임만 변경하는 command port입니다. */
export interface ProfileNicknameCommandGateway {
    update(nickname: string): Promise<Result<CurrentUserProfile>>;
}

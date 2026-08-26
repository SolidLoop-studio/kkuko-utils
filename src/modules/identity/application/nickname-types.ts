import type { CurrentUserProfile } from './auth-types';

/** 정규화된 닉네임과 현재 사용 가능 여부를 나타냅니다. */
export interface NicknameAvailability {
    nickname: string;
    isAvailable: boolean;
}

/** 닉네임 등록 성공 후 UI와 전역 상태에 전달하는 공개 프로필입니다. */
export type NicknameRegistrationProfile = CurrentUserProfile;

/** 기존 가입 화면과 동일하게 닉네임 양끝의 공백만 제거합니다. */
export const normalizeNickname = (nickname: string): string => nickname.trim();

'use client';

import { useCallback, useRef, useState } from 'react';
import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, type Result } from '@/src/shared/application/result';
import type { CurrentUserProfile } from '../application/auth-types';
import type { UpdateProfileNicknameService } from '../application/update-profile-nickname';
import { createBrowserIdentityServices } from '../infrastructure/browser/browser-identity-services';

type ProfileNicknameUpdateService = Pick<UpdateProfileNicknameService, 'update'>;

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '닉네임 변경 중 오류가 발생했습니다.',
});

/** 프로필 닉네임 변경 상태와 겹치는 제출을 하나의 command로 관리합니다. */
export const useProfileNicknameUpdate = (service?: ProfileNicknameUpdateService) => {
    const [resolvedService] = useState<ProfileNicknameUpdateService>(() => (
        service ?? createBrowserIdentityServices().profileNicknameUpdateService
    ));
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<ApplicationError | null>(null);
    const pendingPromise = useRef<Promise<Result<CurrentUserProfile>> | null>(null);

    const updateProfileNickname = useCallback((nickname: string) => {
        if (pendingPromise.current !== null) return pendingPromise.current;

        setIsPending(true);
        setError(null);
        const action = (async (): Promise<Result<CurrentUserProfile>> => {
            try {
                const result = await resolvedService.update(nickname);
                if (!result.ok) setError(result.error);
                return result;
            } catch {
                const safeError = infrastructureError();
                setError(safeError);
                return err(safeError);
            } finally {
                pendingPromise.current = null;
                setIsPending(false);
            }
        })();
        pendingPromise.current = action;
        return action;
    }, [resolvedService]);

    return {
        updateProfileNickname,
        isPending,
        error,
        clearError: () => setError(null),
    };
};

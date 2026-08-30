'use client';

import { useCallback, useRef, useState } from 'react';
import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, type Result } from '@/src/shared/application/result';
import type { CheckNicknameAvailabilityService } from '../application/check-nickname-availability';
import type { NicknameRegistrationProfile } from '../application/nickname-types';
import type { RegisterNicknameService } from '../application/register-nickname';
import { createBrowserIdentityServices } from '../infrastructure/browser/browser-identity-services';

export interface NicknameRegistrationServices {
    checkNicknameAvailabilityService: Pick<CheckNicknameAvailabilityService, 'check'>;
    registerNicknameService: Pick<RegisterNicknameService, 'register'>;
}

const conflictError = (): ApplicationError => ({
    kind: 'conflict',
    code: 'NICKNAME_CONFLICT',
    message: '이미 사용 중인 닉네임입니다.',
});

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '닉네임 등록 중 오류가 발생했습니다.',
});

/** 닉네임 확인·등록 순서와 겹치는 제출을 하나의 UI 동작으로 관리합니다. */
export const useNicknameRegistration = (services?: NicknameRegistrationServices) => {
    const [resolvedServices] = useState<NicknameRegistrationServices>(() => {
        if (services) return services;
        const browserServices = createBrowserIdentityServices();
        return {
            checkNicknameAvailabilityService: browserServices.checkNicknameAvailabilityService,
            registerNicknameService: browserServices.registerNicknameService,
        };
    });
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<ApplicationError | null>(null);
    const pendingPromise = useRef<Promise<Result<NicknameRegistrationProfile>> | null>(null);

    const registerNickname = useCallback((nickname: string) => {
        if (pendingPromise.current !== null) return pendingPromise.current;

        setIsPending(true);
        setError(null);
        const action = (async (): Promise<Result<NicknameRegistrationProfile>> => {
            try {
                const availability = await resolvedServices.checkNicknameAvailabilityService
                    .check(nickname);
                if (!availability.ok) {
                    setError(availability.error);
                    return availability;
                }
                if (!availability.value.isAvailable) {
                    const unavailable = conflictError();
                    setError(unavailable);
                    return err(unavailable);
                }

                const result = await resolvedServices.registerNicknameService
                    .register(availability.value.nickname);
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
    }, [resolvedServices]);

    return {
        registerNickname,
        isPending,
        error,
        clearError: () => setError(null),
    };
};

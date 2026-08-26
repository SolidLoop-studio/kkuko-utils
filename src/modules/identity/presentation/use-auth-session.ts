'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { AuthStateSubscription } from '../application/auth-ports';
import type { AuthSession, AuthSessionState } from '../application/auth-types';
import type { GetCurrentUserProfileService } from '../application/get-current-user-profile';
import type { ManageAuthSessionService } from '../application/manage-auth-session';
import { createBrowserIdentityServices } from '../infrastructure/browser/browser-identity-services';

export type AuthSessionService = Pick<
    ManageAuthSessionService,
    'getSession' | 'onAuthStateChange' | 'signInWithGoogle' | 'signOut'
>;
export type CurrentUserProfileQueryService = Pick<GetCurrentUserProfileService, 'get'>;

const profileError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '사용자 정보를 불러오는 중 오류가 발생했습니다.',
});

/** Auth session과 별도 공개 profile query를 lifecycle-safe UI 동작으로 조합합니다. */
export const useAuthSession = () => {
    const [services] = useState(() => createBrowserIdentityServices());
    const activeSubscriptions = useRef(new Set<() => void>());
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            const subscriptions = Array.from(activeSubscriptions.current);
            subscriptions.forEach((unsubscribe) => unsubscribe());
            activeSubscriptions.current.clear();
        };
    }, []);

    const resolveSession = useCallback(async (
        session: AuthSession | null,
    ): Promise<Result<AuthSessionState>> => {
        if (session === null) {
            return ok({ isAuthenticated: false, profile: null });
        }
        try {
            const profileResult = await services.currentUserProfileQueryService.get(session.userId);
            if (!profileResult.ok) return profileResult;
            return ok({ isAuthenticated: true, profile: profileResult.value });
        } catch {
            return err(profileError());
        }
    }, [services]);

    const getSession = useCallback(
        () => services.authSessionService.getSession(),
        [services],
    );

    const restore = useCallback(async (): Promise<Result<AuthSessionState>> => {
        const sessionResult = await getSession();
        return sessionResult.ok ? resolveSession(sessionResult.value) : sessionResult;
    }, [getSession, resolveSession]);

    const listen = useCallback((
        listener: (result: Result<AuthSessionState>) => void,
    ): Result<AuthStateSubscription> => {
        let isActive = true;
        let latestRequest = 0;
        const subscriptionResult = services.authSessionService.onAuthStateChange((session) => {
            const request = ++latestRequest;
            void resolveSession(session).then((result) => {
                if (isMounted.current && isActive && request === latestRequest) listener(result);
            });
        });
        if (!subscriptionResult.ok) return subscriptionResult;

        let isUnsubscribed = false;
        const unsubscribe = () => {
            if (isUnsubscribed) return;
            isUnsubscribed = true;
            isActive = false;
            latestRequest += 1;
            subscriptionResult.value.unsubscribe();
            activeSubscriptions.current.delete(unsubscribe);
        };
        activeSubscriptions.current.add(unsubscribe);
        return ok({ unsubscribe });
    }, [resolveSession, services]);

    const signInWithGoogle = useCallback(
        (origin: string) => services.authSessionService.signInWithGoogle(origin),
        [services],
    );
    const signOut = useCallback(
        () => services.authSessionService.signOut(),
        [services],
    );

    return { getSession, listen, restore, signInWithGoogle, signOut };
};

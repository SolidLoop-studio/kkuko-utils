import { act, renderHook, waitFor } from '@testing-library/react';

jest.mock(
    '../../../../modules/identity/infrastructure/browser/browser-identity-services',
    () => ({ createBrowserIdentityServices: jest.fn() }),
);

import type { AuthStateListener } from '@/src/modules/identity/application/auth-ports';
import type { CurrentUserProfile } from '@/src/modules/identity/application/auth-types';
import { createBrowserIdentityServices } from '@/src/modules/identity/infrastructure/browser/browser-identity-services';
import { useAuthSession } from '@/src/modules/identity/presentation/use-auth-session';
import { err, ok, type Result } from '@/src/shared/application/result';

const profileError = {
    kind: 'infrastructure' as const,
    message: '사용자 정보를 불러오는 중 오류가 발생했습니다.',
};

const createDeferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
    return { promise, resolve };
};

const arrangeServices = ({
    getProfile = async () => ok(null),
    getSession = async () => ok(null),
}: {
    getProfile?: (userId: string) => Promise<Result<CurrentUserProfile | null>>;
    getSession?: () => Promise<Result<{ userId: string } | null>>;
} = {}) => {
    let authListener: AuthStateListener | undefined;
    const unsubscribe = jest.fn();
    const services = {
        authSessionService: {
            getSession: jest.fn(getSession),
            onAuthStateChange: jest.fn((listener: AuthStateListener) => {
                authListener = listener;
                return ok({ unsubscribe });
            }),
            signInWithGoogle: jest.fn().mockResolvedValue(ok(undefined)),
            signOut: jest.fn().mockResolvedValue(ok(undefined)),
        },
        currentUserProfileQueryService: {
            get: jest.fn(getProfile),
        },
    };
    jest.mocked(createBrowserIdentityServices).mockReturnValue(
        services as unknown as ReturnType<typeof createBrowserIdentityServices>,
    );
    return { authListener: () => authListener, services, unsubscribe };
};

describe('useAuthSession', () => {
    test('distinguishes no session from an authenticated user without a profile', async () => {
        // Break caught: collapsing logged-out and first-time-user states into the same null value.
        arrangeServices({ getSession: async () => ok(null) });
        const { result, unmount } = renderHook(() => useAuthSession());
        await expect(result.current.restore()).resolves.toEqual(ok({
            isAuthenticated: false,
            profile: null,
        }));
        unmount();

        arrangeServices({
            getSession: async () => ok({ userId: 'user-1' }),
            getProfile: async () => ok(null),
        });
        const nextHook = renderHook(() => useAuthSession());
        await expect(nextHook.result.current.restore()).resolves.toEqual(ok({
            isAuthenticated: true,
            profile: null,
        }));
    });

    test('returns the public profile or its stable error during restore', async () => {
        // Break caught: bypassing the separate profile query or discarding its safe failure.
        const profile = { id: 'user-1', nickname: '테스터', role: 'r3' as const };
        arrangeServices({
            getSession: async () => ok({ userId: 'user-1' }),
            getProfile: async () => ok(profile),
        });
        const successHook = renderHook(() => useAuthSession());
        await expect(successHook.result.current.restore()).resolves.toEqual(ok({
            isAuthenticated: true,
            profile,
        }));
        successHook.unmount();

        arrangeServices({
            getSession: async () => ok({ userId: 'user-1' }),
            getProfile: async () => err(profileError),
        });
        const failureHook = renderHook(() => useAuthSession());
        await expect(failureHook.result.current.restore()).resolves.toEqual(err(profileError));
    });

    test('ignores a stale profile response from an older auth event', async () => {
        // Break caught: a slow previous session overwriting the latest authenticated user.
        const first = createDeferred<Result<CurrentUserProfile | null>>();
        const second = createDeferred<Result<CurrentUserProfile | null>>();
        const { authListener } = arrangeServices({
            getProfile: (userId) => userId === 'user-1' ? first.promise : second.promise,
        });
        const { result } = renderHook(() => useAuthSession());
        const observed: unknown[] = [];

        let subscription!: ReturnType<typeof result.current.listen>;
        act(() => { subscription = result.current.listen((state) => observed.push(state)); });
        act(() => {
            authListener()?.({ userId: 'user-1' });
            authListener()?.({ userId: 'user-2' });
        });
        await act(async () => {
            second.resolve(ok({ id: 'user-2', nickname: '둘', role: 'r2' }));
        });
        await waitFor(() => expect(observed).toEqual([ok({
            isAuthenticated: true,
            profile: { id: 'user-2', nickname: '둘', role: 'r2' },
        })]));

        await act(async () => {
            first.resolve(ok({ id: 'user-1', nickname: '하나', role: 'r1' }));
        });
        expect(observed).toHaveLength(1);
        expect(subscription.ok).toBe(true);
    });

    test('unsubscribes once and silences pending profile work after unmount', async () => {
        // Break caught: listener/profile callbacks mutating an unmounted component or double-unsubscribing the SDK.
        const pending = createDeferred<Result<CurrentUserProfile | null>>();
        const { authListener, unsubscribe } = arrangeServices({ getProfile: async () => pending.promise });
        const { result, unmount } = renderHook(() => useAuthSession());
        const observer = jest.fn();
        const subscription = result.current.listen(observer);

        act(() => authListener()?.({ userId: 'user-1' }));
        unmount();
        if (subscription.ok) {
            subscription.value.unsubscribe();
            subscription.value.unsubscribe();
        }
        await act(async () => pending.resolve(ok({ id: 'user-1', nickname: '늦음', role: 'guest' })));

        expect(unsubscribe).toHaveBeenCalledTimes(1);
        expect(observer).not.toHaveBeenCalled();
    });

});

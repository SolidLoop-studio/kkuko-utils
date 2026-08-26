jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: {},
}));

import { SupabaseAuthGateway } from '@/src/modules/identity/infrastructure/browser/supabase-auth-gateway';
import { err, ok } from '@/src/shared/application/result';

type AuthCallback = (event: unknown, session: unknown) => void;

const createClient = () => {
    let callback: AuthCallback | undefined;
    const sdkUnsubscribe = jest.fn();
    const auth = {
        getSession: jest.fn(),
        onAuthStateChange: jest.fn((nextCallback: AuthCallback) => {
            callback = nextCallback;
            return { data: { subscription: { unsubscribe: sdkUnsubscribe } } };
        }),
        signInWithOAuth: jest.fn(),
        signOut: jest.fn(),
    };
    const gateway = new SupabaseAuthGateway({ auth });
    return { auth, callback: () => callback, gateway, sdkUnsubscribe };
};

describe('SupabaseAuthGateway', () => {
    test.each([
        ['a session', { data: { session: { user: { id: 'user-1' }, access_token: 'secret' } }, error: null }, ok({ userId: 'user-1' })],
        ['no session', { data: { session: null }, error: null }, ok(null)],
    ])('projects %s to the minimum application shape', async (_description, response, expected) => {
        // Break caught: leaking access tokens or the SDK Session object through the auth port.
        const { auth, gateway } = createClient();
        auth.getSession.mockResolvedValue(response);

        await expect(gateway.getSession()).resolves.toEqual(expected);
    });

    test.each([
        ['returned errors', { data: { session: null }, error: { message: 'private auth error' } }],
        ['malformed sessions', { data: { session: { user: {} } }, error: null }],
    ])('maps %s to a stable restore error', async (_description, response) => {
        // Break caught: exposing raw auth response details or accepting malformed identity data.
        const { auth, gateway } = createClient();
        auth.getSession.mockResolvedValue(response);

        await expect(gateway.getSession()).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '로그인 상태를 확인하는 중 오류가 발생했습니다.',
        }));
    });

    test('projects listener sessions and unsubscribes the SDK listener idempotently', () => {
        // Break caught: leaking the SDK event/subscription contract or unsubscribing more than once.
        const { callback, gateway, sdkUnsubscribe } = createClient();
        const listener = jest.fn();

        const subscriptionResult = gateway.onAuthStateChange(listener);
        expect(subscriptionResult.ok).toBe(true);
        callback()?.('SIGNED_IN', { user: { id: 'user-2' }, access_token: 'secret' });
        callback()?.('SIGNED_OUT', null);

        expect(listener).toHaveBeenNthCalledWith(1, { userId: 'user-2' });
        expect(listener).toHaveBeenNthCalledWith(2, null);
        if (subscriptionResult.ok) {
            subscriptionResult.value.unsubscribe();
            subscriptionResult.value.unsubscribe();
        }
        expect(sdkUnsubscribe).toHaveBeenCalledTimes(1);
    });

    test('uses the browser origin for the Google callback and discards OAuth payloads', async () => {
        // Break caught: redirecting OAuth to the wrong deployment or leaking the provider response.
        const { auth, gateway } = createClient();
        auth.signInWithOAuth.mockResolvedValue({ data: { provider: 'google', url: 'secret-url' }, error: null });

        await expect(gateway.signInWithGoogle('https://kkuko.example/')).resolves.toEqual(ok(undefined));
        expect(auth.signInWithOAuth).toHaveBeenCalledWith({
            provider: 'google',
            options: { redirectTo: 'https://kkuko.example/api/auth/callback' },
        });
    });

    test('maps sign-out errors to a stable application error', async () => {
        // Break caught: reporting the provider's raw logout error to presentation.
        const { auth, gateway } = createClient();
        auth.signOut.mockResolvedValue({ error: { message: 'refresh token secret' } });

        await expect(gateway.signOut()).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '로그아웃 중 오류가 발생했습니다.',
        }));
    });
});

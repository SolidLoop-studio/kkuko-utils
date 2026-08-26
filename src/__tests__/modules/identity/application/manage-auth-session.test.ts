import { ManageAuthSessionService } from '@/src/modules/identity/application/manage-auth-session';
import type {
    AuthGateway,
    AuthStateListener,
} from '@/src/modules/identity/application/auth-ports';
import type { AuthSession } from '@/src/modules/identity/application/auth-types';
import { err, ok } from '@/src/shared/application/result';

const createGateway = () => {
    const unsubscribe = jest.fn();
    const gateway: jest.Mocked<AuthGateway> = {
        getSession: jest.fn(),
        onAuthStateChange: jest.fn((_listener: AuthStateListener) => ok({ unsubscribe })),
        signInWithGoogle: jest.fn(),
        signOut: jest.fn(),
    };
    return { gateway, unsubscribe };
};

describe('ManageAuthSessionService', () => {
    test.each<[string, AuthSession | null]>([
        ['an authenticated session', { userId: 'user-1' }],
        ['no session', null],
    ])('returns %s without exposing an SDK session', async (_description, session) => {
        // Break caught: restoring auth through an SDK-shaped response instead of the application projection.
        const { gateway } = createGateway();
        gateway.getSession.mockResolvedValue(ok(session));

        await expect(new ManageAuthSessionService(gateway).getSession()).resolves.toEqual(ok(session));
    });

    test('maps a rejected restore to a stable application error', async () => {
        // Break caught: allowing a raw SDK exception to escape the application boundary.
        const { gateway } = createGateway();
        gateway.getSession.mockRejectedValue(new Error('private SDK failure'));

        await expect(new ManageAuthSessionService(gateway).getSession()).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '로그인 상태를 확인하는 중 오류가 발생했습니다.',
        }));
    });

    test('returns the explicit listener subscription owned by the auth port', () => {
        // Break caught: hiding listener cleanup behind an SDK subscription shape.
        const { gateway, unsubscribe } = createGateway();
        const listener: AuthStateListener = jest.fn();

        const result = new ManageAuthSessionService(gateway).onAuthStateChange(listener);

        expect(result).toEqual(ok({ unsubscribe }));
        expect(gateway.onAuthStateChange).toHaveBeenCalledWith(listener);
    });

    test('passes the browser origin to Google login', async () => {
        // Break caught: losing the deployment origin used to build the OAuth callback URL.
        const { gateway } = createGateway();
        gateway.signInWithGoogle.mockResolvedValue(ok(undefined));

        await expect(
            new ManageAuthSessionService(gateway).signInWithGoogle('https://kkuko.example'),
        ).resolves.toEqual(ok(undefined));
        expect(gateway.signInWithGoogle).toHaveBeenCalledWith('https://kkuko.example');
    });

    test('maps a rejected logout to a stable application error', async () => {
        // Break caught: rejecting logout with an SDK error that presentation could render.
        const { gateway } = createGateway();
        gateway.signOut.mockRejectedValue(new Error('token contents'));

        await expect(new ManageAuthSessionService(gateway).signOut()).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '로그아웃 중 오류가 발생했습니다.',
        }));
    });
});

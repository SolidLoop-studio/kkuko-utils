import { configureStore } from '@reduxjs/toolkit';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import type { ReactNode } from 'react';

const routerPush = jest.fn();
const router = { push: routerPush };
jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('../../modules/identity', () => ({
    useAuthSession: jest.fn(),
    useNicknameRegistration: jest.fn(),
}));
jest.mock('../../app/components/ui/card', () => ({
    Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CardDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
import Auth from '@/src/app/auth/auth';
import { userReducer } from '@/src/app/store/slice';
import type {
    AuthSessionState,
    useAuthSession,
    useNicknameRegistration,
} from '@/src/modules/identity';
import {
    useAuthSession as useAuthSessionMockTarget,
    useNicknameRegistration as useNicknameRegistrationMockTarget,
} from '@/src/modules/identity';
import { err, ok, type Result } from '@/src/shared/application/result';

const arrange = () => {
    let listener: ((result: Result<AuthSessionState>) => void) | undefined;
    const unsubscribe = jest.fn();
    const signInWithGoogle = jest.fn().mockResolvedValue(ok(undefined));
    const registerNickname = jest.fn().mockResolvedValue(ok({
        id: 'new-user-1',
        nickname: '신규사용자',
        role: 'guest',
    }));
    jest.mocked(useAuthSessionMockTarget).mockReturnValue({
        getSession: jest.fn().mockResolvedValue(ok(null)),
        listen: jest.fn((nextListener) => {
            listener = nextListener;
            return ok({ unsubscribe });
        }),
        restore: jest.fn(),
        signInWithGoogle,
        signOut: jest.fn(),
    } as ReturnType<typeof useAuthSession>);
    jest.mocked(useNicknameRegistrationMockTarget).mockReturnValue({
        registerNickname,
        isPending: false,
        error: null,
        clearError: jest.fn(),
    } as ReturnType<typeof useNicknameRegistration>);
    const store = configureStore({ reducer: { user: userReducer } });
    const view = render(<Provider store={store}><Auth /></Provider>);
    return {
        ...view,
        listener: () => listener,
        registerNickname,
        signInWithGoogle,
        store,
        unsubscribe,
    };
};

describe('Auth', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('stops loading for a signed-out auth event and unsubscribes on unmount', async () => {
        // Break caught: leaving the login screen blocked or leaking its auth listener.
        const { listener, unmount, unsubscribe } = arrange();

        act(() => listener()?.(ok({ isAuthenticated: false, profile: null })));
        expect(await screen.findByRole('button', { name: 'Google로 계속하기' })).toBeEnabled();
        unmount();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    test('shows nickname registration when an authenticated user has no profile', async () => {
        // Break caught: redirecting a first-time Google user before profile registration.
        const { listener } = arrange();

        act(() => listener()?.(ok({ isAuthenticated: true, profile: null })));

        expect(await screen.findByText('회원가입')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('닉네임을 입력하세요')).toBeEnabled();
    });

    test('returns from nickname registration to Google login after a signed-out event', async () => {
        // Break caught: retaining the new-user form after the authenticated session disappears.
        const { listener } = arrange();
        act(() => listener()?.(ok({ isAuthenticated: true, profile: null })));
        expect(await screen.findByPlaceholderText('닉네임을 입력하세요')).toBeInTheDocument();

        act(() => listener()?.(ok({ isAuthenticated: false, profile: null })));

        expect(await screen.findByRole('button', { name: 'Google로 계속하기' })).toBeEnabled();
        expect(screen.queryByPlaceholderText('닉네임을 입력하세요')).not.toBeInTheDocument();
    });

    test('clears the stale new-user form when a later event has a profile', async () => {
        // Break caught: leaving nickname registration visible while navigating an existing user.
        const { listener } = arrange();
        act(() => listener()?.(ok({ isAuthenticated: true, profile: null })));
        expect(await screen.findByPlaceholderText('닉네임을 입력하세요')).toBeInTheDocument();

        act(() => listener()?.(ok({
            isAuthenticated: true,
            profile: { id: 'user-1', nickname: '테스터', role: 'r2' },
        })));

        await waitFor(() => expect(routerPush).toHaveBeenCalledWith('/profile/테스터'));
        expect(screen.queryByPlaceholderText('닉네임을 입력하세요')).not.toBeInTheDocument();
    });

    test.each([
        ['admin users', 'admin' as const, '/admin'],
        ['regular users', 'r2' as const, '/profile/테스터'],
    ])('stores the full profile and preserves navigation for %s', async (_description, role, destination) => {
        // Break caught: dropping the user ID or changing the existing post-login destination.
        const { listener, store } = arrange();

        act(() => listener()?.(ok({
            isAuthenticated: true,
            profile: { id: 'user-1', nickname: '테스터', role },
        })));

        await waitFor(() => expect(routerPush).toHaveBeenCalledWith(destination));
        expect(store.getState().user).toEqual({ username: '테스터', uuid: 'user-1', role });
    });

    test('starts Google login with the browser origin', async () => {
        // Break caught: sending a hard-coded or path-bearing OAuth origin to the identity gateway.
        const user = userEvent.setup();
        const { listener, signInWithGoogle } = arrange();
        act(() => listener()?.(ok({ isAuthenticated: false, profile: null })));

        await user.click(await screen.findByRole('button', { name: 'Google로 계속하기' }));

        expect(signInWithGoogle).toHaveBeenCalledWith(window.location.origin);
    });

    test('renders only a stable auth error when login fails', async () => {
        // Break caught: placing raw provider error details in the existing error modal.
        const user = userEvent.setup();
        const { listener, signInWithGoogle } = arrange();
        signInWithGoogle.mockResolvedValue(err({
            kind: 'infrastructure',
            message: 'Google 로그인을 시작하는 중 오류가 발생했습니다.',
            cause: new Error('private provider details'),
        }));
        act(() => listener()?.(ok({ isAuthenticated: false, profile: null })));

        await user.click(await screen.findByRole('button', { name: 'Google로 계속하기' }));

        expect(await screen.findByText('Google 로그인을 시작하는 중 오류가 발생했습니다.')).toBeInTheDocument();
        expect(screen.queryByText('private provider details')).not.toBeInTheDocument();
    });

    test('registers with a nickname-only command, stores the projected profile, and navigates home', async () => {
        // Break caught: retaining SCM/getSession orchestration or losing successful Redux/navigation semantics.
        const user = userEvent.setup();
        const { listener, registerNickname, store } = arrange();
        registerNickname.mockResolvedValue(ok({
            id: 'new-user-1',
            nickname: '테스터',
            role: 'r2',
        }));
        act(() => listener()?.(ok({ isAuthenticated: true, profile: null })));

        await user.type(await screen.findByPlaceholderText('닉네임을 입력하세요'), '  테스터  ');
        await user.click(screen.getByRole('button', { name: '회원가입 완료' }));

        expect(registerNickname).toHaveBeenCalledWith('  테스터  ');
        await waitFor(() => expect(store.getState().user).toEqual({
            username: '테스터',
            uuid: 'new-user-1',
            role: 'r2',
        }));
        expect(routerPush).toHaveBeenCalledWith('/');
    });

    test('shows an unavailable nickname inline and does not navigate', async () => {
        // Break caught: opening a raw database modal for the expected duplicate nickname case.
        const user = userEvent.setup();
        const { listener, registerNickname } = arrange();
        registerNickname.mockResolvedValue(err({
            kind: 'conflict',
            message: '이미 사용 중인 닉네임입니다.',
            code: 'NICKNAME_CONFLICT',
        }));
        act(() => listener()?.(ok({ isAuthenticated: true, profile: null })));

        await user.type(await screen.findByPlaceholderText('닉네임을 입력하세요'), '테스터');
        await user.click(screen.getByRole('button', { name: '회원가입 완료' }));

        expect(await screen.findByText('이미 사용 중인 닉네임입니다.')).toBeInTheDocument();
        expect(routerPush).not.toHaveBeenCalled();
    });

    test('renders only the stable registration error in the existing Modal', async () => {
        // Break caught: showing raw auth/database causes or codes in the registration Modal.
        const user = userEvent.setup();
        const { listener, registerNickname } = arrange();
        registerNickname.mockResolvedValue(err({
            kind: 'infrastructure',
            message: '닉네임 등록 중 오류가 발생했습니다.',
            cause: new Error('private database detail'),
            code: 'XX999',
        }));
        act(() => listener()?.(ok({ isAuthenticated: true, profile: null })));

        await user.type(await screen.findByPlaceholderText('닉네임을 입력하세요'), '테스터');
        await user.click(screen.getByRole('button', { name: '회원가입 완료' }));

        expect(await screen.findByText('닉네임 등록 중 오류가 발생했습니다.')).toBeInTheDocument();
        expect(screen.queryByText('private database detail')).not.toBeInTheDocument();
        expect(screen.queryByText('XX999')).not.toBeInTheDocument();
        expect(routerPush).not.toHaveBeenCalled();
    });
});

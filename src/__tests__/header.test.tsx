import { configureStore } from '@reduxjs/toolkit';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';

const routerPush = jest.fn();
jest.mock('next/navigation', () => ({
    usePathname: () => '/word',
    useRouter: () => ({ push: routerPush }),
}));
jest.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light', setTheme: jest.fn() }) }));
jest.mock('../modules/identity', () => ({ useAuthSession: jest.fn() }));

import Header from '@/src/app/header';
import { userAction, userReducer } from '@/src/app/store/slice';
import { useAuthSession } from '@/src/modules/identity';
import { err, ok, type Result } from '@/src/shared/application/result';

const createDeferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
    return { promise, resolve };
};

const renderLoggedInHeader = (signOut: () => Promise<Result<void>>) => {
    jest.mocked(useAuthSession).mockReturnValue({ signOut } as ReturnType<typeof useAuthSession>);
    const store = configureStore({ reducer: { user: userReducer } });
    store.dispatch(userAction.setInfo({ username: '테스터', uuid: 'user-1', role: 'r4' }));
    return {
        ...render(<Provider store={store}><Header /></Provider>),
        store,
    };
};

describe('Header logout', () => {
    test('clears Redux and navigates home only after sign-out resolves', async () => {
        // Break caught: optimistically losing local identity before remote logout succeeds.
        const user = userEvent.setup();
        const pending = createDeferred<Result<void>>();
        const { store } = renderLoggedInHeader(() => pending.promise);

        await user.click(screen.getByRole('button', { name: '로그아웃' }));
        expect(store.getState().user).toEqual({ username: '테스터', uuid: 'user-1', role: 'r4' });
        expect(routerPush).not.toHaveBeenCalled();

        await act(async () => pending.resolve(ok(undefined)));

        expect(store.getState().user).toEqual({ username: undefined, uuid: undefined, role: 'guest' });
        expect(routerPush).toHaveBeenCalledWith('/');
    });

    test('keeps identity and navigation and shows a stable modal when sign-out fails', async () => {
        // Break caught: clearing a still-authenticated user or rendering raw SDK logout details.
        const user = userEvent.setup();
        const { store } = renderLoggedInHeader(async () => err({
            kind: 'infrastructure',
            message: '로그아웃 중 오류가 발생했습니다.',
            cause: new Error('private refresh token'),
        }));

        await user.click(screen.getByRole('button', { name: '로그아웃' }));

        expect(await screen.findByText('로그아웃 중 오류가 발생했습니다.')).toBeInTheDocument();
        expect(screen.queryByText('private refresh token')).not.toBeInTheDocument();
        expect(store.getState().user).toEqual({ username: '테스터', uuid: 'user-1', role: 'r4' });
        expect(routerPush).not.toHaveBeenCalled();
    });
});

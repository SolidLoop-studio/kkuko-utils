import { configureStore } from '@reduxjs/toolkit';
import { render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';

jest.mock('../modules/identity', () => ({ useAuthSession: jest.fn() }));

import AutoLogin from '@/src/app/AutoLogin';
import { userReducer } from '@/src/app/store/slice';
import { useAuthSession } from '@/src/modules/identity';
import { err, ok, type Result } from '@/src/shared/application/result';

const renderAutoLogin = (restore: () => Promise<Result<{
    isAuthenticated: boolean;
    profile: { id: string; nickname: string; role: 'guest' | 'r1' | 'r2' | 'r3' | 'r4' | 'admin' } | null;
}>>) => {
    jest.mocked(useAuthSession).mockReturnValue({
        restore,
    } as ReturnType<typeof useAuthSession>);
    const store = configureStore({ reducer: { user: userReducer } });
    const view = render(<Provider store={store}><AutoLogin /></Provider>);
    return { ...view, store };
};

describe('AutoLogin', () => {
    test('restores the projected profile into Redux exactly once across rerenders', async () => {
        // Break caught: repeating session/profile requests on every render or dropping the projected UUID.
        const restore = jest.fn().mockResolvedValue(ok({
            isAuthenticated: true,
            profile: { id: 'user-1', nickname: '테스터', role: 'r4' },
        }));
        const { rerender, store } = renderAutoLogin(restore);

        await waitFor(() => expect(store.getState().user).toEqual({
            username: '테스터',
            uuid: 'user-1',
            role: 'r4',
        }));
        rerender(<Provider store={store}><AutoLogin /></Provider>);
        expect(restore).toHaveBeenCalledTimes(1);
    });

    test.each([
        ['no session', ok({ isAuthenticated: false, profile: null })],
        ['a stable restore error', err({ kind: 'infrastructure' as const, message: '로그인 상태를 확인하는 중 오류가 발생했습니다.' })],
    ])('leaves Redux unchanged for %s', async (_description, restoreResult) => {
        // Break caught: clearing or corrupting guest state when silent automatic restore cannot produce a user.
        const { store } = renderAutoLogin(async () => restoreResult);

        await waitFor(() => expect(store.getState().user).toEqual({
            username: undefined,
            uuid: undefined,
            role: 'guest',
        }));
    });

    test('does not dispatch a late restore after unmount', async () => {
        // Break caught: an unresolved restore mutating Redux after its owner unmounts.
        let resolve!: (value: Result<{
            isAuthenticated: boolean;
            profile: { id: string; nickname: string; role: 'admin' } | null;
        }>) => void;
        const restore = jest.fn(() => new Promise<Result<{
            isAuthenticated: boolean;
            profile: { id: string; nickname: string; role: 'admin' } | null;
        }>>((nextResolve) => { resolve = nextResolve; }));
        const { store, unmount } = renderAutoLogin(restore);

        unmount();
        resolve(ok({
            isAuthenticated: true,
            profile: { id: 'late', nickname: '늦음', role: 'admin' },
        }));
        await Promise.resolve();

        expect(store.getState().user.username).toBeUndefined();
    });
});

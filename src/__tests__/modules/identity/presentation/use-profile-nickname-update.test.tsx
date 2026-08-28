import { act, renderHook, waitFor } from '@testing-library/react';

jest.mock(
    '../../../../modules/identity/infrastructure/browser/browser-identity-services',
    () => ({ createBrowserIdentityServices: jest.fn() }),
);

import { useProfileNicknameUpdate } from '@/src/modules/identity/presentation/use-profile-nickname-update';
import type { CurrentUserProfile } from '@/src/modules/identity/application/auth-types';
import { err, ok, type Result } from '@/src/shared/application/result';

const profile = { id: 'user-1', nickname: '변경닉네임', role: 'r2' as const };

const createService = () => ({
    update: jest.fn().mockResolvedValue(ok(profile)),
});

describe('useProfileNicknameUpdate', () => {
    it('updates through the nickname-only application command', async () => {
        // Break caught: adding actor identity or bypassing the feature command from presentation.
        const service = createService();
        const { result } = renderHook(() => useProfileNicknameUpdate(service));

        let actionResult: Result<CurrentUserProfile> | undefined;
        await act(async () => {
            actionResult = await result.current.updateProfileNickname('  변경닉네임  ');
        });

        expect(actionResult).toEqual(ok(profile));
        expect(service.update).toHaveBeenCalledWith('  변경닉네임  ');
    });

    it('coalesces overlapping submissions into one command', async () => {
        // Break caught: rapid save clicks creating duplicate nickname update requests.
        const service = createService();
        let resolveUpdate!: (value: Result<CurrentUserProfile>) => void;
        const updatePromise = new Promise<Result<CurrentUserProfile>>((resolve) => {
            resolveUpdate = resolve;
        });
        service.update.mockReturnValue(updatePromise);
        const { result } = renderHook(() => useProfileNicknameUpdate(service));

        let first!: Promise<Result<CurrentUserProfile>>;
        let second!: Promise<Result<CurrentUserProfile>>;
        act(() => {
            first = result.current.updateProfileNickname('변경닉네임');
            second = result.current.updateProfileNickname('다른닉네임');
        });

        expect(first).toBe(second);
        expect(service.update).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(result.current.isPending).toBe(true));
        await act(async () => resolveUpdate(ok(profile)));
        await expect(first).resolves.toEqual(ok(profile));
        await waitFor(() => expect(result.current.isPending).toBe(false));
    });

    it('stores returned stable errors and supports clearing them', async () => {
        // Break caught: swallowing a public conflict before ProfilePage can render it.
        const service = createService();
        const conflict = {
            kind: 'conflict' as const,
            code: 'NICKNAME_CONFLICT',
            message: '이미 사용 중인 닉네임입니다.',
        };
        service.update.mockResolvedValue(err(conflict));
        const { result } = renderHook(() => useProfileNicknameUpdate(service));

        await act(async () => {
            await result.current.updateProfileNickname('변경닉네임');
        });

        expect(result.current.error).toEqual(conflict);
        act(() => result.current.clearError());
        expect(result.current.error).toBeNull();
    });

    it('converts thrown service details to stable infrastructure failure', async () => {
        // Break caught: a rejected service escaping the hook into an unhandled UI promise.
        const service = createService();
        service.update.mockRejectedValue(new Error('private service detail'));
        const { result } = renderHook(() => useProfileNicknameUpdate(service));

        let actionResult: Result<CurrentUserProfile> | undefined;
        await act(async () => {
            actionResult = await result.current.updateProfileNickname('변경닉네임');
        });

        expect(actionResult).toEqual(err({
            kind: 'infrastructure',
            message: '닉네임 변경 중 오류가 발생했습니다.',
        }));
        expect(result.current.error?.message).not.toContain('private');
    });
});

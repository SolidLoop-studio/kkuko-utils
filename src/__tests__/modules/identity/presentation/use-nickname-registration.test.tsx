import { act, renderHook, waitFor } from '@testing-library/react';

jest.mock(
    '../../../../modules/identity/infrastructure/browser/browser-identity-services',
    () => ({ createBrowserIdentityServices: jest.fn() }),
);

import { useNicknameRegistration } from '@/src/modules/identity/presentation/use-nickname-registration';
import type {
    NicknameAvailability,
    NicknameRegistrationProfile,
} from '@/src/modules/identity/application/nickname-types';
import { err, ok, type Result } from '@/src/shared/application/result';

const profile = { id: 'user-1', nickname: '테스터', role: 'guest' as const };

const createServices = () => ({
    checkNicknameAvailabilityService: {
        check: jest.fn().mockResolvedValue(ok({
            nickname: '테스터',
            isAvailable: true,
        })),
    },
    registerNicknameService: {
        register: jest.fn().mockResolvedValue(ok(profile)),
    },
});

describe('useNicknameRegistration', () => {
    it('checks availability and then registers through nickname-only services', async () => {
        // Break caught: skipping the visible availability behavior or adding UI-controlled identity fields.
        const services = createServices();
        const { result } = renderHook(() => useNicknameRegistration(services));

        let actionResult: Result<NicknameRegistrationProfile> | undefined;
        await act(async () => {
            actionResult = await result.current.registerNickname('  테스터  ');
        });

        expect(actionResult).toEqual(ok(profile));
        expect(services.checkNicknameAvailabilityService.check).toHaveBeenCalledWith('  테스터  ');
        expect(services.registerNicknameService.register).toHaveBeenCalledWith('테스터');
    });

    it('returns a stable conflict without commanding when the nickname is unavailable', async () => {
        // Break caught: inserting despite a known unavailable nickname.
        const services = createServices();
        services.checkNicknameAvailabilityService.check.mockResolvedValue(ok({
            nickname: '테스터',
            isAvailable: false,
        }));
        const { result } = renderHook(() => useNicknameRegistration(services));

        let actionResult: Result<NicknameRegistrationProfile> | undefined;
        await act(async () => {
            actionResult = await result.current.registerNickname('테스터');
        });

        expect(actionResult).toMatchObject({
            ok: false,
            error: { kind: 'conflict', message: '이미 사용 중인 닉네임입니다.' },
        });
        expect(services.registerNicknameService.register).not.toHaveBeenCalled();
    });

    it('coalesces overlapping registration attempts across availability and insert', async () => {
        // Break caught: two rapid clicks starting separate check/insert workflows.
        const services = createServices();
        let resolveCheck!: (value: Result<NicknameAvailability>) => void;
        const checkPromise = new Promise<Result<NicknameAvailability>>((resolve) => {
            resolveCheck = resolve;
        });
        services.checkNicknameAvailabilityService.check.mockReturnValue(checkPromise);
        const { result } = renderHook(() => useNicknameRegistration(services));

        let first!: Promise<Result<NicknameRegistrationProfile>>;
        let second!: Promise<Result<NicknameRegistrationProfile>>;
        act(() => {
            first = result.current.registerNickname('테스터');
            second = result.current.registerNickname('다른닉네임');
        });

        expect(first).toBe(second);
        expect(services.checkNicknameAvailabilityService.check).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(result.current.isPending).toBe(true));
        await act(async () => resolveCheck(ok({ nickname: '테스터', isAvailable: true })));
        await expect(first).resolves.toEqual(ok(profile));
        expect(services.registerNicknameService.register).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(result.current.isPending).toBe(false));
    });

    it('stores stable errors, clears them, and converts thrown details', async () => {
        // Break caught: a rejected service escaping the hook or retaining raw details in UI state.
        const services = createServices();
        services.checkNicknameAvailabilityService.check.mockRejectedValue(
            new Error('private service detail'),
        );
        const { result } = renderHook(() => useNicknameRegistration(services));

        let actionResult: Result<NicknameRegistrationProfile> | undefined;
        await act(async () => {
            actionResult = await result.current.registerNickname('테스터');
        });

        expect(actionResult).toMatchObject({ ok: false, error: { kind: 'infrastructure' } });
        expect(result.current.error).toEqual({
            kind: 'infrastructure',
            message: '닉네임 등록 중 오류가 발생했습니다.',
        });
        act(() => result.current.clearError());
        expect(result.current.error).toBeNull();
    });
});

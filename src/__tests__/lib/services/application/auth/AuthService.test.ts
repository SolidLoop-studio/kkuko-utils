import { AuthService } from '@/src/lib/services/application/auth/AuthService';
import type { IAuthRepository } from '@/src/lib/services/domain/auth/AuthRepository';
import { success, failure } from '@/src/lib/services/domain/result';
import { infrastructureError } from '@/src/lib/services/domain/errors';
import type { Session } from '@supabase/supabase-js';

const mockSession = { access_token: 'test-token' } as Session;

function makeMockAuthRepo(overrides: Partial<IAuthRepository> = {}): IAuthRepository {
    return {
        getSession: jest.fn().mockResolvedValue(success(mockSession)),
        getJWT: jest.fn().mockResolvedValue(success('test-token')),
        loginByGoogle: jest.fn().mockResolvedValue(success(undefined)),
        logout: jest.fn().mockResolvedValue(success(undefined)),
        onAuthStateChange: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
        ...overrides,
    };
}

describe('AuthService', () => {
    describe('getSession', () => {
        it('세션 반환', async () => {
            const service = new AuthService(makeMockAuthRepo());
            const result = await service.getSession();
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toEqual(mockSession);
        });

        it('세션 없으면 null 반환', async () => {
            const repo = makeMockAuthRepo({ getSession: jest.fn().mockResolvedValue(success(null)) });
            const service = new AuthService(repo);
            const result = await service.getSession();
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toBeNull();
        });
    });

    describe('getJWT', () => {
        it('JWT 토큰 반환', async () => {
            const service = new AuthService(makeMockAuthRepo());
            const result = await service.getJWT();
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toBe('test-token');
        });

        it('세션 없으면 null 반환', async () => {
            const repo = makeMockAuthRepo({ getJWT: jest.fn().mockResolvedValue(success(null)) });
            const service = new AuthService(repo);
            const result = await service.getJWT();
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toBeNull();
        });
    });

    describe('loginByGoogle', () => {
        it('구글 로그인 성공', async () => {
            const repo = makeMockAuthRepo();
            const service = new AuthService(repo);
            const result = await service.loginByGoogle('https://example.com');
            expect(result.success).toBe(true);
            expect(repo.loginByGoogle).toHaveBeenCalledWith('https://example.com');
        });

        it('로그인 실패 시 에러 반환', async () => {
            const err = infrastructureError({ message: 'OAuth error' });
            const repo = makeMockAuthRepo({ loginByGoogle: jest.fn().mockResolvedValue(failure(err)) });
            const service = new AuthService(repo);
            const result = await service.loginByGoogle('https://example.com');
            expect(result.success).toBe(false);
        });
    });

    describe('logout', () => {
        it('로그아웃 성공', async () => {
            const repo = makeMockAuthRepo();
            const service = new AuthService(repo);
            const result = await service.logout();
            expect(result.success).toBe(true);
            expect(repo.logout).toHaveBeenCalled();
        });
    });

    describe('onAuthStateChange', () => {
        it('구독 객체 반환', () => {
            const repo = makeMockAuthRepo();
            const service = new AuthService(repo);
            const callback = jest.fn();
            const sub = service.onAuthStateChange(callback);
            expect(sub).toHaveProperty('unsubscribe');
            expect(repo.onAuthStateChange).toHaveBeenCalledWith(callback);
        });
    });
});

import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { middleware } from '../middleware';

const mockGetUser = jest.fn();
const mockMaybeSingle = jest.fn();

jest.mock('@supabase/ssr', () => ({
    createServerClient: jest.fn(),
}));

jest.mock('next/server', () => ({
    NextResponse: {
        next: jest.fn(() => ({
            headers: { get: () => null },
            cookies: { set: jest.fn() },
        })),
        rewrite: jest.fn((url: URL) => ({
            headers: {
                get: (name: string) => name === 'x-middleware-rewrite' ? url.toString() : null,
            },
        })),
    },
}));

const createRequest = () => ({
    nextUrl: { pathname: '/admin' },
    url: 'http://localhost/admin',
    cookies: {
        getAll: () => [],
        set: jest.fn(),
    },
} as unknown as NextRequest);

const setAuthenticatedRole = (role: 'r1' | 'r4' | 'admin') => {
    mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
    });
    mockMaybeSingle.mockResolvedValue({ data: { role }, error: null });
};

describe('admin middleware authorization', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(createServerClient).mockReturnValue({
            auth: { getUser: mockGetUser },
            from: () => ({
                select: () => ({
                    eq: () => ({ maybeSingle: mockMaybeSingle }),
                }),
            }),
        } as unknown as ReturnType<typeof createServerClient>);
    });

    test('비로그인 사용자는 not-found로 rewrite한다', async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } });

        const response = await middleware(createRequest());

        expect(response.headers.get('x-middleware-rewrite')).toBe('http://localhost/not-found');
    });

    test.each(['r1', 'r4'] as const)('%s 사용자는 not-found로 rewrite한다', async (role) => {
        setAuthenticatedRole(role);

        const response = await middleware(createRequest());

        expect(response.headers.get('x-middleware-rewrite')).toBe('http://localhost/not-found');
    });

    test('관리자는 admin 요청을 계속 처리한다', async () => {
        setAuthenticatedRole('admin');

        const response = await middleware(createRequest());

        expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    });
});

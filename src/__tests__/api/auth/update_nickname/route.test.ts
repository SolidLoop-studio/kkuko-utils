import type { NextRequest } from 'next/server';

jest.mock('next/server', () => ({
    NextResponse: {
        json: (value: unknown, init?: { status?: number }) => {
            const values = new Map<string, { name: string; value: string; path?: string }>();
            return {
                status: init?.status ?? 200,
                json: async () => value,
                cookies: {
                    set: jest.fn((name: string, cookieValue: string, options?: { path?: string }) => {
                        values.set(name, { name, value: cookieValue, ...options });
                    }),
                    get: (name: string) => values.get(name),
                },
            };
        },
        next: () => {
            const values = new Map<string, { name: string; value: string; path?: string }>();
            return {
                cookies: {
                    set: jest.fn((name: string, cookieValue: string, options?: { path?: string }) => {
                        values.set(name, { name, value: cookieValue, ...options });
                    }),
                    get: (name: string) => values.get(name),
                },
            };
        },
    },
}));

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { POST } from '../../../../app/api/auth/update_nickname/route';

const mockCreateServerClient = createServerClient as jest.Mock;
const mockCreateClient = createClient as jest.Mock;
const mockGetUser = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSelect = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockEq = jest.fn(() => ({ select: mockSelect }));
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ update: mockUpdate }));

const createRequest = (json: () => Promise<unknown>): NextRequest => ({
    json,
    cookies: { getAll: jest.fn(() => []), set: jest.fn() },
} as unknown as NextRequest);

const responseBody = async (response: Awaited<ReturnType<typeof POST>>) => response.json();

const refreshSessionCookiesDuringGetUser = () => {
    mockGetUser.mockImplementation(async () => {
        const createCall = mockCreateServerClient.mock.calls[
            mockCreateServerClient.mock.calls.length - 1
        ];
        const options = createCall[2] as {
            cookies: {
                setAll(cookies: Array<{
                    name: string;
                    value: string;
                    options: { path: string };
                }>): void;
            };
        };
        options.cookies.setAll([
            { name: 'sb-access-token', value: 'fresh-access', options: { path: '/' } },
            { name: 'sb-refresh-token', value: 'fresh-refresh', options: { path: '/' } },
        ]);
        return {
            data: { user: { id: 'authenticated-user' } },
            error: null,
        };
    });
};

describe('POST /api/auth/update_nickname', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCreateServerClient.mockReturnValue({ auth: { getUser: mockGetUser } });
        mockCreateClient.mockReturnValue({ from: mockFrom });
        mockGetUser.mockResolvedValue({
            data: { user: { id: 'authenticated-user' } },
            error: null,
        });
        mockMaybeSingle.mockResolvedValue({
            data: { id: 'authenticated-user', nickname: '변경닉네임', role: 'r2' },
            error: null,
        });
    });

    it.each([
        ['malformed JSON', () => Promise.reject(new SyntaxError('bad json'))],
        ['missing nickname', () => Promise.resolve({})],
        ['non-string nickname', () => Promise.resolve({ nickname: 7 })],
        ['blank nickname', () => Promise.resolve({ nickname: '   ' })],
        ['noncanonical nickname', () => Promise.resolve({ nickname: ' 변경닉네임 ' })],
    ])('returns stable validation for %s before auth or DB access', async (_description, json) => {
        // Break caught: malformed or noncanonical input reaching authentication/update builders.
        const response = await POST(createRequest(json));

        expect(response.status).toBe(400);
        await expect(responseBody(response)).resolves.toEqual({
            data: null,
            error: { code: 'NICKNAME_INVALID' },
        });
        expect(mockCreateServerClient).not.toHaveBeenCalled();
        expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it('returns stable unauthorized when getUser has no authenticated actor', async () => {
        // Break caught: updating without a verified actor or exposing session diagnostics.
        mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('expired token') });

        const response = await POST(createRequest(() => Promise.resolve({ nickname: '변경닉네임' })));

        expect(response.status).toBe(401);
        await expect(responseBody(response)).resolves.toEqual({
            data: null,
            error: { code: 'NICKNAME_UNAUTHORIZED' },
        });
        expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it('derives actor identity from getUser and selects the narrow public projection', async () => {
        // Break caught: trusting caller UUID/role or returning every users table column.
        const response = await POST(createRequest(() => Promise.resolve({
            nickname: '변경닉네임',
            actorId: 'attacker',
            id: 'attacker',
            role: 'admin',
        })));

        expect(mockUpdate).toHaveBeenCalledWith({ nickname: '변경닉네임' });
        expect(mockEq).toHaveBeenCalledWith('id', 'authenticated-user');
        expect(mockSelect).toHaveBeenCalledWith('id,nickname,role');
        expect(response.status).toBe(200);
        await expect(responseBody(response)).resolves.toEqual({
            data: { id: 'authenticated-user', nickname: '변경닉네임', role: 'r2' },
            error: null,
        });
    });

    it.each([
        ['success', 200, () => undefined],
        ['authenticated conflict', 409, () => mockMaybeSingle.mockResolvedValue({
            data: null,
            error: { code: '23505', message: 'private duplicate detail' },
        })],
    ])('propagates every refreshed session cookie on %s response', async (
        _description,
        expectedStatus,
        arrangeDatabase,
    ) => {
        // Break caught: setAll() cookies remaining on a discarded NextResponse.next() instance.
        arrangeDatabase();
        refreshSessionCookiesDuringGetUser();

        const response = await POST(createRequest(() => Promise.resolve({
            nickname: '변경닉네임',
        })));

        expect(response.status).toBe(expectedStatus);
        expect(response.cookies.get('sb-access-token')).toEqual({
            name: 'sb-access-token',
            value: 'fresh-access',
            path: '/',
        });
        expect(response.cookies.get('sb-refresh-token')).toEqual({
            name: 'sb-refresh-token',
            value: 'fresh-refresh',
            path: '/',
        });
    });

    it('maps a returned unique violation to conflict without raw diagnostics', async () => {
        // Break caught: exposing PostgREST duplicate diagnostics or misclassifying the race.
        mockMaybeSingle.mockResolvedValue({
            data: null,
            error: {
                code: '23505',
                message: 'duplicate key users_nickname_key',
                details: 'private details',
                hint: 'private hint',
            },
        });

        const response = await POST(createRequest(() => Promise.resolve({ nickname: '변경닉네임' })));
        const body = await responseBody(response);

        expect(response.status).toBe(409);
        expect(body).toEqual({ data: null, error: { code: 'NICKNAME_CONFLICT' } });
        expect(JSON.stringify(body)).not.toMatch(/23505|duplicate|details|hint/i);
    });

    it.each([
        ['returned', () => mockMaybeSingle.mockResolvedValue({
            data: null,
            error: { code: 'XX999', message: 'private returned detail' },
        })],
        ['thrown', () => mockMaybeSingle.mockRejectedValue(new Error('private thrown detail'))],
    ])('maps a %s database failure to generic infrastructure', async (_description, arrange) => {
        // Break caught: returning or throwing raw infrastructure diagnostics from the route.
        arrange();

        const response = await POST(createRequest(() => Promise.resolve({ nickname: '변경닉네임' })));
        const body = await responseBody(response);

        expect(response.status).toBe(500);
        expect(body).toEqual({ data: null, error: { code: 'NICKNAME_INTERNAL_ERROR' } });
        expect(JSON.stringify(body)).not.toMatch(/private|XX999/i);
    });

    it('maps a thrown authentication failure to generic infrastructure', async () => {
        // Break caught: allowing an auth SDK exception to escape the route boundary.
        mockGetUser.mockRejectedValue(new Error('private auth detail'));

        const response = await POST(createRequest(() => Promise.resolve({ nickname: '변경닉네임' })));

        expect(response.status).toBe(500);
        await expect(responseBody(response)).resolves.toEqual({
            data: null,
            error: { code: 'NICKNAME_INTERNAL_ERROR' },
        });
        expect(mockCreateClient).not.toHaveBeenCalled();
    });
});

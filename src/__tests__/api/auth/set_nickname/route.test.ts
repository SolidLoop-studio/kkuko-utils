import type { NextRequest } from 'next/server';

jest.mock('next/server', () => ({
    NextResponse: {
        json: (value: unknown, init?: { status?: number }) => ({
            status: init?.status ?? 200,
            json: async () => value,
        }),
        next: () => ({
            cookies: { set: jest.fn() },
        }),
    },
}));

jest.mock('@supabase/ssr', () => ({
    createServerClient: jest.fn(),
}));

jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(),
}));

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { POST } from '../../../../app/api/auth/set_nickname/route';

const mockCreateServerClient = createServerClient as jest.Mock;
const mockCreateClient = createClient as jest.Mock;
const mockGetUser = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSelect = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockInsert = jest.fn(() => ({ select: mockSelect }));
const mockFrom = jest.fn(() => ({ insert: mockInsert }));

const createRequest = (json: () => Promise<unknown>): NextRequest => ({
    json,
    cookies: {
        getAll: jest.fn(() => []),
        set: jest.fn(),
    },
} as unknown as NextRequest);

const responseBody = async (response: Awaited<ReturnType<typeof POST>>) => response.json();

describe('POST /api/auth/set_nickname', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCreateServerClient.mockReturnValue({
            auth: { getUser: mockGetUser },
        });
        mockCreateClient.mockReturnValue({ from: mockFrom });
        mockGetUser.mockResolvedValue({
            data: { user: { id: 'authenticated-user' } },
            error: null,
        });
        mockMaybeSingle.mockResolvedValue({
            data: { id: 'authenticated-user', nickname: '테스터', role: null },
            error: null,
        });
    });

    it.each([
        ['malformed JSON', () => Promise.reject(new SyntaxError('bad json'))],
        ['missing nickname', () => Promise.resolve({})],
        ['non-string nickname', () => Promise.resolve({ nickname: 7 })],
        ['whitespace-only nickname', () => Promise.resolve({ nickname: '   ' })],
        ['noncanonical nickname', () => Promise.resolve({ nickname: ' 테스터 ' })],
    ])('returns stable validation for %s without reaching authentication or the database', async (
        _description,
        json,
    ) => {
        // Break caught: malformed/noncanonical input reaching trim(), auth, or the insert boundary.
        const response = await POST(createRequest(json));

        expect(response.status).toBe(400);
        await expect(responseBody(response)).resolves.toEqual({
            data: null,
            error: { code: 'NICKNAME_INVALID' },
        });
        expect(mockCreateServerClient).not.toHaveBeenCalled();
        expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it('returns stable unauthorized when the authenticated session has no user', async () => {
        // Break caught: exposing the legacy "no session" sentinel or inserting without an actor.
        mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('expired token') });

        const response = await POST(createRequest(() => Promise.resolve({ nickname: '테스터' })));

        expect(response.status).toBe(401);
        await expect(responseBody(response)).resolves.toEqual({
            data: null,
            error: { code: 'NICKNAME_UNAUTHORIZED' },
        });
        expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it('projects a database unique violation to a stable conflict without raw details', async () => {
        // Break caught: returning PostgREST error message/details/hint/constraint to the browser.
        mockMaybeSingle.mockResolvedValue({
            data: null,
            error: {
                code: '23505',
                message: 'duplicate key value violates unique constraint users_nickname_key',
                details: 'Key (nickname)=(테스터) already exists.',
                hint: 'private hint',
                constraint: 'users_nickname_key',
            },
        });

        const response = await POST(createRequest(() => Promise.resolve({ nickname: '테스터' })));
        const body = await responseBody(response);

        expect(response.status).toBe(409);
        expect(body).toEqual({ data: null, error: { code: 'NICKNAME_CONFLICT' } });
        expect(JSON.stringify(body)).not.toMatch(/23505|duplicate|details|hint|constraint/i);
    });

    it('projects an unknown database failure to generic infrastructure without raw details', async () => {
        // Break caught: leaking arbitrary database diagnostics through a generic route failure.
        mockMaybeSingle.mockResolvedValue({
            data: null,
            error: {
                code: 'XX999',
                message: 'private database failure',
                details: 'private details',
                hint: 'private hint',
            },
        });

        const response = await POST(createRequest(() => Promise.resolve({ nickname: '테스터' })));
        const body = await responseBody(response);

        expect(response.status).toBe(500);
        expect(body).toEqual({ data: null, error: { code: 'NICKNAME_INTERNAL_ERROR' } });
        expect(JSON.stringify(body)).not.toMatch(/XX999|private|details|hint/i);
    });

    it('derives the inserted actor ID from auth and preserves the canonical nickname', async () => {
        // Break caught: trusting caller-controlled identity/role or normalizing a second time in the route.
        const response = await POST(createRequest(() => Promise.resolve({
            nickname: '테스터',
            id: 'attacker-controlled',
            actorId: 'attacker-controlled',
            role: 'admin',
        })));

        expect(mockInsert).toHaveBeenCalledWith({
            id: 'authenticated-user',
            nickname: '테스터',
        });
        expect(response.status).toBe(200);
        await expect(responseBody(response)).resolves.toEqual({
            data: { id: 'authenticated-user', nickname: '테스터', role: null },
            error: null,
        });
    });
});

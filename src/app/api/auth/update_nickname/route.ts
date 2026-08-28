import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { Database } from '@/src/app/types/database.types';
import { createClient } from '@supabase/supabase-js';

type CookieToSet = { name: string; value: string; options: CookieOptions };

const jsonResponse = (
    body: unknown,
    status: number,
    cookies: CookieToSet[] = [],
) => {
    const response = NextResponse.json(body, { status });
    cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
};

const errorResponse = (
    code: 'NICKNAME_INVALID'
        | 'NICKNAME_UNAUTHORIZED'
        | 'NICKNAME_CONFLICT'
        | 'NICKNAME_INTERNAL_ERROR',
    status: number,
    cookies: CookieToSet[] = [],
) => jsonResponse({ data: null, error: { code } }, status, cookies);

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

export async function POST(request: NextRequest) {
    const body: unknown = await request.json().catch(() => null);
    if (!isRecord(body)
        || typeof body.nickname !== 'string'
        || body.nickname.length === 0
        || body.nickname !== body.nickname.trim()) {
        return errorResponse('NICKNAME_INVALID', 400);
    }
    const nickname = body.nickname;
    let responseCookies: CookieToSet[] = [];

    try {
        const supabase = createServerClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                        responseCookies = [...responseCookies, ...cookiesToSet];
                    },
                },
            },
        );

        // 유효한 유저인지 검사
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return errorResponse('NICKNAME_UNAUTHORIZED', 401, responseCookies);

        // 업데이트 처리
        const supabaseServer = createClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_KEY!,
        );
        const { data, error } = await supabaseServer
            .from('users')
            .update({ nickname })
            .eq('id', user.id)
            .select('id,nickname,role')
            .maybeSingle();
        if (error) {
            return errorResponse(
                error.code === '23505' ? 'NICKNAME_CONFLICT' : 'NICKNAME_INTERNAL_ERROR',
                error.code === '23505' ? 409 : 500,
                responseCookies,
            );
        }
        if (!data) return errorResponse('NICKNAME_INTERNAL_ERROR', 500, responseCookies);
        return jsonResponse({
            data,
            error: null,
        }, 200, responseCookies);
    } catch {
        return errorResponse('NICKNAME_INTERNAL_ERROR', 500, responseCookies);
    }
}

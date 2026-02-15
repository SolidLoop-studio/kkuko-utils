import { createSupabaseServerClient } from '@/src/app/lib/supabaseServer';
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
    try {
        const supabase = await createSupabaseServerClient();

        // 코드를 세션으로 교환
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            new URL(req.url).searchParams.get('code') || ''
        );

        if (exchangeError) {
            console.error('Code exchange error:', exchangeError);
            return NextResponse.redirect(new URL('/auth', req.url));
        }

        return NextResponse.redirect(new URL('/auth', req.url));
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.redirect(new URL('/auth', req.url));
    }
}

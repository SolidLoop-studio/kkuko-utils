import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Database } from './app/types/database.types';

export async function middleware(request: NextRequest) {
    const isProtectedRoute = request.nextUrl.pathname.startsWith('/admin')
    if (!isProtectedRoute){
        return NextResponse.next();
    }

    let supabaseResponse = NextResponse.next({request,})

    const supabase = createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    

    const { data: { user } } = await supabase.auth.getUser();
    if (!user){
        return NextResponse.rewrite(new URL('/not-found', request.url));
    }

    const {data, error} = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();

    if (!data || error || data.role !== 'admin'){
        return NextResponse.rewrite(new URL('/not-found', request.url));
    }
    return supabaseResponse;

}

// 모든 경로에 적용 (또는 필요한 경로만 지정)
export const config = {
    matcher: ['/admin/:path*'],
};

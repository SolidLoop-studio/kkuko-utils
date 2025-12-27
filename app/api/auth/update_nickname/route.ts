import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/app/types/database.types';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest){
    const body = await request.json().catch()
    
    // 유효하지 않은 데이터는 그냥 반환
    if (!body){
        return NextResponse.json({
            data: null,
            error: "invalid data"
        })
    }

    const {nickname} = body;
    if (!nickname){
        return NextResponse.json({
            data: null,
            error: "invalid data"
        })
    }

    // 요청자의 데이터를 쿠키에서 얻어냄
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

    // 유효한 유저인지 검사
    const { data: { user } } = await supabase.auth.getUser();
    if (!user){
        return NextResponse.json({
            data: null,
            error: "no session"
        })
    }

    // 업데이트 처리
    const supabaseServer = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL, 
        process.env.SUPABASE_SERVICE_KEY
    )
    const {data, error} = await supabaseServer.from('users').update({nickname}).eq('id',user.id).select('*').maybeSingle();
    if (error){
        return NextResponse.json({
            data,
            error
        },{status:500})
    }
    return NextResponse.json({
        data,
        error
    })
}
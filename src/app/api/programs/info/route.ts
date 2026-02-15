import { NextRequest, NextResponse } from 'next/server';
import { SSM } from '@/src/app/lib/supabase/supabaseServerManager';

export async function GET(request: NextRequest) {
    try {
        const id = request.nextUrl.searchParams.get('id');
        if (!id || isNaN(Number(id))){
            return NextResponse.json(
                { error: 'Invalid program ID' },
                { status: 400 }
            );
        }
        const {data, error} = await SSM.getProgramInfo(Number(id));
        if (error) {
            console.error('Database error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch program info' },
                { status: 500 }
            );
        }
        const {data: data2, error: error2} = await SSM.getLatestInfoProgram(data.github_repo);
        if (error2 || !data2) {
            console.error('GitHub API error:', error2);
            return NextResponse.json(
                { error: 'Failed to fetch latest program info' },
                { status: 500 }
            );
        }
        return NextResponse.json(
            { data: {...data, updated_at: data2.updated_at}  },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error fetching program info:', error);
        return NextResponse.json(
            { error: 'Failed to fetch program info' },
            { status: 500 }
        );
    }
}
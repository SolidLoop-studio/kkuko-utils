import { SSM } from '@/src/app/lib/supabase/supabaseServerManager';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ repo: string }> }
) {
  try {
    const repo = decodeURIComponent((await params).repo);

    const { data, error } = await SSM.getLatestInfoProgram(repo);

    if (error) {
      throw new Error(`GitHub API error: ${JSON.stringify(error)}`);
    }

    return NextResponse.json({ release: data });
  } catch (error) {
    console.error('GitHub API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch latest release' },
      { status: 500 }
    );
  }
}

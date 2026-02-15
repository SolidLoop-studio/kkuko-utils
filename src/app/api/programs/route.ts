import { NextRequest, NextResponse } from 'next/server';
import { SSM } from '@/src/app/lib/supabase/supabaseServerManager';
import { Program } from '@/src/app/types/program';

function parseCategory(category: string | null): 'all' | 'tool' | 'util' | 'other' {
  if (!category || !['all', 'tool', 'util', 'other'].includes(category)) {
    return 'all';
  }
  return category as 'all' | 'tool' | 'util' | 'other';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = parseCategory(searchParams.get('category'));

    const { data: programs, error } = await SSM.getPrograms(category);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch programs' },
        { status: 500 }
      );
    }
    const returnData: Program[] = [];
    for (const program of programs) {
      const { data: latestInfo, error: latestInfoError } = await SSM.getLatestInfoProgram(program.github_repo);
      if (latestInfoError || latestInfo === null) {
        console.error('GitHub API error:', latestInfoError);
        return NextResponse.json(
          { error: 'Failed to fetch latest program info' },
          { status: 500 }
        );
      }
      returnData.push({ ...program, updated_at: latestInfo.published_at });
    }

    return NextResponse.json({ programs: returnData });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

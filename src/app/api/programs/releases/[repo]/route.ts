import { SSM } from '@/src/app/lib/supabase/supabaseServerManager';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ repo: string }> }
) {
  try {
    const repo = decodeURIComponent((await params).repo);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const per_page = parseInt(searchParams.get('per_page') || '10');

    // GitHub API 호출
    const {data, error} = await SSM.getGithubReleases(repo, page, per_page);

    if (error) {
      throw new Error(`GitHub API error: ${JSON.stringify(error)}`);
    }

    if (!data) {
      return NextResponse.json(
        { error: 'No releases found' },
        { status: 404 }
      );
    }

    const releases = data;

    return NextResponse.json({ 
      releases: releases ?? [],
      has_more: releases.length === per_page
    });
  } catch (error) {
    console.error('GitHub API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch releases' },
      { status: 500 }
    );
  }
}

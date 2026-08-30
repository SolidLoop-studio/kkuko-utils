import { NextRequest, NextResponse } from 'next/server';
import { createServerProgramsServices } from '../../../../../modules/programs/infrastructure/server/server-program-services';
import { parseReleasePagination, parseRepository } from '../../../../../modules/programs/infrastructure/server/program-route-validation';
import { presentRelease } from '../../presenters';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ repo: string }> }
) {
  const repository = parseRepository((await params).repo);
  const pagination = parseReleasePagination(request.nextUrl.searchParams);
  if (repository === null) return NextResponse.json({ error: 'Invalid repository' }, { status: 400 });
  if (pagination === null) return NextResponse.json({ error: 'Invalid release pagination' }, { status: 400 });
  try {
    const result = await createServerProgramsServices().programsService.releases(repository, pagination);
    if (!result.ok) return NextResponse.json({ error: 'Failed to fetch releases' }, { status: 502 });
    return NextResponse.json({ releases: result.value.map(presentRelease), has_more: result.value.length === pagination.perPage });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch releases' }, { status: 500 });
  }
}

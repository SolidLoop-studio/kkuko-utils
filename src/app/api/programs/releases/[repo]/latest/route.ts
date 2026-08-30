import { NextRequest, NextResponse } from 'next/server';
import { createServerProgramsServices } from '../../../../../../modules/programs/infrastructure/server/server-program-services';
import { parseRepository } from '../../../../../../modules/programs/infrastructure/server/program-route-validation';
import { presentRelease } from '../../../presenters';

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ repo: string }> }
) {
  const repository = parseRepository((await params).repo);
  if (repository === null) return NextResponse.json({ error: 'Invalid repository' }, { status: 400 });
  try {
    const result = await createServerProgramsServices().programsService.latestRelease(repository);
    return result.ok
      ? NextResponse.json({ release: presentRelease(result.value) })
      : NextResponse.json({ error: 'Failed to fetch latest release' }, { status: 502 });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch latest release' }, { status: 500 });
  }
}

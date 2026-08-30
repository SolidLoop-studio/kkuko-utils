import { NextRequest, NextResponse } from 'next/server';
import { createServerProgramsServices } from '../../../modules/programs/infrastructure/server/server-program-services';
import { presentProgram } from './presenters';

export async function GET(request: NextRequest) {
  try {
    const result = await createServerProgramsServices().programsService
      .list(request.nextUrl.searchParams.get('category') ?? 'all');
    if (!result.ok) return NextResponse.json({ error: 'Failed to fetch programs' }, { status: 502 });
    return NextResponse.json({ programs: result.value.map(presentProgram) });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch programs' }, { status: 500 });
  }
}

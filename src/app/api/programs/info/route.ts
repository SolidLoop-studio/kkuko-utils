import { NextRequest, NextResponse } from 'next/server';
import { createServerProgramsServices } from '../../../../modules/programs/infrastructure/server/server-program-services';
import { parseProgramId } from '../../../../modules/programs/infrastructure/server/program-route-validation';
import { presentProgram } from '../presenters';

export async function GET(request: NextRequest) {
    const id = parseProgramId(request.nextUrl.searchParams.get('id'));
    if (id === null) return NextResponse.json({ error: 'Invalid program ID' }, { status: 400 });
    try {
        const result = await createServerProgramsServices().programsService.byId(id);
        if (!result.ok) return NextResponse.json({ error: 'Failed to fetch program info' }, { status: 502 });
        if (result.value === null) return NextResponse.json({ error: 'Program not found' }, { status: 404 });
        return NextResponse.json({ data: presentProgram(result.value) });
    } catch {
        return NextResponse.json({ error: 'Failed to fetch program info' }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import type { AdvancedWordSearchQuery } from '../../../../modules/word-catalog/application/word-search-types';
import { createServerWordCatalogServices } from '../../../../modules/word-catalog/infrastructure/server/server-word-catalog-services';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const gameMode = searchParams.get('mode') || 'kor-start';
    const searchQuery = searchParams.get('q') || '';
    const mission = searchParams.get('mission') || '';
    const minimumLength = parseInt(searchParams.get('minLength') || '2');
    const maximumLength = parseInt(searchParams.get('maxLength') || '100');
    const sortOrder = (searchParams.get('sortBy') || 'length') as 'abc' | 'length' | 'attack';
    const isDuemApplied = searchParams.get('duem') !== 'false';
    const hasMiniInfo = searchParams.get('miniInfo') === 'true';
    const mannerMode = searchParams.get('manner') || 'man';
    const isAcceptedOnly = searchParams.get('ingjung') !== 'false';
    const displayLimit = parseInt(searchParams.get('limit') || '100');
    const limit = Number.isNaN(displayLimit) ? 100 : displayLimit;
    const themeId = searchParams.get('themeId');

    let query: AdvancedWordSearchQuery;

    if (gameMode === 'kor-start' || gameMode === 'kor-end') {
        const start = gameMode === 'kor-start' ? searchQuery : searchParams.get('start') || undefined;
        const end = gameMode === 'kor-end' ? searchQuery : searchParams.get('end') || undefined;
        const normalizedStart = start?.trim();
        const normalizedEnd = end?.trim();

        if (gameMode === 'kor-start' && !normalizedStart) return handleErrorResponse('시작 초성이 필요합니다.');
        if (gameMode === 'kor-end' && !normalizedEnd) return handleErrorResponse('끝 초성이 필요합니다.');

        query = {
            mode: gameMode,
            start: normalizedStart,
            end: normalizedEnd,
            mission: mission.trim(),
            isAcceptedOnly,
            isManner: mannerMode === 'man',
            isJen: mannerMode === 'jen',
            isEtiquette: mannerMode === 'eti',
            hasMiniInfo,
            isDuemApplied,
            minimumLength,
            maximumLength,
            sortOrder,
            limit,
        };
    } else if (gameMode === 'kung') {
        if (!searchQuery) return handleErrorResponse('단어가 필요합니다.');
        query = {
            mode: 'kung',
            start: searchQuery.trim().slice(0, 3),
            end: undefined,
            mission: mission.trim(),
            isAcceptedOnly,
            isManner: mannerMode === 'man',
            isJen: mannerMode === 'jen',
            isEtiquette: mannerMode === 'eti',
            hasMiniInfo,
            sortOrder,
            limit,
        };
    } else if (gameMode === 'hunmin') {
        if (searchQuery.trim().length !== 2) return handleErrorResponse('훈민정음 쿼리는 2글자여야 합니다.');
        query = { mode: 'hunmin', query: searchQuery.trim(), mission: mission.trim(), limit };
    } else if (gameMode === 'jaqi') {
        if (!themeId) return handleErrorResponse('주제 ID가 필요합니다.');
        query = { mode: 'jaqi', query: searchQuery.trim(), themeId: Number(themeId), limit };
    } else {
        return handleErrorResponse('유효하지 않은 모드입니다.');
    }

    try {
        const { searchWordsService } = await createServerWordCatalogServices();
        const result = await searchWordsService.search({ type: 'advanced', query });

        if (!result.ok) {
            return NextResponse.json(
                { error: result.error.message },
                { status: result.error.kind === 'validation' ? 400 : 500 },
            );
        }

        return NextResponse.json(result.value);
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : '단어 검색 중 오류가 발생했습니다.',
        }, { status: 500 });
    }
}

function handleErrorResponse(message: string) {
    return NextResponse.json({ error: message }, { status: 400 });
}

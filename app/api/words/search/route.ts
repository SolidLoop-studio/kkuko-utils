import { NextRequest, NextResponse } from 'next/server';
import { SCM } from '@/app/lib/supabaseClient';
import { advancedQueryType } from '@/app/types/type';
import { GameMode } from '@/app/word/search/types';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    const gameMode = (searchParams.get('mode') || 'kor-start') as GameMode;
    const searchQuery = searchParams.get('q') || '';
    const missionLetter = searchParams.get('mission') || '';
    const minimumLength = parseInt(searchParams.get('minLength') || '2');
    const maximumLength = parseInt(searchParams.get('maxLength') || '100');
    const sortOrder = (searchParams.get('sortBy') || 'length') as 'abc' | 'length' | 'attack';
    const isDuemApplied = searchParams.get('duem') !== 'false';
    const hasMiniInfo = searchParams.get('miniInfo') === 'true';
    const mannerMode = searchParams.get('manner') || 'man';
    const isAcceptedOnly = searchParams.get('ingjung') !== 'false';
    const displayLimit = parseInt(searchParams.get('limit') || '100');
    const themeId = searchParams.get('themeId');

    try {
        let searchOptions: advancedQueryType;

        if (gameMode === 'kor-start' || gameMode === 'kor-end') {
            const startLetter = gameMode === 'kor-start' ? searchQuery : searchParams.get('start') || undefined;
            const endLetter = gameMode === 'kor-end' ? searchQuery : searchParams.get('end') || undefined;

            if (gameMode === 'kor-start' && !startLetter) return handleErrorResponse('시작 초성이 필요합니다.');
            if (gameMode === 'kor-end' && !endLetter) return handleErrorResponse('끝 초성이 필요합니다.');

            searchOptions = {
                mode: gameMode,
                start: startLetter?.trim(),
                end: endLetter?.trim(),
                mission: missionLetter,
                ingjung: isAcceptedOnly,
                man: mannerMode === 'man',
                jen: mannerMode === 'jen',
                eti: mannerMode === 'eti',
                duem: isDuemApplied,
                miniInfo: hasMiniInfo,
                length_min: minimumLength,
                length_max: maximumLength,
                sort_by: sortOrder,
                limit: isNaN(displayLimit) ? 100 : displayLimit
            };
        } else if (gameMode === 'kung') {
            if (!searchQuery) return handleErrorResponse('단어가 필요합니다.');
            searchOptions = {
                mode: 'kung',
                start: searchQuery.trim().slice(0, 3),
                mission: missionLetter,
                ingjung: isAcceptedOnly,
                man: mannerMode === 'man',
                jen: mannerMode === 'jen',
                eti: mannerMode === 'eti',
                duem: isDuemApplied,
                miniInfo: hasMiniInfo,
                length_min: 3,
                length_max: 3,
                sort_by: sortOrder,
                limit: isNaN(displayLimit) ? 100 : displayLimit
            };
        } else if (gameMode === 'hunmin') {
            if (searchQuery.trim().length !== 2) return handleErrorResponse('훈민정음 쿼리는 2글자여야 합니다.');
            searchOptions = {
                mode: 'hunmin',
                query: searchQuery.trim(),
                mission: missionLetter,
                limit: isNaN(displayLimit) ? 100 : displayLimit
            };
        } else if (gameMode === 'jaqi') {
            if (!themeId) return handleErrorResponse('테마 ID가 필요합니다.');
            searchOptions = {
                mode: 'jaqi',
                query: searchQuery.trim(),
                theme: Number(themeId),
                limit: isNaN(displayLimit) ? 100 : displayLimit
            };
        } else {
            return handleErrorResponse('유효하지 않은 모드입니다.');
        }

        const { data, error } = await SCM.get().wordsByAdvancedQuery(searchOptions);

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: error }, { status: 500 });
    }
}

function handleErrorResponse(message: string) {
    return NextResponse.json({ error: message }, { status: 400 });
}
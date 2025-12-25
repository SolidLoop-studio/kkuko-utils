import { NextRequest, NextResponse } from 'next/server';
import { SCM } from '@/app/lib/supabaseClient';
import { advancedQueryType } from '@/app/types/type';
import { GameMode } from '@/app/word/search/types';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    const mode = (searchParams.get('mode') || 'kor-start') as GameMode;
    const q = searchParams.get('q') || '';
    const mission = searchParams.get('mission') || '';
    const minLength = parseInt(searchParams.get('minLength') || '2');
    const maxLength = parseInt(searchParams.get('maxLength') || '100');
    const sortBy = (searchParams.get('sortBy') || 'length') as 'abc' | 'length' | 'attack';
    const duem = searchParams.get('duem') !== 'false';
    const miniInfo = searchParams.get('miniInfo') === 'true';
    const manner = searchParams.get('manner') || 'man';
    const ingjung = searchParams.get('ingjung') !== 'false';
    const displayLimit = parseInt(searchParams.get('limit') || '100');
    const themeId = searchParams.get('themeId');

    try {
        let query: advancedQueryType;

        if (mode === 'kor-start' || mode === 'kor-end') {
            const start = mode === 'kor-start' ? q : searchParams.get('start') || undefined;
            const end = mode === 'kor-end' ? q : searchParams.get('end') || undefined;

            if (mode === 'kor-start' && !start) return createErrorResponse('시작 초성이 필요합니다.');
            if (mode === 'kor-end' && !end) return createErrorResponse('끝 초성이 필요합니다.');

            query = {
                mode,
                start: start?.trim(),
                end: end?.trim(),
                mission,
                ingjung,
                man: manner === 'man',
                jen: manner === 'jen',
                eti: manner === 'eti',
                duem,
                miniInfo,
                length_min: minLength,
                length_max: maxLength,
                sort_by: sortBy,
                limit: isNaN(displayLimit) ? 100 : displayLimit
            };
        } else if (mode === 'kung') {
            if (!q) return createErrorResponse('단어가 필요합니다.');
            query = {
                mode: 'kung',
                start: q.trim().slice(0, 3),
                mission,
                ingjung,
                man: manner === 'man',
                jen: manner === 'jen',
                eti: manner === 'eti',
                duem,
                miniInfo,
                length_min: 3,
                length_max: 3,
                sort_by: sortBy,
                limit: isNaN(displayLimit) ? 100 : displayLimit
            };
        } else if (mode === 'hunmin') {
            if (q.trim().length !== 2) return createErrorResponse('훈민정음 쿼리는 2글자여야 합니다.');
            query = {
                mode: 'hunmin',
                query: q.trim(),
                mission,
                limit: isNaN(displayLimit) ? 100 : displayLimit
            };
        } else if (mode === 'jaqi') {
            if (!themeId) return createErrorResponse('테마 ID가 필요합니다.');
            query = {
                mode: 'jaqi',
                query: q.trim(),
                theme: Number(themeId),
                limit: isNaN(displayLimit) ? 100 : displayLimit
            };
        } else {
            return createErrorResponse('유효하지 않은 모드입니다.');
        }

        const { data, error } = await SCM.get().wordsByAdvancedQuery(query);

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: error }, { status: 500 });
    }
}

function createErrorResponse(message: string) {
    return NextResponse.json({ error: message }, { status: 400 });
}
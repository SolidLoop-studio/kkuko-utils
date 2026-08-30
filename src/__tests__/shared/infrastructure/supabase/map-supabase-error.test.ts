import { mapSupabaseError } from '@/src/shared/infrastructure/supabase/map-supabase-error';

describe('mapSupabaseError', () => {
    test.each([
        ['WORD_APPROVAL_UNAUTHORIZED', 'unauthorized'],
        ['WORD_APPROVAL_FORBIDDEN', 'forbidden'],
        ['WORD_APPROVAL_NOT_FOUND', 'not-found'],
        ['WORD_APPROVAL_CONFLICT', 'conflict'],
        ['WORD_APPROVAL_INVALID_INPUT', 'validation'],
    ] as const)('%s 오류를 %s로 매핑한다', (message, kind) => {
        expect(mapSupabaseError({ code: 'P0001', message })).toMatchObject({ kind });
    });

    it('알 수 없는 DB 오류의 내부 message를 UI message로 노출하지 않는다', () => {
        expect(mapSupabaseError({ code: 'XX000', message: 'relation secret failed' })).toEqual({
            kind: 'infrastructure',
            message: '데이터 처리 중 오류가 발생했습니다.',
            code: 'XX000',
        });
    });
});

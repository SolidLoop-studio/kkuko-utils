import {
    isNoInjungTheme,
    normalizeWordApprovalEntries,
    splitWordApprovalBatches,
} from '@/src/modules/word-moderation/domain/word-approval';

describe('word approval domain', () => {
    it('공백을 제거하고 중복 단어와 주제를 합친 뒤 결정적으로 정렬한다', () => {
        const result = normalizeWordApprovalEntries([
            { word: ' 나비 ', themeCodes: ['20', '10', '10'] },
            { word: '가방', themeCodes: ['30'] },
            { word: '나비', themeCodes: ['40'] },
        ]);

        expect(result).toEqual({
            ok: true,
            value: [
                { word: '가방', themeCodes: ['30'], noinCanUse: true },
                { word: '나비', themeCodes: ['10', '20', '40'], noinCanUse: true },
            ],
        });
    });

    it('빈 단어와 빈 주제 코드를 거부한다', () => {
        expect(normalizeWordApprovalEntries([{ word: ' ', themeCodes: ['10'] }])).toMatchObject({
            ok: false,
            error: { kind: 'validation', field: 'word' },
        });
        expect(normalizeWordApprovalEntries([{ word: '가방', themeCodes: [' '] }])).toMatchObject({
            ok: false,
            error: { kind: 'validation', field: 'themeCodes' },
        });
    });

    it('빈 입력도 거부한다', () => {
        expect(normalizeWordApprovalEntries([])).toMatchObject({
            ok: false,
            error: { kind: 'validation' },
        });
    });

    it('배치 크기는 1 이상 50 이하여야 한다', () => {
        expect(splitWordApprovalBatches([], 0)).toMatchObject({ ok: false });
        expect(splitWordApprovalBatches([], 51)).toMatchObject({ ok: false });
    });

    it('정규화된 단어를 지정한 크기의 배치로 나눈다', () => {
        const entries = normalizeWordApprovalEntries([
            { word: '다', themeCodes: ['10'] },
            { word: '가', themeCodes: ['10'] },
            { word: '나', themeCodes: ['10'] },
        ]);

        if (!entries.ok) throw new Error('expected normalized entries');

        expect(splitWordApprovalBatches(entries.value, 2)).toEqual({
            ok: true,
            value: [
                [entries.value[0], entries.value[1]],
                [entries.value[2]],
            ],
        });
    });

    it('어인정 주제 코드가 포함되어 있는지 판별한다', () => {
        expect(isNoInjungTheme(['999', '530'])).toBe(true);
        expect(isNoInjungTheme(['540', '999'])).toBe(false);
    });
});

import { GetDocsContentService } from '@/src/modules/docs/application/get-docs-content';
import { err, ok } from '@/src/shared/application/result';

describe('GetDocsContentService', () => {
    it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
        'rejects an invalid docs id of %s before loading content',
        async (docsId) => {
            const loadByDocsId = jest.fn();
            const service = new GetDocsContentService({ loadByDocsId });

            await expect(service.get(docsId)).resolves.toEqual(err({
                kind: 'validation',
                message: '올바른 문서 ID가 필요합니다.',
            }));
            expect(loadByDocsId).not.toHaveBeenCalled();
        },
    );

    it('converts a missing content projection into the stable not-found error', async () => {
        const loadByDocsId = jest.fn().mockResolvedValue(ok(null));
        const service = new GetDocsContentService({ loadByDocsId });

        await expect(service.get(61)).resolves.toEqual(err({
            kind: 'not-found',
            message: '문서를 찾을 수 없습니다.',
        }));
        expect(loadByDocsId).toHaveBeenCalledWith(61);
    });

    it('preserves successful projections and gateway errors unchanged', async () => {
        const projection = {
            metadata: { id: 61, title: '라', lastUpdatedAt: '2026-08-25T04:00:00.000Z', type: 'letter' as const },
            starredUserIds: ['user-1'],
            words: [{ word: '라디오', status: 'ok' as const }],
            isSpecial: false,
            isMissionParent: true,
        };
        const success = ok(projection);
        const failure = err({
            kind: 'infrastructure' as const,
            message: '문서 단어를 불러오는 중 오류가 발생했습니다.',
        });
        const loadByDocsId = jest.fn().mockResolvedValueOnce(success).mockResolvedValueOnce(failure);
        const service = new GetDocsContentService({ loadByDocsId });

        await expect(service.get(61)).resolves.toBe(success);
        await expect(service.get(61)).resolves.toBe(failure);
    });
});

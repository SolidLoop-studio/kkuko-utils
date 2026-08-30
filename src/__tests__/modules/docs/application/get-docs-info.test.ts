import { GetDocsInfoService } from '@/src/modules/docs/application/get-docs-info';
import { err, ok } from '@/src/shared/application/result';

describe('GetDocsInfoService', () => {
    it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
        'rejects an invalid docs id of %s before loading info',
        async (docsId) => {
            const loadByDocsId = jest.fn();
            const service = new GetDocsInfoService({ loadByDocsId });

            await expect(service.get(docsId)).resolves.toEqual(err({
                kind: 'validation',
                message: '올바른 문서 ID가 필요합니다.',
            }));
            expect(loadByDocsId).not.toHaveBeenCalled();
        },
    );

    it('converts a missing docs projection into the stable not-found error', async () => {
        const loadByDocsId = jest.fn().mockResolvedValue(ok(null));
        const service = new GetDocsInfoService({ loadByDocsId });

        await expect(service.get(51)).resolves.toEqual(err({
            kind: 'not-found',
            message: '문서를 찾을 수 없습니다.',
        }));
        expect(loadByDocsId).toHaveBeenCalledWith(51);
    });

    it('preserves a successful projection from its gateway', async () => {
        const result = ok({
            metadata: {
                id: 51,
                createdAt: '2026-08-01T00:00:00.000Z',
                name: '다',
                makerNickname: '제작자',
                type: 'letter' as const,
                lastUpdatedAt: '2026-08-25T03:00:00.000Z',
                views: 120,
            },
            wordCount: 32,
            starCount: 4,
            viewRank: 2,
        });
        const loadByDocsId = jest.fn().mockResolvedValue(result);
        const service = new GetDocsInfoService({ loadByDocsId });

        await expect(service.get(51)).resolves.toBe(result);
    });

    it('preserves a gateway error unchanged', async () => {
        const result = err({
            kind: 'infrastructure',
            message: '문서 정보를 불러오는 중 오류가 발생했습니다.',
        });
        const loadByDocsId = jest.fn().mockResolvedValue(result);
        const service = new GetDocsInfoService({ loadByDocsId });

        await expect(service.get(51)).resolves.toBe(result);
    });
});

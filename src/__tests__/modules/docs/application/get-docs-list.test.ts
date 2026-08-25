import { err, ok } from '@/src/shared/application/result';
import { GetDocsListService } from '@/src/modules/docs/application/get-docs-list';

describe('GetDocsListService', () => {
    it('returns the docs list provided by its gateway unchanged', async () => {
        const result = ok([{
            id: 31,
            name: '가',
            makerNickname: null,
            lastUpdatedAt: '2026-08-25T01:00:00.000Z',
            createdAt: '2026-08-20T01:00:00.000Z',
            type: 'letter' as const,
        }]);
        const loadAll = jest.fn().mockResolvedValue(result);
        const service = new GetDocsListService({ loadAll });

        await expect(service.get()).resolves.toBe(result);
        expect(loadAll).toHaveBeenCalledTimes(1);
    });

    it('returns a gateway error unchanged', async () => {
        const result = err({
            kind: 'infrastructure',
            message: '문서 목록을 불러오는 중 오류가 발생했습니다.',
        });
        const loadAll = jest.fn().mockResolvedValue(result);
        const service = new GetDocsListService({ loadAll });

        await expect(service.get()).resolves.toBe(result);
    });
});

import { GetDocsLogsService } from '@/src/modules/docs/application/get-docs-logs';
import { err, ok } from '@/src/shared/application/result';

describe('GetDocsLogsService', () => {
    it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
        'rejects an invalid docs id of %s before loading logs',
        async (docsId) => {
            const loadByDocsId = jest.fn();
            const service = new GetDocsLogsService({ loadByDocsId });

            await expect(service.get(docsId)).resolves.toEqual(err({
                kind: 'validation',
                message: '올바른 문서 ID가 필요합니다.',
            }));
            expect(loadByDocsId).not.toHaveBeenCalled();
        },
    );

    it('converts a missing docs projection into the stable not-found error', async () => {
        const loadByDocsId = jest.fn().mockResolvedValue(ok(null));
        const service = new GetDocsLogsService({ loadByDocsId });

        await expect(service.get(41)).resolves.toEqual(err({
            kind: 'not-found',
            message: '문서를 찾을 수 없습니다.',
        }));
        expect(loadByDocsId).toHaveBeenCalledWith(41);
    });

    it('preserves a successful projection from its gateway', async () => {
        const result = ok({
            docsId: 41,
            docsName: '나',
            entries: [{
                id: 9,
                word: '나라',
                userNickname: null,
                occurredAt: '2026-08-25T02:00:00.000Z',
                type: 'add' as const,
            }],
        });
        const loadByDocsId = jest.fn().mockResolvedValue(result);
        const service = new GetDocsLogsService({ loadByDocsId });

        await expect(service.get(41)).resolves.toBe(result);
    });

    it('preserves a gateway error unchanged', async () => {
        const result = err({
            kind: 'infrastructure',
            message: '문서 로그를 불러오는 중 오류가 발생했습니다.',
        });
        const loadByDocsId = jest.fn().mockResolvedValue(result);
        const service = new GetDocsLogsService({ loadByDocsId });

        await expect(service.get(41)).resolves.toBe(result);
    });
});

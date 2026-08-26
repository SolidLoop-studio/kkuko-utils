import { err, ok } from '@/src/shared/application/result';
import { GetDocsMarkersService } from '@/src/modules/docs/application/get-docs-markers';
import type { DocsMarker } from '@/src/modules/docs/application/docs-marker-query-types';

const markers: Array<DocsMarker | null> = [
    { character: '가', docsId: 901, lastUpdatedAt: '2026-08-25T01:00:00.000Z' },
    null,
];

describe('GetDocsMarkersService', () => {
    it('delegates a positive parent identity without assuming its database PK', async () => {
        // Break caught: rejecting remapped parent PKs or deriving child PKs in Application.
        const loadByParentDocsId = jest.fn().mockResolvedValue(ok(markers));
        const service = new GetDocsMarkersService({ loadByParentDocsId });

        await expect(service.get(7_301)).resolves.toEqual(ok(markers));
        expect(loadByParentDocsId).toHaveBeenCalledWith(7_301);
    });

    it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
        'rejects invalid parent identity %s before querying',
        async (parentDocsId) => {
            // Break caught: sending invalid external identities into the query adapter.
            const loadByParentDocsId = jest.fn();
            const service = new GetDocsMarkersService({ loadByParentDocsId });

            await expect(service.get(parentDocsId)).resolves.toEqual(err({
                kind: 'validation',
                message: '올바른 문서 ID가 필요합니다.',
            }));
            expect(loadByParentDocsId).not.toHaveBeenCalled();
        },
    );

    it('maps a missing parent row to the stable docs not-found error', async () => {
        // Break caught: exposing null as a successful marker collection.
        const loadByParentDocsId = jest.fn().mockResolvedValue(ok(null));
        const service = new GetDocsMarkersService({ loadByParentDocsId });

        await expect(service.get(7_301)).resolves.toEqual(err({
            kind: 'not-found',
            message: '문서를 찾을 수 없습니다.',
        }));
    });
});

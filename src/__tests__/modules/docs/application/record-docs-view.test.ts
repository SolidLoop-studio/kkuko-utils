import type { DocsViewCommandGateway } from '@/src/modules/docs/application/docs-view-command-ports';
import { RecordDocsViewService } from '@/src/modules/docs/application/record-docs-view';
import { ok, type Result } from '@/src/shared/application/result';

class FakeDocsViewCommandGateway implements DocsViewCommandGateway {
    readonly recordedDocsIds: number[] = [];

    result: Result<void> = ok(undefined);

    async record(docsId: number): Promise<Result<void>> {
        this.recordedDocsIds.push(docsId);
        return this.result;
    }
}

describe('RecordDocsViewService', () => {
    it('records a positive integer docs ID through its command gateway', async () => {
        // Break caught: changing the service to discard a valid view command or alter its ID.
        const gateway = new FakeDocsViewCommandGateway();
        const service = new RecordDocsViewService(gateway);

        await expect(service.record(55)).resolves.toEqual(ok(undefined));
        expect(gateway.recordedDocsIds).toEqual([55]);
    });

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
        'rejects invalid docs ID %p before the command gateway',
        async (docsId) => {
            // Break caught: allowing an invalid ID to reach the database command boundary.
            const gateway = new FakeDocsViewCommandGateway();
            const service = new RecordDocsViewService(gateway);

            await expect(service.record(docsId)).resolves.toEqual({
                ok: false,
                error: {
                    kind: 'validation',
                    message: '문서 조회 수 기록에 실패했습니다. 잠시 후 다시 시도해주세요.',
                },
            });
            expect(gateway.recordedDocsIds).toEqual([]);
        },
    );
});

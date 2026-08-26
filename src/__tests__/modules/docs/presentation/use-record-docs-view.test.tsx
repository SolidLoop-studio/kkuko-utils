import { act, renderHook } from '@testing-library/react';

jest.mock(
    '../../../../modules/docs/infrastructure/browser/browser-docs-services',
    () => ({ createBrowserDocsServices: jest.fn() }),
);

import { err, ok, type Result } from '@/src/shared/application/result';
import { createBrowserDocsServices } from '@/src/modules/docs/infrastructure/browser/browser-docs-services';
import { useRecordDocsView } from '@/src/modules/docs/presentation/use-record-docs-view';

const infrastructureError = {
    kind: 'infrastructure' as const,
    message: '문서 조회 수 기록에 실패했습니다. 잠시 후 다시 시도해주세요.',
};

const mockRecordService = (handler: (docsId: number) => Promise<Result<void>>) => {
    const recordedDocsIds: number[] = [];
    jest.mocked(createBrowserDocsServices).mockReturnValue({
        docsViewCommandService: {
            record: async (docsId: number) => {
                recordedDocsIds.push(docsId);
                return handler(docsId);
            },
        },
    } as unknown as ReturnType<typeof createBrowserDocsServices>);
    return recordedDocsIds;
};

describe('useRecordDocsView', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('forwards a successful view command without exposing a result to the page', async () => {
        // Break caught: failing to dispatch a successful view command after a page render succeeds.
        const recordedDocsIds = mockRecordService(async () => ok(undefined));
        const { result } = renderHook(() => useRecordDocsView());

        let recordResult: void;
        await act(async () => {
            recordResult = await result.current.record(55);
        });

        expect(recordResult!).toBeUndefined();
        expect(recordedDocsIds).toEqual([55]);
    });

    it.each([
        ['a fulfilled error Result', async () => err(infrastructureError)],
        ['a rejected service promise', async () => { throw new Error('private failure'); }],
    ])('discards %s because recording a view is best effort', async (_description, handler) => {
        // Break caught: allowing a best-effort view failure to reject into the successfully rendered page.
        const recordedDocsIds = mockRecordService(handler);
        const { result } = renderHook(() => useRecordDocsView());

        await expect(act(async () => result.current.record(55))).resolves.toBeUndefined();
        expect(recordedDocsIds).toEqual([55]);
    });
});

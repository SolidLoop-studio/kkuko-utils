import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/docs/infrastructure/browser/browser-docs-services',
    () => ({ createBrowserDocsServices: jest.fn() }),
);

import { ok } from '@/src/shared/application/result';
import type { DocsMarker } from '@/src/modules/docs/application/docs-marker-query-types';
import { createBrowserDocsServices } from '@/src/modules/docs/infrastructure/browser/browser-docs-services';
import { useDocsMarkers } from '@/src/modules/docs/presentation/use-docs-markers';

const markers: Array<DocsMarker | null> = [
    { character: '가', docsId: 901, lastUpdatedAt: '2026-08-25T01:00:00.000Z' },
    null,
];

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    return {
        queryClient,
        Wrapper: ({ children }: PropsWithChildren) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
    };
};

describe('useDocsMarkers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('caches the semantic marker projection by parent docs ID', async () => {
        // Break caught: a global marker cache mixing different mission parents.
        const get = jest.fn().mockResolvedValue(ok(markers));
        jest.mocked(createBrowserDocsServices).mockReturnValue({
            docsMarkerQueryService: { get },
        } as unknown as ReturnType<typeof createBrowserDocsServices>);
        const { queryClient, Wrapper } = createWrapper();

        const { result } = renderHook(() => useDocsMarkers(7_301, true), { wrapper: Wrapper });

        await waitFor(() => expect(result.current.data).toEqual(markers));
        expect(queryClient.getQueryData(['docs', 7_301, 'markers'])).toEqual(markers);
        expect(get).toHaveBeenCalledWith(7_301);
    });

    it('does not query when the current page is not a recognized mission parent', () => {
        // Break caught: loading marker data on every ordinary docs page.
        const get = jest.fn().mockResolvedValue(ok(markers));
        jest.mocked(createBrowserDocsServices).mockReturnValue({
            docsMarkerQueryService: { get },
        } as unknown as ReturnType<typeof createBrowserDocsServices>);
        const { Wrapper } = createWrapper();

        const { result } = renderHook(() => useDocsMarkers(55, false), { wrapper: Wrapper });

        expect(result.current.fetchStatus).toBe('idle');
        expect(get).not.toHaveBeenCalled();
    });
});

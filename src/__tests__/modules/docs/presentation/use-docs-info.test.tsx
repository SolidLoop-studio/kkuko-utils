import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/docs/infrastructure/browser/browser-docs-services',
    () => ({ createBrowserDocsServices: jest.fn() }),
);

import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { DocsInfoProjection } from '@/src/modules/docs/application/docs-info-query-types';
import { createBrowserDocsServices } from '@/src/modules/docs/infrastructure/browser/browser-docs-services';
import { useDocsInfo } from '@/src/modules/docs/presentation/use-docs-info';

const projection: DocsInfoProjection = {
    metadata: {
        id: 51,
        createdAt: '2026-08-01T00:00:00.000Z',
        name: '다',
        makerNickname: '제작자',
        type: 'letter',
        lastUpdatedAt: '2026-08-25T03:00:00.000Z',
        views: 120,
    },
    wordCount: 32,
    starCount: 4,
    viewRank: 2,
};

const refreshedProjection: DocsInfoProjection = {
    ...projection,
    wordCount: 33,
};

const createQueryWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retryDelay: 0, gcTime: Infinity },
        },
    });

    return {
        queryClient,
        QueryWrapper: ({ children }: PropsWithChildren) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
    };
};

const mockDocsInfoQueryService = (result: Result<DocsInfoProjection>) => {
    const get = jest.fn().mockResolvedValue(result);
    (createBrowserDocsServices as jest.MockedFunction<typeof createBrowserDocsServices>)
        .mockReturnValue({
            docsListQueryService: {} as never,
            docsLogsQueryService: {} as never,
            docsRequestModerationService: {} as never,
            docsRequestQueryService: {} as never,
            docsInfoQueryService: { get },
        } as unknown as ReturnType<typeof createBrowserDocsServices>);
    return get;
};

describe('useDocsInfo', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('caches a docs info projection at the docs id info query key', async () => {
        const get = mockDocsInfoQueryService(ok(projection));
        const { queryClient, QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useDocsInfo(51), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.data).toEqual(projection));

        expect(queryClient.getQueryData(['docs', 51, 'info'])).toEqual(projection);
        expect(get).toHaveBeenCalledWith(51);
    });

    it('replaces the current info projection when refetched', async () => {
        const get = mockDocsInfoQueryService(ok(projection));
        get.mockResolvedValueOnce(ok(projection)).mockResolvedValueOnce(ok(refreshedProjection));
        const { queryClient, QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useDocsInfo(51), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.data).toEqual(projection));
        await act(async () => {
            await result.current.refetch();
        });

        await waitFor(() => expect(result.current.data).toEqual(refreshedProjection));
        expect(queryClient.getQueryData(['docs', 51, 'info'])).toEqual(refreshedProjection);
        expect(get).toHaveBeenNthCalledWith(2, 51);
    });

    it('exposes a validation error without retrying', async () => {
        const validationError: ApplicationError = {
            kind: 'validation',
            message: '올바른 문서 ID가 필요합니다.',
        };
        const get = mockDocsInfoQueryService(err(validationError));
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useDocsInfo(0), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual(validationError));
        expect(get).toHaveBeenCalledTimes(1);
    });

    it('retries an infrastructure error up to the established limit', async () => {
        const infrastructureError: ApplicationError = {
            kind: 'infrastructure',
            message: '문서 정보를 불러오는 중 오류가 발생했습니다.',
        };
        const get = mockDocsInfoQueryService(err(infrastructureError));
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useDocsInfo(51), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual(infrastructureError));
        expect(get).toHaveBeenCalledTimes(4);
    });
});

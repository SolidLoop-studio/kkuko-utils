import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock('../../../../modules/docs/infrastructure/browser/browser-docs-services', () => ({
    createBrowserDocsServices: jest.fn(),
}));

import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { DocsContentProjection } from '@/src/modules/docs/application/docs-content-query-types';
import { createBrowserDocsServices } from '@/src/modules/docs/infrastructure/browser/browser-docs-services';
import { useDocsContent } from '@/src/modules/docs/presentation/use-docs-content';

const projection: DocsContentProjection = {
    metadata: { id: 61, title: '라', lastUpdatedAt: '2026-08-25T04:00:00.000Z', type: 'letter' },
    starredUserIds: ['user-1'],
    words: [{ word: '라디오', status: 'ok' }],
    missionCharacter: null,
    isSpecial: false,
    isMissionParent: false,
};

const refreshedProjection: DocsContentProjection = {
    ...projection,
    words: [{ word: '라면', status: 'add', requesterNickname: '요청자' }],
};

const createQueryWrapper = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: Infinity } } });
    return {
        queryClient,
        QueryWrapper: ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    };
};

const mockDocsContentQueryService = (result: Result<DocsContentProjection>) => {
    const get = jest.fn().mockResolvedValue(result);
    (createBrowserDocsServices as jest.MockedFunction<typeof createBrowserDocsServices>).mockReturnValue({
        docsListQueryService: {} as never,
        docsLogsQueryService: {} as never,
        docsInfoQueryService: {} as never,
        docsRequestModerationService: {} as never,
        docsRequestQueryService: {} as never,
        docsContentQueryService: { get },
    } as unknown as ReturnType<typeof createBrowserDocsServices>);
    return get;
};

describe('useDocsContent', () => {
    beforeEach(() => jest.clearAllMocks());

    it('caches a docs content projection at the docs id content key and replaces it on refetch', async () => {
        const get = mockDocsContentQueryService(ok(projection));
        get.mockResolvedValueOnce(ok(projection)).mockResolvedValueOnce(ok(refreshedProjection));
        const { queryClient, QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useDocsContent(61), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.data).toEqual(projection));
        await act(async () => { await result.current.refetch(); });

        await waitFor(() => expect(result.current.data).toEqual(refreshedProjection));
        expect(queryClient.getQueryData(['docs', 61, 'content'])).toEqual(refreshedProjection);
        expect(get).toHaveBeenNthCalledWith(1, 61);
        expect(get).toHaveBeenNthCalledWith(2, 61);
    });

    it('exposes validation errors without retrying and retries infrastructure errors to the established limit', async () => {
        const validation: ApplicationError = { kind: 'validation', message: '올바른 문서 ID가 필요합니다.' };
        const validationGet = mockDocsContentQueryService(err(validation));
        const { QueryWrapper: validationWrapper } = createQueryWrapper();
        const validationResult = renderHook(() => useDocsContent(0), { wrapper: validationWrapper });
        await waitFor(() => expect(validationResult.result.current.error).toEqual(validation));
        expect(validationGet).toHaveBeenCalledTimes(1);

        const infrastructure: ApplicationError = { kind: 'infrastructure', message: '문서 단어를 불러오는 중 오류가 발생했습니다.' };
        const infrastructureGet = mockDocsContentQueryService(err(infrastructure));
        const { QueryWrapper: infrastructureWrapper } = createQueryWrapper();
        const infrastructureResult = renderHook(() => useDocsContent(61), { wrapper: infrastructureWrapper });
        await waitFor(() => expect(infrastructureResult.result.current.error).toEqual(infrastructure));
        expect(infrastructureGet).toHaveBeenCalledTimes(4);
    });

    it('exposes a not-found error without retrying', async () => {
        const notFound: ApplicationError = { kind: 'not-found', message: '문서를 찾을 수 없습니다.' };
        const get = mockDocsContentQueryService(err(notFound));
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useDocsContent(61), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual(notFound));

        expect(get).toHaveBeenCalledTimes(1);
    });
});

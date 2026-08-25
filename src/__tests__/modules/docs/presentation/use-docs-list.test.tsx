import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/docs/infrastructure/browser/browser-docs-services',
    () => ({ createBrowserDocsServices: jest.fn() }),
);

import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { DocsSummary } from '@/src/modules/docs/application/docs-list-query-types';
import { createBrowserDocsServices } from '@/src/modules/docs/infrastructure/browser/browser-docs-services';
import { useDocsList } from '@/src/modules/docs/presentation/use-docs-list';

const docsSummary: DocsSummary = {
    id: 31,
    name: '가',
    makerNickname: null,
    lastUpdatedAt: '2026-08-25T01:00:00.000Z',
    createdAt: '2026-08-20T01:00:00.000Z',
    type: 'letter',
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

const mockDocsListQueryService = (result: Result<DocsSummary[]>) => {
    const get = jest.fn().mockResolvedValue(result);
    (createBrowserDocsServices as jest.MockedFunction<typeof createBrowserDocsServices>)
        .mockReturnValue({
            docsRequestModerationService: {} as never,
            docsRequestQueryService: {} as never,
            docsListQueryService: { get },
        } as unknown as ReturnType<typeof createBrowserDocsServices>);
    return get;
};

describe('useDocsList', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('caches docs summaries at the docs list query key', async () => {
        const get = mockDocsListQueryService(ok([docsSummary]));
        const { queryClient, QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useDocsList(), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.data).toEqual([docsSummary]));

        expect(queryClient.getQueryData(['docs', 'list'])).toEqual([docsSummary]);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it('exposes a stable validation error without retrying', async () => {
        const validationError: ApplicationError = {
            kind: 'validation',
            field: 'docs',
            message: '문서 목록을 불러올 수 없습니다.',
        };
        const get = mockDocsListQueryService(err(validationError));
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useDocsList(), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual(validationError));

        expect(get).toHaveBeenCalledTimes(1);
    });

    it('retries an infrastructure error up to the established limit', async () => {
        const infrastructureError: ApplicationError = {
            kind: 'infrastructure',
            message: '문서 목록을 불러오는 중 오류가 발생했습니다.',
        };
        const get = mockDocsListQueryService(err(infrastructureError));
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useDocsList(), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual(infrastructureError));

        expect(get).toHaveBeenCalledTimes(4);
    });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/docs/infrastructure/browser/browser-docs-services',
    () => ({ createBrowserDocsServices: jest.fn() }),
);

import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { DocsLogProjection } from '@/src/modules/docs/application/docs-log-query-types';
import { createBrowserDocsServices } from '@/src/modules/docs/infrastructure/browser/browser-docs-services';
import { useDocsLogs } from '@/src/modules/docs/presentation/use-docs-logs';

const projection: DocsLogProjection = {
    docsId: 41,
    docsName: '나',
    entries: [{
        id: 9,
        word: '나라',
        userNickname: null,
        occurredAt: '2026-08-25T02:00:00.000Z',
        type: 'add',
    }],
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

const mockDocsLogsQueryService = (result: Result<DocsLogProjection>) => {
    const get = jest.fn().mockResolvedValue(result);
    (createBrowserDocsServices as jest.MockedFunction<typeof createBrowserDocsServices>)
        .mockReturnValue({
            docsListQueryService: {} as never,
            docsRequestModerationService: {} as never,
            docsRequestQueryService: {} as never,
            docsLogsQueryService: { get },
        } as unknown as ReturnType<typeof createBrowserDocsServices>);
    return get;
};

describe('useDocsLogs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('caches a docs log projection at the docs id log query key', async () => {
        const get = mockDocsLogsQueryService(ok(projection));
        const { queryClient, QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useDocsLogs(41), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.data).toEqual(projection));

        expect(queryClient.getQueryData(['docs', 41, 'logs'])).toEqual(projection);
        expect(get).toHaveBeenCalledWith(41);
    });

    it('exposes a validation error without retrying', async () => {
        const validationError: ApplicationError = {
            kind: 'validation',
            message: '올바른 문서 ID가 필요합니다.',
        };
        const get = mockDocsLogsQueryService(err(validationError));
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useDocsLogs(0), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual(validationError));

        expect(get).toHaveBeenCalledTimes(1);
    });

    it('retries an infrastructure error up to the established limit', async () => {
        const infrastructureError: ApplicationError = {
            kind: 'infrastructure',
            message: '문서 로그를 불러오는 중 오류가 발생했습니다.',
        };
        const get = mockDocsLogsQueryService(err(infrastructureError));
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useDocsLogs(41), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual(infrastructureError));

        expect(get).toHaveBeenCalledTimes(4);
    });
});

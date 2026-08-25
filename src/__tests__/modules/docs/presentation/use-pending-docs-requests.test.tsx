import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/docs/infrastructure/browser/browser-docs-services',
    () => ({ createBrowserDocsServices: jest.fn() }),
);

import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { PendingDocsRequest } from '@/src/modules/docs/application/docs-request-query-types';
import { createBrowserDocsServices } from '@/src/modules/docs/infrastructure/browser/browser-docs-services';
import { usePendingDocsRequests } from '@/src/modules/docs/presentation/use-pending-docs-requests';

const pendingRequest: PendingDocsRequest = {
    id: 11,
    requestedAt: '2026-08-22T00:00:00.000Z',
    docsName: '가',
    requesterNickname: '신청자 A',
    requesterId: '00000000-0000-0000-0000-000000000011',
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

const mockDocsRequestQueryService = (
    result: Result<PendingDocsRequest[]>,
) => {
    const get = jest.fn().mockResolvedValue(result);
    (createBrowserDocsServices as jest.MockedFunction<typeof createBrowserDocsServices>)
        .mockReturnValue({
            docsRequestModerationService: {} as never,
            docsRequestQueryService: { get },
        } as unknown as ReturnType<typeof createBrowserDocsServices>);
    return get;
};

describe('usePendingDocsRequests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('caches successful pending requests at the pending docs request query key', async () => {
        const get = mockDocsRequestQueryService(ok([pendingRequest]));
        const { queryClient, QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => usePendingDocsRequests(), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.data).toEqual([pendingRequest]));

        expect(queryClient.getQueryData(['docs', 'requests', 'pending'])).toEqual([pendingRequest]);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it('exposes a validation error without retrying', async () => {
        const validationError: ApplicationError = {
            kind: 'validation',
            field: 'request',
            message: '문서 요청이 올바르지 않습니다.',
        };
        const get = mockDocsRequestQueryService(err(validationError));
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => usePendingDocsRequests(), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual(validationError));

        expect(get).toHaveBeenCalledTimes(1);
    });

    it('retries an infrastructure error up to the established limit', async () => {
        const infrastructureError: ApplicationError = {
            kind: 'infrastructure',
            message: '문서 요청 목록을 불러오는 중 오류가 발생했습니다.',
        };
        const get = mockDocsRequestQueryService(err(infrastructureError));
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => usePendingDocsRequests(), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual(infrastructureError));

        expect(get).toHaveBeenCalledTimes(4);
    });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock('../../../../modules/word-moderation/infrastructure/browser/browser-word-moderation-services', () => ({
    createBrowserWordModerationServices: jest.fn(),
}));

import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { PendingWordModerationRequest } from '@/src/modules/word-moderation/application/pending-word-moderation-query-types';
import { createBrowserWordModerationServices } from '@/src/modules/word-moderation/infrastructure/browser/browser-word-moderation-services';
import { usePendingWordModerationRequests } from '@/src/modules/word-moderation/presentation/use-pending-word-moderation-requests';

const request: PendingWordModerationRequest = {
    id: 11,
    word: '가나',
    requestType: 'delete',
    requestedAt: '2026-08-26T00:00:00.000Z',
    requesterNickname: '신청자',
};

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retryDelay: 0, gcTime: Infinity } },
    });
    return {
        queryClient,
        QueryWrapper: ({ children }: PropsWithChildren) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
    };
};

const mockService = (result: Result<PendingWordModerationRequest[]>) => {
    const get = jest.fn().mockResolvedValue(result);
    (createBrowserWordModerationServices as jest.MockedFunction<typeof createBrowserWordModerationServices>)
        .mockReturnValue({ pendingWordModerationQueryService: { get } } as unknown as ReturnType<typeof createBrowserWordModerationServices>);
    return get;
};

describe('usePendingWordModerationRequests', () => {
    beforeEach(() => jest.clearAllMocks());

    it('caches the successful queue under the feature-owned query key', async () => {
        const get = mockService(ok([request]));
        const { queryClient, QueryWrapper } = createWrapper();
        const { result } = renderHook(() => usePendingWordModerationRequests(), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.data).toEqual([request]));

        expect(queryClient.getQueryData(['word-moderation', 'requests', 'pending'])).toEqual([request]);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it('retries infrastructure failures only up to the established query limit', async () => {
        const failure: ApplicationError = {
            kind: 'infrastructure',
            message: '단어 요청 목록을 불러오는 중 오류가 발생했습니다.',
        };
        const get = mockService(err(failure));
        const { QueryWrapper } = createWrapper();
        const { result } = renderHook(() => usePendingWordModerationRequests(), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual(failure));

        expect(get).toHaveBeenCalledTimes(4);
    });

    it('maps a rejected service promise to the same stable infrastructure error', async () => {
        const get = jest.fn().mockRejectedValue(new Error('private failure'));
        (createBrowserWordModerationServices as jest.MockedFunction<typeof createBrowserWordModerationServices>)
            .mockReturnValue({ pendingWordModerationQueryService: { get } } as unknown as ReturnType<typeof createBrowserWordModerationServices>);
        const { QueryWrapper } = createWrapper();
        const { result } = renderHook(() => usePendingWordModerationRequests(), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.error).toEqual({
            kind: 'infrastructure',
            message: '단어 요청 목록을 불러오는 중 오류가 발생했습니다.',
        }));
        expect(get).toHaveBeenCalledTimes(4);
    });
});

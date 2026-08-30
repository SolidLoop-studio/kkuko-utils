import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/word-catalog/infrastructure/browser/browser-word-catalog-services',
    () => ({ createBrowserWordCatalogServices: jest.fn() }),
);

import type { ApplicationError } from '../../../../shared/application/application-error';
import { err, ok } from '../../../../shared/application/result';
import {
    useWordStatistics,
    type WordStatistics,
    type WordStatisticsService,
} from '../../../../modules/word-catalog';
import { createBrowserWordCatalogServices } from '../../../../modules/word-catalog/infrastructure/browser/browser-word-catalog-services';

const statistics: WordStatistics = {
    firstLetter: [{
        letter: '가',
        acknowledgedCount: 11,
        notAcknowledgedCount: 7,
        acknowledgedUpdatedAt: '2026-08-24T00:00:00Z',
        notAcknowledgedUpdatedAt: null,
    }],
    lastLetter: [],
    threeLetter: [],
};

const createQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: { retry: 3, retryDelay: 0, gcTime: Infinity },
    },
});

const createQueryWrapper = (queryClient: QueryClient) => (
    function QueryWrapper({ children }: PropsWithChildren) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }
);

const createService = (): jest.Mocked<WordStatisticsService> => ({
    get: jest.fn().mockResolvedValue(ok(statistics)),
});

const mockBrowserServices = (service: WordStatisticsService) => {
    jest.mocked(createBrowserWordCatalogServices).mockReturnValue({
        wordStatisticsService: service,
    } as ReturnType<typeof createBrowserWordCatalogServices>);
};

describe('useWordStatistics', () => {
    test('caches the statistics projection under the statistics query key', async () => {
        const service = createService();
        mockBrowserServices(service);
        const queryClient = createQueryClient();
        const { result } = renderHook(() => useWordStatistics(), {
            wrapper: createQueryWrapper(queryClient),
        });

        await waitFor(() => expect(result.current.data).toEqual(statistics));
        expect(queryClient.getQueryData(['word-catalog', 'statistics'])).toEqual(statistics);
    });

    test('exposes an application failure as the typed query error without retrying validation', async () => {
        const service = createService();
        const validationError: ApplicationError = {
            kind: 'validation',
            message: '통계를 조회할 수 없습니다.',
        };
        service.get.mockResolvedValue(err(validationError));
        mockBrowserServices(service);
        const queryClient = createQueryClient();
        const { result } = renderHook(() => useWordStatistics(), {
            wrapper: createQueryWrapper(queryClient),
        });

        await waitFor(() => expect(result.current.error).toEqual(validationError));
        expect(service.get).toHaveBeenCalledTimes(1);
    });

    test('uses the shared retry policy for infrastructure failures', async () => {
        const service = createService();
        service.get.mockResolvedValue(err({
            kind: 'infrastructure',
            message: '데이터를 불러오는 중 오류가 발생했습니다.',
        }));
        mockBrowserServices(service);
        const queryClient = createQueryClient();
        const { result } = renderHook(() => useWordStatistics(), {
            wrapper: createQueryWrapper(queryClient),
        });

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(service.get).toHaveBeenCalledTimes(4);
    });
});

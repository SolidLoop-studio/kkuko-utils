import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/word-catalog/infrastructure/browser/browser-word-catalog-services',
    () => ({ createBrowserWordCatalogServices: jest.fn() }),
);

import {
    useWordCombinerCandidates,
    type WordCombinerCandidateService,
} from '../../../../modules/word-catalog';
import { createBrowserWordCatalogServices } from '../../../../modules/word-catalog/infrastructure/browser/browser-word-catalog-services';
import { err, ok } from '../../../../shared/application/result';

const candidates = [{ word: '가나다라마' }, { word: '바사아자차카' }];

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

const createService = (): jest.Mocked<WordCombinerCandidateService> => ({
    get: jest.fn().mockResolvedValue(ok(candidates)),
});

const mockBrowserServices = (service: WordCombinerCandidateService) => {
    jest.mocked(createBrowserWordCatalogServices).mockReturnValue({
        wordCombinerCandidateService: service,
    } as ReturnType<typeof createBrowserWordCatalogServices>);
};

describe('useWordCombinerCandidates', () => {
    test('stores candidates in the shared React Query cache', async () => {
        const service = createService();
        mockBrowserServices(service);
        const queryClient = createQueryClient();
        const { result } = renderHook(() => useWordCombinerCandidates(), {
            wrapper: createQueryWrapper(queryClient),
        });

        await waitFor(() => expect(result.current.data).toEqual(candidates));
        expect(queryClient.getQueryData(['word-catalog', 'word-combiner-candidates']))
            .toEqual(candidates);
        expect(service.get).toHaveBeenCalledTimes(1);
    });

    test('exposes only the stable application error after the shared infrastructure retry policy', async () => {
        const service = createService();
        const safeError = {
            kind: 'infrastructure' as const,
            message: '단어 조합기 데이터를 불러오는 중 오류가 발생했습니다.',
        };
        service.get.mockResolvedValue(err(safeError));
        mockBrowserServices(service);
        const queryClient = createQueryClient();
        const { result } = renderHook(() => useWordCombinerCandidates(), {
            wrapper: createQueryWrapper(queryClient),
        });

        await waitFor(() => expect(result.current.error).toEqual(safeError));
        expect(service.get).toHaveBeenCalledTimes(4);
    });
});

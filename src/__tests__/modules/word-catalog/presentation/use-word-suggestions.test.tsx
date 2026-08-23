import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/word-catalog/infrastructure/browser/browser-word-catalog-services',
    () => ({ createBrowserWordCatalogServices: jest.fn() }),
);

import { err, ok } from '../../../../shared/application/result';
import {
    useWordSuggestions,
    type WordCatalogSearchService,
} from '../../../../modules/word-catalog';

const createQueryWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: Infinity } },
    });

    return function QueryWrapper({ children }: PropsWithChildren) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
};

const createService = (): jest.Mocked<WordCatalogSearchService> => ({
    search: jest.fn().mockResolvedValue(ok([])),
    suggest: jest.fn().mockResolvedValue(ok(['가나', '가나다'])),
    listThemes: jest.fn().mockResolvedValue(ok([])),
});

describe('useWordSuggestions', () => {
    test('does not query for blank input', () => {
        const service = createService();

        const { result } = renderHook(() => useWordSuggestions('   ', service), {
            wrapper: createQueryWrapper(),
        });

        expect(service.suggest).not.toHaveBeenCalled();
        expect(result.current.data).toBeUndefined();
    });

    test('returns suggestions for a committed non-empty query', async () => {
        const service = createService();
        const { result } = renderHook(() => useWordSuggestions(' 가 ', service), {
            wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.data).toEqual(['가나', '가나다']));
        expect(service.suggest).toHaveBeenCalledWith('가');
    });

    test('exposes a stable application failure', async () => {
        const service = createService();
        service.suggest.mockResolvedValue(err({
            kind: 'infrastructure',
            message: '데이터를 불러오는 중 오류가 발생했습니다.',
        }));
        const { result } = renderHook(() => useWordSuggestions('가', service), {
            wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.error).toEqual({
            kind: 'infrastructure',
            message: '데이터를 불러오는 중 오류가 발생했습니다.',
        }));
    });
});

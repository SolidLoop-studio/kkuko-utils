import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/word-catalog/infrastructure/browser/browser-word-catalog-services',
    () => ({ createBrowserWordCatalogServices: jest.fn() }),
);

import type { ApplicationError } from '../../../../shared/application/application-error';
import { err, ok, type Result } from '../../../../shared/application/result';
import {
    useWordCatalogSearch,
    type WordCatalogSearchService,
    type WordSearchRequest,
    type WordSearchResult,
} from '../../../../modules/word-catalog';

const createQueryWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: 3, retryDelay: 0, gcTime: Infinity },
        },
    });

    return function QueryWrapper({ children }: PropsWithChildren) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
};

const createService = (
    searchResult: Result<WordSearchResult[]>,
): jest.Mocked<WordCatalogSearchService> => ({
    search: jest.fn().mockResolvedValue(searchResult),
    suggest: jest.fn().mockResolvedValue(ok([])),
    listThemes: jest.fn().mockResolvedValue(ok([])),
});

describe('useWordCatalogSearch', () => {
    test('caches results by the request key across equivalent request objects', async () => {
        const service = createService(ok([{ word: '가나', nextWordCount: -1 }]));
        const initialRequest: WordSearchRequest = { type: 'simple', query: '가' };
        const { result, rerender } = renderHook(
            ({ request }: { request: WordSearchRequest }) => (
                useWordCatalogSearch(request, service)
            ),
            {
                wrapper: createQueryWrapper(),
                initialProps: { request: initialRequest },
            },
        );

        await waitFor(() => {
            expect(result.current.data).toEqual([{ word: '가나', nextWordCount: -1 }]);
        });
        rerender({ request: { type: 'simple', query: '가' } });

        expect(service.search).toHaveBeenCalledTimes(1);
    });

    test('exposes an application failure as the typed query error without retrying validation', async () => {
        const validationError: ApplicationError = {
            kind: 'validation',
            field: 'query',
            message: '검색어가 필요합니다.',
        };
        const service = createService(err(validationError));
        const { result } = renderHook(
            () => useWordCatalogSearch({ type: 'simple', query: '!' }, service),
            { wrapper: createQueryWrapper() },
        );

        await waitFor(() => expect(result.current.error).toEqual(validationError));
        expect(service.search).toHaveBeenCalledTimes(1);
    });

    test('converts a thrown dependency error to a stable application error', async () => {
        const service = createService(ok([]));
        service.search.mockRejectedValue(new Error('database connection secret'));
        const { result } = renderHook(
            () => useWordCatalogSearch({ type: 'simple', query: '가' }, service),
            { wrapper: createQueryWrapper() },
        );

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.error).toEqual({
            kind: 'infrastructure',
            message: '단어 검색 중 오류가 발생했습니다.',
        });
        expect(result.current.error?.message).not.toContain('secret');
    });

    test('does not search until a request is committed', () => {
        const service = createService(ok([]));

        renderHook(() => useWordCatalogSearch(null, service), {
            wrapper: createQueryWrapper(),
        });

        expect(service.search).not.toHaveBeenCalled();
    });
});

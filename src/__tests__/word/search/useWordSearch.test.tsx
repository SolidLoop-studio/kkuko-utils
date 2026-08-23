import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';
import type { PropsWithChildren } from 'react';

import { ok } from '../../../shared/application/result';
import type { WordCatalogSearchService } from '../../../modules/word-catalog';
import { useWordSearch } from '../../../app/word/search/hooks/useWordSearch';

jest.mock('next/navigation', () => ({
    useSearchParams: jest.fn(),
}));
jest.mock(
    '../../../modules/word-catalog/infrastructure/browser/browser-word-catalog-services',
    () => ({ createBrowserWordCatalogServices: jest.fn() }),
);

const mockUseSearchParams = useSearchParams as jest.MockedFunction<typeof useSearchParams>;

const createQueryWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });

    return function QueryWrapper({ children }: PropsWithChildren) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
};

const createService = (): jest.Mocked<WordCatalogSearchService> => ({
    search: jest.fn().mockResolvedValue(ok([{ word: '가나', nextWordCount: -1 }])),
    suggest: jest.fn().mockResolvedValue(ok([])),
    listThemes: jest.fn().mockResolvedValue(ok([])),
});

describe('useWordSearch', () => {
    beforeEach(() => {
        mockUseSearchParams.mockReturnValue(
            new URLSearchParams() as unknown as ReturnType<typeof useSearchParams>,
        );
    });

    test('commits a normalized simple request only when submitted', async () => {
        const service = createService();
        const { result } = renderHook(() => useWordSearch(service), {
            wrapper: createQueryWrapper(),
        });

        act(() => result.current.setSimpleQuery('  가  '));
        expect(service.search).not.toHaveBeenCalled();

        act(() => result.current.handleSimpleSearch());

        await waitFor(() => expect(result.current.results).toEqual([
            { word: '가나', nextWordCount: -1 },
        ]));
        expect(service.search).toHaveBeenCalledWith({ type: 'simple', query: '가' });
        expect(result.current.committedRequest).toEqual({ type: 'simple', query: '가' });
        expect(result.current.searchPerformed).toBe(true);
    });

    test('maps the current advanced form state to an application request on submit', async () => {
        const service = createService();
        const { result } = renderHook(() => useWordSearch(service), {
            wrapper: createQueryWrapper(),
        });

        act(() => {
            result.current.setSearchType('advanced');
            result.current.setStartLetter(' 가 ');
            result.current.setEndLetter(' 나 ');
            result.current.setMission(' 다 ');
            result.current.setDisplayLimit('-1');
        });
        expect(service.search).not.toHaveBeenCalled();

        act(() => result.current.handleSearch());

        await waitFor(() => expect(service.search).toHaveBeenCalledWith({
            type: 'advanced',
            query: {
                mode: 'kor-start',
                start: '가',
                end: '나',
                mission: '다',
                isAcceptedOnly: true,
                isManner: true,
                isJen: false,
                isEtiquette: false,
                isDuemApplied: true,
                minimumLength: 2,
                maximumLength: 100,
                sortOrder: 'length',
                limit: -1,
            },
        }));
    });

    test('changing the game mode clears the committed result request', async () => {
        const service = createService();
        const { result } = renderHook(() => useWordSearch(service), {
            wrapper: createQueryWrapper(),
        });

        act(() => result.current.setSimpleQuery('가'));
        act(() => result.current.handleSimpleSearch());
        await waitFor(() => expect(result.current.results).toHaveLength(1));

        act(() => result.current.setMode('kung'));

        expect(result.current.mode).toBe('kung');
        expect(result.current.committedRequest).toBeNull();
        expect(result.current.results).toEqual([]);
        expect(result.current.searchPerformed).toBe(false);
    });

    test('clearSearch clears the committed result request', async () => {
        const service = createService();
        const { result } = renderHook(() => useWordSearch(service), {
            wrapper: createQueryWrapper(),
        });

        act(() => result.current.setSimpleQuery('가'));
        act(() => result.current.handleSimpleSearch());
        await waitFor(() => expect(result.current.results).toHaveLength(1));

        act(() => result.current.clearSearch());

        expect(result.current.committedRequest).toBeNull();
        expect(result.current.results).toEqual([]);
        expect(result.current.searchPerformed).toBe(false);
    });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/word-catalog/infrastructure/browser/browser-word-catalog-services',
    () => ({ createBrowserWordCatalogServices: jest.fn() }),
);

import { err, ok } from '../../../../shared/application/result';
import {
    useWordThemes,
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
    suggest: jest.fn().mockResolvedValue(ok([])),
    listThemes: jest.fn().mockResolvedValue(ok([
        { id: 1, code: '10', name: '일반' },
        { id: 2, code: 'EXT', name: '확장' },
    ])),
});

describe('useWordThemes', () => {
    test('does not query while the modal is closed', () => {
        const service = createService();

        renderHook(() => useWordThemes(false, service), {
            wrapper: createQueryWrapper(),
        });

        expect(service.listThemes).not.toHaveBeenCalled();
    });

    test('loads theme summaries while the modal is open', async () => {
        const service = createService();
        const { result } = renderHook(() => useWordThemes(true, service), {
            wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.data).toEqual([
            { id: 1, code: '10', name: '일반' },
            { id: 2, code: 'EXT', name: '확장' },
        ]));
    });

    test('exposes a returned application failure', async () => {
        const service = createService();
        service.listThemes.mockResolvedValue(err({
            kind: 'infrastructure',
            message: '데이터를 불러오는 중 오류가 발생했습니다.',
        }));
        const { result } = renderHook(() => useWordThemes(true, service), {
            wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.error).toEqual({
            kind: 'infrastructure',
            message: '데이터를 불러오는 중 오류가 발생했습니다.',
        }));
    });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/word-catalog/infrastructure/browser/browser-word-catalog-services',
    () => ({ createBrowserWordCatalogServices: jest.fn() }),
);

import { err, ok } from '../../../../shared/application/result';
import {
    useWordDownload,
    type WordDownloadData,
    type WordDownloadFilter,
} from '../../../../modules/word-catalog';
import { createBrowserWordCatalogServices } from '../../../../modules/word-catalog/infrastructure/browser/browser-word-catalog-services';

const filter: WordDownloadFilter = {
    includeAdded: true,
    includeDeleted: false,
    includeAcknowledged: true,
    includeNotAcknowledged: false,
    onlyWordChain: true,
};

const wordDownloadData: WordDownloadData = {
    words: ['가나다', '나라'],
    stats: {
        totalCount: 2,
        acknowledgedCount: 1,
        notAcknowledgedCount: 0,
        addedCount: 1,
        deletedCount: 0,
        wordChainCount: 1,
        wordNotChainCount: 0,
    },
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

const mockBrowserServices = (
    result: ReturnType<typeof ok<WordDownloadData>> | ReturnType<typeof err<WordDownloadData>>,
) => {
    const get = jest.fn().mockResolvedValue(result);
    jest.mocked(createBrowserWordCatalogServices).mockReturnValue({
        wordDownloadService: { get },
    } as unknown as ReturnType<typeof createBrowserWordCatalogServices>);
    return get;
};

describe('useWordDownload', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('stores a successful projection under a key containing every download filter flag', async () => {
        const get = mockBrowserServices(ok(wordDownloadData));
        const queryClient = createQueryClient();
        const { result } = renderHook(() => useWordDownload(filter), {
            wrapper: createQueryWrapper(queryClient),
        });

        await waitFor(() => expect(result.current.data).toEqual(wordDownloadData));

        expect(get).toHaveBeenCalledWith(filter);
        expect(queryClient.getQueryData([
            'word-catalog',
            'download',
            {
                includeAdded: true,
                includeDeleted: false,
                includeAcknowledged: true,
                includeNotAcknowledged: false,
                onlyWordChain: true,
            },
        ])).toEqual(wordDownloadData);
    });

    test('exposes an application failure as the typed query error without retrying validation', async () => {
        const validationError = {
            kind: 'validation' as const,
            message: '어인정 단어 허용, 노인정 단어 허용 중 최소 하나는 선택해야 합니다.',
        };
        const get = mockBrowserServices(err(validationError));
        const queryClient = createQueryClient();
        const { result } = renderHook(() => useWordDownload({
            ...filter,
            includeAcknowledged: false,
            includeNotAcknowledged: false,
        }), {
            wrapper: createQueryWrapper(queryClient),
        });

        await waitFor(() => expect(result.current.error).toEqual(validationError));
        expect(get).toHaveBeenCalledTimes(1);
    });
});

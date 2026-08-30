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
    useWordDetail,
    wordCatalogQueryKeys,
    type WordDetail,
    type WordDetailService,
} from '../../../../modules/word-catalog';

const wordDetail: WordDetail = {
    id: 1,
    word: '나비',
    status: 'registered',
    canUseInChain: true,
    canUseWithoutInjeong: true,
    themes: {
        approved: ['곤충'],
        pendingAddition: [],
        pendingDeletion: [],
    },
    documents: [{ id: 2, name: '동물' }],
    previousWordCount: 3,
    nextWordCount: 4,
};

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

const createService = (): jest.Mocked<WordDetailService> => ({
    get: jest.fn().mockResolvedValue(ok(wordDetail)),
    findRandomConnectedWord: jest.fn().mockResolvedValue(ok(null)),
});

describe('useWordDetail', () => {
    test('normalizes the service input and returns the word detail DTO', async () => {
        const service = createService();
        const { result } = renderHook(() => useWordDetail(' 나비 ', service), {
            wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.data).toEqual(wordDetail));
        expect(service.get).toHaveBeenCalledWith('나비');
    });

    test('propagates a not-found application failure without retrying', async () => {
        const service = createService();
        const notFoundError: ApplicationError = {
            kind: 'not-found',
            code: 'WORD_NOT_FOUND',
            message: '단어 정보를 찾을 수 없습니다.',
        };
        service.get.mockResolvedValue(err(notFoundError));
        const { result } = renderHook(() => useWordDetail('없는단어', service), {
            wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.error).toEqual(notFoundError));
        expect(service.get).toHaveBeenCalledTimes(1);
    });

    test('uses the shared retry policy for infrastructure failures', async () => {
        const service = createService();
        service.get.mockResolvedValue(err({
            kind: 'infrastructure',
            message: '데이터를 불러오는 중 오류가 발생했습니다.',
        }));
        const { result } = renderHook(() => useWordDetail('나비', service), {
            wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(service.get).toHaveBeenCalledTimes(4);
    });

    test('keeps details for distinct normalized words in separate cache entries', async () => {
        const service = createService();
        service.get.mockImplementation(async (word) => ok({
            ...wordDetail,
            id: word === '나비' ? 1 : 2,
            word,
        }));
        const { result, rerender } = renderHook(
            ({ word }: { word: string }) => useWordDetail(word, service),
            {
                wrapper: createQueryWrapper(),
                initialProps: { word: '나비' },
            },
        );

        await waitFor(() => expect(result.current.data?.word).toBe('나비'));
        rerender({ word: '호랑이' });
        await waitFor(() => expect(result.current.data?.word).toBe('호랑이'));

        expect(service.get).toHaveBeenCalledTimes(2);
        expect(wordCatalogQueryKeys.detail('나비')).toEqual([
            'word-catalog',
            'detail',
            '나비',
        ]);
    });
});

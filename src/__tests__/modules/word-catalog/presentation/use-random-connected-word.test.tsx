import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/word-catalog/infrastructure/browser/browser-word-catalog-services',
    () => ({ createBrowserWordCatalogServices: jest.fn() }),
);

import type { ApplicationError } from '../../../../shared/application/application-error';
import { ok } from '../../../../shared/application/result';
import {
    useRandomConnectedWord,
    type FindRandomConnectedWordInput,
    type WordDetailService,
} from '../../../../modules/word-catalog';

const input: FindRandomConnectedWordInput = {
    direction: 'next',
    letters: ['나'],
};

const createQueryWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    });

    return function QueryWrapper({ children }: PropsWithChildren) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
};

const createService = (): jest.Mocked<WordDetailService> => ({
    get: jest.fn(),
    findRandomConnectedWord: jest.fn().mockResolvedValue(ok('나비')),
});

describe('useRandomConnectedWord', () => {
    test('runs every identical user request instead of reading a cached result', async () => {
        const service = createService();
        const { result } = renderHook(() => useRandomConnectedWord(service), {
            wrapper: createQueryWrapper(),
        });

        await expect(result.current.mutateAsync(input)).resolves.toBe('나비');
        await expect(result.current.mutateAsync(input)).resolves.toBe('나비');

        expect(service.findRandomConnectedWord).toHaveBeenCalledTimes(2);
        expect(service.findRandomConnectedWord).toHaveBeenNthCalledWith(1, input);
        expect(service.findRandomConnectedWord).toHaveBeenNthCalledWith(2, input);
    });

    test('returns a successful null when no connected word exists', async () => {
        const service = createService();
        service.findRandomConnectedWord.mockResolvedValue(ok(null));
        const { result } = renderHook(() => useRandomConnectedWord(service), {
            wrapper: createQueryWrapper(),
        });

        await expect(result.current.mutateAsync(input)).resolves.toBeNull();
    });

    test('exposes a thrown application error unchanged', async () => {
        const service = createService();
        const applicationError: ApplicationError = {
            kind: 'validation',
            field: 'letters',
            message: '연결 글자가 필요합니다.',
        };
        service.findRandomConnectedWord.mockRejectedValue(applicationError);
        const { result } = renderHook(() => useRandomConnectedWord(service), {
            wrapper: createQueryWrapper(),
        });

        await expect(result.current.mutateAsync(input)).rejects.toEqual(applicationError);
        await waitFor(() => expect(result.current.error).toEqual(applicationError));
    });

    test('exposes isPending while the connection lookup is running', async () => {
        const service = createService();
        let resolveLookup: ((value: ReturnType<typeof ok<string | null>>) => void) | undefined;
        service.findRandomConnectedWord.mockImplementation(() => new Promise((resolve) => {
            resolveLookup = resolve;
        }));
        const { result } = renderHook(() => useRandomConnectedWord(service), {
            wrapper: createQueryWrapper(),
        });

        let mutation: Promise<string | null>;
        act(() => {
            mutation = result.current.mutateAsync(input);
        });
        await waitFor(() => expect(result.current.isPending).toBe(true));
        resolveLookup?.(ok('나비'));

        await expect(mutation!).resolves.toBe('나비');
        await waitFor(() => expect(result.current.isPending).toBe(false));
    });
});

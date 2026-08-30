import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/docs/infrastructure/browser/browser-docs-services',
    () => ({ createBrowserDocsServices: jest.fn() }),
);

import type { SetDocsFavoriteCommand } from '@/src/modules/docs/application/docs-favorite-command-ports';
import { createBrowserDocsServices } from '@/src/modules/docs/infrastructure/browser/browser-docs-services';
import { useDocsFavorite } from '@/src/modules/docs/presentation/use-docs-favorite';
import { err, ok, type Result } from '@/src/shared/application/result';

const command: SetDocsFavoriteCommand = { docsId: 55, isStarred: true };

const createDeferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });
    return { promise, resolve };
};

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    });
    return function Wrapper({ children }: PropsWithChildren) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
};

const mockService = (
    handler: (nextCommand: SetDocsFavoriteCommand) => Promise<Result<void>>,
) => {
    const set = jest.fn(handler);
    jest.mocked(createBrowserDocsServices).mockReturnValue({
        docsFavoriteCommandService: { set },
    } as unknown as ReturnType<typeof createBrowserDocsServices>);
    return set;
};

describe('useDocsFavorite', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns the service Result and exposes pending state while setting a favorite', async () => {
        // Break caught: losing the Result or failing to expose in-flight state needed to disable double submission.
        const deferred = createDeferred<Result<void>>();
        const set = mockService(async () => deferred.promise);
        const { result } = renderHook(() => useDocsFavorite(), { wrapper: createWrapper() });

        let pendingSet!: Promise<Result<void>>;
        act(() => {
            pendingSet = result.current.setFavorite(command);
        });

        await waitFor(() => expect(result.current.isPending).toBe(true));
        expect(set).toHaveBeenCalledWith(command);
        await act(async () => {
            deferred.resolve(ok(undefined));
            await expect(pendingSet).resolves.toEqual(ok(undefined));
        });
        await waitFor(() => expect(result.current.isPending).toBe(false));
    });

    it('converts a rejected service promise into a stable infrastructure Result', async () => {
        // Break caught: allowing an unexpected rejection or private detail to escape the hook.
        mockService(async () => {
            throw new Error('private failure');
        });
        const { result } = renderHook(() => useDocsFavorite(), { wrapper: createWrapper() });

        await expect(act(async () => result.current.setFavorite(command))).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '문서 즐겨찾기 설정에 실패했습니다. 잠시 후 다시 시도해주세요.',
        }));
    });
});

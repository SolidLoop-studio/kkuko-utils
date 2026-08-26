import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { Provider } from 'react-redux';

jest.mock('../../../modules/docs/infrastructure/browser/browser-docs-services', () => ({
    createBrowserDocsServices: jest.fn(),
}));

jest.mock('../../../modules/word-moderation/infrastructure/browser/browser-word-moderation-services', () => ({
    createBrowserWordModerationServices: jest.fn(),
}));

jest.mock('../../../app/lib/supabaseClient', () => ({
    SCM: {
        get: jest.fn(() => ({ docsLastUpdate: jest.fn() })),
        add: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
    },
}));

jest.mock('@tanstack/react-virtual', () => ({
    useVirtualizer: ({ count }: { count: number }) => ({
        getTotalSize: () => count * 120,
        getVirtualItems: () => Array.from({ length: count }, (_, index) => ({
            index,
            key: index,
            start: index * 120,
        })),
        measureElement: jest.fn(),
        scrollToIndex: jest.fn(),
        scrollToOffset: jest.fn(),
    }),
}));

jest.mock('../../../app/words-docs/[id]/WordsTableBody', () => {
    return function FakeWordsTableBody({ initialData, onAdminActionComplete }: {
        initialData: Array<{ word: string; status: 'add' | 'delete' | 'ok'; mutationTarget: unknown }>;
        onAdminActionComplete: (action: 'approve' | 'reject' | 'delete-directly', row: (typeof initialData)[number]) => Promise<boolean>;
    }) {
        return (
        <div>
            {initialData.map((row) => <p key={row.word} data-testid={`row-${row.word}`}>{row.word}</p>)}
            <button onClick={() => void onAdminActionComplete('reject', initialData[0])}>admin-refresh</button>
        </div>
        );
    };
});

import { createBrowserDocsServices } from '@/src/modules/docs/infrastructure/browser/browser-docs-services';
import { createBrowserWordModerationServices } from '@/src/modules/word-moderation/infrastructure/browser/browser-word-moderation-services';
import { ok } from '@/src/shared/application/result';
import { SCM } from '@/src/app/lib/supabaseClient';
import { loadingReducer, themeReducer, userReducer } from '@/src/app/store/slice';
import DocsDataPage from '@/src/app/words-docs/[id]/DocsDataPage';

const initialProjection = {
    metadata: { id: 55, title: '초기 문서', lastUpdatedAt: '2026-08-22T00:00:00.000Z', type: 'theme' as const },
    starredUserIds: [],
    words: [{ word: '가방', status: 'add' as const, requesterNickname: '요청자' }],
    isSpecial: false,
};

const refreshedProjection = {
    metadata: { id: 55, title: '갱신 문서', lastUpdatedAt: '2026-08-23T00:00:00.000Z', type: 'theme' as const },
    starredUserIds: ['starred-user'],
    words: [{ word: '하마', status: 'ok' as const }],
    isSpecial: false,
};

const backgroundProjection = {
    metadata: { id: 55, title: '백그라운드 갱신 문서', lastUpdatedAt: '2026-08-24T00:00:00.000Z', type: 'theme' as const },
    starredUserIds: ['background-star'],
    words: [{ word: '호랑이', status: 'ok' as const }],
    isSpecial: false,
};

const createWrapper = () => {
    const store = configureStore({
        reducer: { user: userReducer, loading: loadingReducer, theme: themeReducer },
        preloadedState: {
            user: { username: 'admin', uuid: 'admin-1', role: 'admin' as const },
            loading: { isLoading: false, progress: 100, currentTask: '완료' },
            theme: { theme: 'light' as const },
        },
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const Wrapper = ({ children }: PropsWithChildren) => {
        return <Provider store={store}><QueryClientProvider client={queryClient}>{children}</QueryClientProvider></Provider>;
    };
    return { queryClient, Wrapper };
};

describe('DocsDataPage real useDocsContent admin refetch integration', () => {
    it('replaces the rendered page snapshot with the latest real hook projection after an admin refresh', async () => {
        // Break caught: recording the view before enrichment, more than once, or through the removed SCM boundary.
        const get = jest.fn()
            .mockResolvedValueOnce(ok(initialProjection))
            .mockResolvedValueOnce(ok(refreshedProjection));
        const recordedDocsIds: number[] = [];
        jest.mocked(createBrowserDocsServices).mockReturnValue({
            docsContentQueryService: { get },
            docsViewCommandService: {
                record: async (docsId: number) => {
                    recordedDocsIds.push(docsId);
                    return ok(undefined);
                },
            },
        } as never);
        jest.mocked(createBrowserWordModerationServices).mockReturnValue({
            docsWordMutationTargetService: {
                get: jest.fn().mockImplementation(({ rows }: { rows: unknown[] }) => ok({
                    targets: rows.map(() => ({ kind: 'registered-word', wordId: 88 })),
                })),
            },
        } as never);
        const user = userEvent.setup();
        const { Wrapper } = createWrapper();
        render(<DocsDataPage id={55} />, { wrapper: Wrapper });

        expect(await screen.findByTestId('row-가방')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'admin-refresh' }));

        expect(await screen.findByTestId('row-하마')).toBeInTheDocument();
        expect(screen.getByText('갱신 문서')).toBeInTheDocument();
        await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
        expect(recordedDocsIds).toEqual([55]);
    });

    it('background query cache updates replace rendered rows as well as page metadata', async () => {
        // Break caught: losing the existing content snapshot update behavior while moving the independent view command.
        const get = jest.fn().mockResolvedValue(ok(initialProjection));
        const recordedDocsIds: number[] = [];
        jest.mocked(createBrowserDocsServices).mockReturnValue({
            docsContentQueryService: { get },
            docsViewCommandService: {
                record: async (docsId: number) => {
                    recordedDocsIds.push(docsId);
                    return ok(undefined);
                },
            },
        } as never);
        jest.mocked(createBrowserWordModerationServices).mockReturnValue({
            docsWordMutationTargetService: {
                get: jest.fn().mockImplementation(({ rows }: { rows: unknown[] }) => ok({
                    targets: rows.map(() => ({ kind: 'registered-word', wordId: 89 })),
                })),
            },
        } as never);
        const { queryClient, Wrapper } = createWrapper();

        render(<DocsDataPage id={55} />, { wrapper: Wrapper });
        expect(await screen.findByTestId('row-가방')).toBeInTheDocument();

        await act(async () => {
            queryClient.setQueryData(['docs', 55, 'content'], backgroundProjection);
        });

        expect(await screen.findByTestId('row-호랑이')).toBeInTheDocument();
        expect(screen.getByText('백그라운드 갱신 문서')).toBeInTheDocument();
        expect(screen.queryByTestId('row-가방')).not.toBeInTheDocument();
        expect(recordedDocsIds).toEqual([55]);
    });
});

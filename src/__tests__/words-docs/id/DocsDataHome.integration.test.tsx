import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { Provider } from 'react-redux';

jest.mock('../../../modules/word-moderation', () => ({
    useDocsWordModeration: jest.fn(),
}));

jest.mock('../../../app/words-docs/[id]/use-user-word-request-actions', () => ({
    useUserWordRequestActions: jest.fn(),
}));

jest.mock(
    '../../../modules/word-moderation/infrastructure/browser/browser-word-moderation-services',
    () => ({ createBrowserWordModerationServices: jest.fn() }),
);

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
        getTotalSize: () => count * 240,
        getVirtualItems: () => Array.from({ length: count }, (_, index) => ({
            index,
            key: index,
            start: index * 240,
        })),
        measureElement: jest.fn(),
        scrollToIndex: jest.fn(),
        scrollToOffset: jest.fn(),
    }),
}));

import { useDocsWordModeration } from '../../../modules/word-moderation';
import { createBrowserWordModerationServices } from '../../../modules/word-moderation/infrastructure/browser/browser-word-moderation-services';
import { ok } from '../../../shared/application/result';
import { SCM } from '../../../app/lib/supabaseClient';
import { loadingReducer, themeReducer, userReducer } from '../../../app/store/slice';
import DocsDataHome from '../../../app/words-docs/[id]/DocsDataHome';
import { useUserWordRequestActions } from '../../../app/words-docs/[id]/use-user-word-request-actions';
import type { DocsWordData } from '../../../app/words-docs/[id]/docs-word-data';

const mockUseDocsWordModeration = jest.mocked(useDocsWordModeration);
const mockUseUserWordRequestActions = jest.mocked(useUserWordRequestActions);
const mockCreateBrowserServices = jest.mocked(createBrowserWordModerationServices);
const approve = jest.fn();
const reject = jest.fn();
const deleteDirectly = jest.fn();
const docsWords = jest.fn();
const targetGet = jest.fn();

const createWrapper = (
    role: 'guest' | 'r1' | 'r4' | 'admin' = 'admin',
    uuid: string | undefined = 'admin-1',
) => {
    const store = configureStore({
        reducer: { user: userReducer, loading: loadingReducer, theme: themeReducer },
        preloadedState: {
            user: { username: uuid === undefined ? undefined : 'tester', uuid, role },
            loading: { isLoading: false, progress: 100, currentTask: '완료' },
            theme: { theme: 'light' as const },
        },
    });
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    return function Wrapper({ children }: PropsWithChildren) {
        return (
            <Provider store={store}>
                <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            </Provider>
        );
    };
};

const cases: Array<{
    name: string;
    row: DocsWordData;
    actionText: string;
}> = [
    {
        name: '추가 반려',
        row: {
            word: '가방',
            status: 'add',
            maker: 'requester-1',
            mutationTarget: {
                kind: 'word-request',
                requestId: 7,
                requestType: 'add',
                selectedThemeIds: [3],
            },
        },
        actionText: '추가 요청을 거절합니다.',
    },
    {
        name: '삭제 승인',
        row: {
            word: '나비',
            status: 'delete',
            maker: 'requester-2',
            mutationTarget: {
                kind: 'theme-change',
                wordId: 11,
                themeId: 13,
                type: 'delete',
            },
        },
        actionText: '삭제 요청을 수락합니다.',
    },
    {
        name: '직접 삭제',
        row: {
            word: '다람쥐',
            status: 'ok',
            maker: undefined,
            mutationTarget: { kind: 'registered-word', wordId: 17 },
        },
        actionText: '단어를 삭제합니다.',
    },
];

describe('DocsDataHome administrator removal completion integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        approve.mockResolvedValue(ok({
            processedWordRequestCount: 1,
            processedThemeChangeCount: 1,
            affectedDocsIds: [55],
        }));
        reject.mockResolvedValue(ok({
            processedWordRequestCount: 1,
            processedThemeChangeCount: 1,
            affectedDocsIds: [55],
        }));
        deleteDirectly.mockResolvedValue(ok({ deletedWordCount: 1 as const, affectedDocsIds: [55] }));
        mockUseDocsWordModeration.mockReturnValue({
            approve,
            reject,
            deleteDirectly,
            isPending: false,
            error: null,
            clearError: jest.fn(),
        });
        mockUseUserWordRequestActions.mockReturnValue({
            cancelAddRequest: jest.fn(),
            cancelDeleteRequest: jest.fn(),
            requestDelete: jest.fn(),
        });
        docsWords.mockResolvedValue({
            data: { words: [], waitWords: [] },
            error: null,
        });
        jest.mocked(SCM.get).mockReturnValue({
            docsLastUpdate: jest.fn(),
            docsWords,
        } as never);
        targetGet.mockResolvedValue(ok({ targets: [] }));
        mockCreateBrowserServices.mockReturnValue({
            docsWordMutationTargetService: { get: targetGet },
        } as never);
    });

    it.each(cases)('$name으로 마지막 행을 제거해도 완료 Modal이 유지된다', async ({ row, actionText }) => {
        const user = userEvent.setup();
        render(
            <DocsDataHome
                id={55}
                data={[row]}
                metaData={{
                    title: '테스트 문서',
                    lastUpdate: '2026-08-22T00:00:00.000Z',
                    typez: 'theme',
                }}
                starCount={[]}
            />,
            { wrapper: createWrapper() },
        );

        const wordCell = await screen.findByText(row.word);
        const tableRow = wordCell.closest('tr');
        if (tableRow === null) throw new Error(`row not found: ${row.word}`);
        await user.click(within(tableRow).getByRole('button', { name: '작업' }));
        const actionLabel = await screen.findByText(actionText);
        await user.click(within(actionLabel.parentElement as HTMLElement).getByRole('button'));

        expect(await screen.findByText('작업이 완료되었습니다!')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByText('단어를 찾을 수 없습니다')).toBeInTheDocument());
    });

    it('관리자 action 완료 뒤 content snapshot을 다시 받아 표시한다', async () => {
        const onContentRefresh = jest.fn().mockResolvedValue([{
            word: '갱신단어',
            status: 'ok' as const,
            maker: undefined,
            mutationTarget: { kind: 'registered-word' as const, wordId: 88 },
        }]);
        const user = userEvent.setup();
        render(
            <DocsDataHome
                id={55}
                data={[cases[0].row]}
                metaData={{ title: '테스트 문서', lastUpdate: '2026-08-22T00:00:00.000Z', typez: 'theme' }}
                starCount={[]}
                onContentRefresh={onContentRefresh}
            />,
            { wrapper: createWrapper() },
        );

        const wordCell = await screen.findByText('가방');
        const tableRow = wordCell.closest('tr');
        if (tableRow === null) throw new Error('row not found');
        await user.click(within(tableRow).getByRole('button', { name: '작업' }));
        const actionLabel = await screen.findByText('추가 요청을 거절합니다.');
        await user.click(within(actionLabel.parentElement as HTMLElement).getByRole('button'));

        await waitFor(() => expect(onContentRefresh).toHaveBeenCalledTimes(1));
        expect(await screen.findByText('갱신단어')).toBeInTheDocument();
    });

    const wholeDeleteRow: DocsWordData = {
        word: '나비',
        status: 'delete',
        maker: 'whole-requester',
        mutationTarget: {
            kind: 'word-request',
            requestId: 29,
            requestType: 'delete',
            selectedThemeIds: [],
        },
    };

    it.each([
        ['whole-requester', true],
        ['theme-requester', false],
    ] as const)(
        'shows the legacy whole-request cancellation only to %s before overlap resolution',
        async (uuid, shouldShowCancellation) => {
            const user = userEvent.setup();
            render(
                <DocsDataHome
                    id={55}
                    data={[wholeDeleteRow]}
                    metaData={{
                        title: '동물',
                        lastUpdate: '2026-08-22T00:00:00.000Z',
                        typez: 'theme',
                    }}
                    starCount={[]}
                />,
                { wrapper: createWrapper('r1', uuid) },
            );

            const wordCell = await screen.findByText('나비');
            const tableRow = wordCell.closest('tr');
            if (tableRow === null) throw new Error('row not found: 나비');
            await user.click(within(tableRow).getByRole('button', { name: '작업' }));

            const cancellation = screen.queryByText('삭제 요청을 취소합니다.');
            if (shouldShowCancellation) {
                expect(cancellation).toBeInTheDocument();
            } else {
                expect(cancellation).not.toBeInTheDocument();
            }
        },
    );

});

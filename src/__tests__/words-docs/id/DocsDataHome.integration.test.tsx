import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { Provider } from 'react-redux';

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../../../modules/word-moderation', () => ({
    useDocsWordModeration: jest.fn(),
}));

jest.mock('../../../modules/docs', () => ({
    useDocsFavorite: jest.fn(),
}));

jest.mock('../../../app/components/ErrModal', () => ({
    __esModule: true,
    default: ({ error }: { error: ErrorMessage }) => (
        <div role="alert" data-stack={error.ErrStackRace ?? ''}>
            {error.ErrMessage}
        </div>
    ),
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
import { useDocsFavorite } from '../../../modules/docs';
import { createBrowserWordModerationServices } from '../../../modules/word-moderation/infrastructure/browser/browser-word-moderation-services';
import { ok } from '../../../shared/application/result';
import { SCM } from '../../../app/lib/supabaseClient';
import { loadingReducer, themeReducer, userReducer } from '../../../app/store/slice';
import DocsDataHome from '../../../app/words-docs/[id]/DocsDataHome';
import { useUserWordRequestActions } from '../../../app/words-docs/[id]/use-user-word-request-actions';
import type { DocsWordData } from '../../../app/words-docs/[id]/docs-word-data';

const mockUseDocsWordModeration = jest.mocked(useDocsWordModeration);
const mockUseDocsFavorite = jest.mocked(useDocsFavorite);
const mockUseUserWordRequestActions = jest.mocked(useUserWordRequestActions);
const mockCreateBrowserServices = jest.mocked(createBrowserWordModerationServices);
const approve = jest.fn();
const reject = jest.fn();
const deleteDirectly = jest.fn();
const docsLastUpdate = jest.fn();
const targetGet = jest.fn();
const setFavorite = jest.fn();

const createDeferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });
    return { promise, resolve };
};

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
        setFavorite.mockResolvedValue(ok(undefined));
        mockUseDocsFavorite.mockReturnValue({
            setFavorite,
            isPending: false,
        });
        mockUseUserWordRequestActions.mockReturnValue({
            cancelAddRequest: jest.fn(),
            cancelDeleteRequest: jest.fn(),
            requestDelete: jest.fn(),
        });
        jest.mocked(SCM.get).mockReturnValue({
            docsLastUpdate,
        } as never);
        targetGet.mockResolvedValue(ok({ targets: [] }));
        mockCreateBrowserServices.mockReturnValue({
            docsWordMutationTargetService: { get: targetGet },
        } as never);
    });

    it('opens the existing login-required Modal without submitting for a guest', async () => {
        // Break caught: calling the authenticated favorite command for a guest or removing the existing login prompt.
        const user = userEvent.setup();
        render(
            <DocsDataHome
                id={55}
                data={[]}
                metaData={{ title: '테스트 문서', lastUpdate: '2026-08-22T00:00:00.000Z', typez: 'theme' }}
                starCount={[]}
            />,
            { wrapper: createWrapper('guest', '') },
        );

        await user.click(screen.getByRole('button', { name: '0' }));

        expect(await screen.findByText('로그인이 필요합니다')).toBeInTheDocument();
        expect(setFavorite).not.toHaveBeenCalled();
    });

    it('changes the favorite count only after a successful desired-state Result', async () => {
        // Break caught: optimistically flipping before the command commits or sending a user UUID to the boundary.
        const deferred = createDeferred<ReturnType<typeof ok<void>>>();
        setFavorite.mockReturnValue(deferred.promise);
        const user = userEvent.setup();
        render(
            <DocsDataHome
                id={55}
                data={[]}
                metaData={{ title: '테스트 문서', lastUpdate: '2026-08-22T00:00:00.000Z', typez: 'theme' }}
                starCount={[]}
            />,
            { wrapper: createWrapper('r1', 'user-1') },
        );

        await user.click(screen.getByRole('button', { name: '0' }));

        expect(setFavorite).toHaveBeenCalledWith({ docsId: 55, isStarred: true });
        expect(screen.getByRole('button', { name: '0' })).toBeInTheDocument();
        deferred.resolve(ok(undefined));
        await waitFor(() => expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument());
    });

    it('keeps the favorite state and shows the existing ErrorModal when the command fails', async () => {
        // Break caught: flipping favorite UI on failure or leaking raw database errors outside the existing Modal.
        setFavorite.mockResolvedValue({
            ok: false,
            error: {
                kind: 'not-found',
                message: '문서를 찾을 수 없습니다.',
                code: 'P0001',
            },
        });
        const user = userEvent.setup();
        render(
            <DocsDataHome
                id={55}
                data={[]}
                metaData={{ title: '테스트 문서', lastUpdate: '2026-08-22T00:00:00.000Z', typez: 'theme' }}
                starCount={[]}
            />,
            { wrapper: createWrapper('r1', 'user-1') },
        );

        await user.click(screen.getByRole('button', { name: '0' }));

        const errorModal = await screen.findByRole('alert');
        expect(errorModal).toHaveTextContent('문서를 찾을 수 없습니다.');
        expect(screen.getByRole('button', { name: '0' })).toBeInTheDocument();
        expect(errorModal).toHaveAttribute('data-stack', '');
    });

    it('uses the login-required Modal for a stale authenticated session failure', async () => {
        // Break caught: showing an unauthenticated RPC result as an opaque database error.
        setFavorite.mockResolvedValue({
            ok: false,
            error: { kind: 'unauthorized', message: '인증이 필요합니다.' },
        });
        const user = userEvent.setup();
        render(
            <DocsDataHome
                id={55}
                data={[]}
                metaData={{ title: '테스트 문서', lastUpdate: '2026-08-22T00:00:00.000Z', typez: 'theme' }}
                starCount={[]}
            />,
            { wrapper: createWrapper('r1', 'user-1') },
        );

        await user.click(screen.getByRole('button', { name: '0' }));

        expect(await screen.findByText('로그인이 필요합니다')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: '닫기' }));
        expect(screen.getByRole('button', { name: '0' })).toBeInTheDocument();
    });

    it('prevents a concurrent double submission and disables the button while pending', async () => {
        // Break caught: dispatching the same desired-state mutation twice before the first result settles.
        const deferred = createDeferred<ReturnType<typeof ok<void>>>();
        setFavorite.mockReturnValue(deferred.promise);
        const { rerender } = render(
            <DocsDataHome
                id={55}
                data={[]}
                metaData={{ title: '테스트 문서', lastUpdate: '2026-08-22T00:00:00.000Z', typez: 'theme' }}
                starCount={[]}
            />,
            { wrapper: createWrapper('r1', 'user-1') },
        );

        const favoriteButton = screen.getByRole('button', { name: '0' });
        fireEvent.click(favoriteButton);
        fireEvent.click(favoriteButton);
        expect(setFavorite).toHaveBeenCalledTimes(1);

        mockUseDocsFavorite.mockReturnValue({ setFavorite, isPending: true });
        rerender(
            <DocsDataHome
                id={55}
                data={[]}
                metaData={{ title: '테스트 문서', lastUpdate: '2026-08-22T00:00:00.000Z', typez: 'theme' }}
                starCount={[]}
            />,
        );
        expect(screen.getByRole('button', { name: '0' })).toBeDisabled();

        deferred.resolve(ok(undefined));
        await waitFor(() => expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument());
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

    it('미션글자 marker는 하위 문서의 현지화된 갱신 시각과 없는 경우 안내를 표시한다', async () => {
        const localizedTime = jest.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('현지화된 시각');
        docsLastUpdate.mockImplementation(async (docsId: number) => ({
            data: docsId === 209 ? { last_update: '2026-08-25T04:00:00.000Z' } : null,
            error: null,
        }));

        render(
            <DocsDataHome
                id={208}
                data={[]}
                metaData={{ title: '미션글자', lastUpdate: '2026-08-22T00:00:00.000Z', typez: 'ect' }}
                starCount={[]}
            />,
            { wrapper: createWrapper('guest', undefined) },
        );

        expect(await screen.findByText('현지화된 시각')).toBeInTheDocument();
        expect(screen.getAllByText('업데이트 정보 없음')).toHaveLength(13);
        expect(docsLastUpdate).toHaveBeenCalledTimes(14);
        expect(docsLastUpdate).toHaveBeenNthCalledWith(1, 209);
        expect(docsLastUpdate).toHaveBeenNthCalledWith(14, 222);
        localizedTime.mockRestore();
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

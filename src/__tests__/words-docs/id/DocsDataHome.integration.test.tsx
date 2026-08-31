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
    useDocsMarkers: jest.fn(),
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
import { useDocsFavorite, useDocsMarkers } from '../../../modules/docs';
import { createBrowserWordModerationServices } from '../../../modules/word-moderation/infrastructure/browser/browser-word-moderation-services';
import { ok, type Result } from '../../../shared/application/result';
import { loadingReducer, themeReducer, userReducer } from '../../../app/store/slice';
import DocsDataHome from '../../../app/words-docs/[id]/DocsDataHome';
import { useUserWordRequestActions } from '../../../app/words-docs/[id]/use-user-word-request-actions';
import type { DocsWordData } from '../../../app/words-docs/[id]/docs-word-data';

const mockUseDocsWordModeration = jest.mocked(useDocsWordModeration);
const mockUseDocsFavorite = jest.mocked(useDocsFavorite);
const mockUseDocsMarkers = jest.mocked(useDocsMarkers);
const remappedMissionParentId = 7_301;
const mockUseUserWordRequestActions = jest.mocked(useUserWordRequestActions);
const mockCreateBrowserServices = jest.mocked(createBrowserWordModerationServices);
const approve = jest.fn();
const reject = jest.fn();
const deleteDirectly = jest.fn();
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
    queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    }),
) => {
    const store = configureStore({
        reducer: { user: userReducer, loading: loadingReducer, theme: themeReducer },
        preloadedState: {
            user: { username: uuid === undefined ? undefined : 'tester', uuid, role },
            loading: { isLoading: false, progress: 100, currentTask: '완료' },
            theme: { theme: 'light' as const },
        },
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
        mockUseDocsMarkers.mockReturnValue({
            data: undefined,
            error: null,
            isLoading: false,
        } as ReturnType<typeof useDocsMarkers>);
        mockUseUserWordRequestActions.mockReturnValue({
            cancelAddRequest: jest.fn(),
            cancelDeleteRequest: jest.fn(),
            requestDelete: jest.fn(),
        });
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

    it('optimistically changes the favorite state while the command is pending', async () => {
        // Break caught: making users wait for the favorite command before showing their requested state.
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
        expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
        deferred.resolve(ok(undefined));
        await waitFor(() => expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument());
    });

    it('refetches the current profile favorites after a successful favorite command', async () => {
        // Break caught: returning to a recently viewed profile with a fresh but outdated favorites cache.
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false, staleTime: 60 * 1000 },
                mutations: { retry: false },
            },
        });
        const profileFavoritesKey = ['identity', 'profile-favorite-docs', 'user-1'] as const;
        queryClient.setQueryData(profileFavoritesKey, []);
        const user = userEvent.setup();
        render(
            <DocsDataHome
                id={55}
                data={[]}
                metaData={{ title: '테스트 문서', lastUpdate: '2026-08-22T00:00:00.000Z', typez: 'theme' }}
                starCount={[]}
            />,
            { wrapper: createWrapper('r1', 'user-1', queryClient) },
        );

        await user.click(screen.getByRole('button', { name: '0' }));
        await waitFor(() => expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument());

        const loadProfileFavorites = jest.fn().mockResolvedValue([{ id: 55 }]);
        await expect(queryClient.fetchQuery({
            queryKey: profileFavoritesKey,
            queryFn: loadProfileFavorites,
        })).resolves.toEqual([{ id: 55 }]);
        expect(loadProfileFavorites).toHaveBeenCalledTimes(1);
    });

    it('rolls back the optimistic favorite state and shows the existing ErrorModal when the command fails', async () => {
        // Break caught: leaving an uncommitted favorite visible after the command fails.
        const deferred = createDeferred<Result<void>>();
        setFavorite.mockReturnValue(deferred.promise);
        const failure: Result<void> = {
            ok: false,
            error: {
                kind: 'not-found',
                message: '문서를 찾을 수 없습니다.',
                code: 'P0001',
            },
        };
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
        expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
        deferred.resolve(failure);

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
        expect(screen.getByRole('button', { name: '1' })).toBeDisabled();

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
        mockUseDocsMarkers.mockReturnValue({
            data: [
                { character: '가', docsId: 9_001, lastUpdatedAt: '2026-08-25T04:00:00.000Z' },
                ...Array.from({ length: 13 }, () => null),
            ],
            error: null,
            isLoading: false,
        } as ReturnType<typeof useDocsMarkers>);

        render(
            <DocsDataHome
                id={remappedMissionParentId}
                isMissionParent
                data={[]}
                metaData={{ title: '미션글자', lastUpdate: '2026-08-22T00:00:00.000Z', typez: 'ect' }}
                starCount={[]}
            />,
            { wrapper: createWrapper('guest', undefined) },
        );

        expect(await screen.findByText('현지화된 시각')).toBeInTheDocument();
        expect(screen.getAllByText('업데이트 정보 없음')).toHaveLength(13);
        expect(screen.getByRole('link', { name: /가 현지화된 시각/ }))
            .toHaveAttribute('href', '/words-docs/9001');
        expect(mockUseDocsMarkers).toHaveBeenCalledWith(remappedMissionParentId, true);
        localizedTime.mockRestore();
    });

    it('does not activate marker presentation from a legacy parent id alone', () => {
        render(
            <DocsDataHome
                id={208}
                isMissionParent={false}
                data={[]}
                metaData={{ title: 'ordinary document', lastUpdate: '2026-08-22T00:00:00.000Z', typez: 'ect' }}
                starCount={[]}
            />,
            { wrapper: createWrapper('guest', undefined) },
        );

        expect(screen.queryByRole('heading', { name: '미션글자', level: 2 })).not.toBeInTheDocument();
        expect(mockUseDocsMarkers).toHaveBeenCalledWith(208, false);
    });

    it('미션 marker 조회 실패가 메인 문서 페이지를 깨뜨리지 않는다', () => {
        // Break caught: promoting an auxiliary marker query failure to a page-level error.
        mockUseDocsMarkers.mockReturnValue({
            data: undefined,
            error: {
                kind: 'infrastructure',
                message: '미션 글자 업데이트 정보를 불러오는 중 오류가 발생했습니다.',
            },
            isLoading: false,
        } as ReturnType<typeof useDocsMarkers>);

        render(
            <DocsDataHome
                id={remappedMissionParentId}
                isMissionParent
                data={[]}
                metaData={{ title: '미션글자', lastUpdate: '2026-08-22T00:00:00.000Z', typez: 'ect' }}
                starCount={[]}
            />,
            { wrapper: createWrapper('guest', undefined) },
        );

        expect(screen.getByRole('heading', { name: '미션글자', level: 1 })).toBeInTheDocument();
        expect(screen.getAllByText('업데이트 정보 없음')).toHaveLength(14);
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

    it('사용자 삭제 요청 완료 뒤 content snapshot을 다시 받아 삭제 요청 상태를 표시한다', async () => {
        const refreshedRow: DocsWordData = {
            word: '다람쥐',
            status: 'delete',
            maker: 'user-1',
            mutationTarget: {
                kind: 'word-request',
                requestId: 31,
                requestType: 'delete',
                selectedThemeIds: [],
            },
        };
        const onContentRefresh = jest.fn().mockResolvedValue([refreshedRow]);
        mockUseUserWordRequestActions.mockImplementation((options) => ({
            cancelAddRequest: jest.fn(),
            cancelDeleteRequest: jest.fn(),
            requestDelete: async () => {
                await options.completeWork();
            },
        }));
        const user = userEvent.setup();
        render(
            <DocsDataHome
                id={55}
                data={[cases[2].row]}
                metaData={{ title: '테스트 문서', lastUpdate: '2026-08-22T00:00:00.000Z', typez: 'letter' }}
                starCount={[]}
                onContentRefresh={onContentRefresh}
            />,
            { wrapper: createWrapper('r1', 'user-1') },
        );

        const wordCell = await screen.findByText('다람쥐');
        const tableRow = wordCell.closest('tr');
        if (tableRow === null) throw new Error('row not found');
        await user.click(within(tableRow).getByRole('button', { name: '작업' }));
        await user.click(await screen.findByRole('button', { name: '삭제 요청을 보냅니다.' }));

        await waitFor(() => expect(onContentRefresh).toHaveBeenCalledTimes(1));
        expect(await screen.findByText('delete')).toBeInTheDocument();
        const refreshedWordCell = screen.getByText('다람쥐');
        const refreshedTableRow = refreshedWordCell.closest('tr');
        if (refreshedTableRow === null) throw new Error('refreshed row not found');
        await user.click(within(refreshedTableRow).getByRole('button', { name: '작업' }));
        expect(screen.getByText('삭제 요청을 취소합니다.')).toBeInTheDocument();
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

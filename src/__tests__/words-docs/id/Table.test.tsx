import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type PropsWithChildren } from 'react';
import { Provider } from 'react-redux';

jest.mock('../../../modules/word-moderation', () => ({
    useDocsWordModeration: jest.fn(),
}));

jest.mock('../../../modules/docs', () => ({
    useDocsContent: jest.fn(),
    useRecordDocsView: jest.fn(),
    useDocsFavorite: jest.fn(() => ({
        setFavorite: jest.fn().mockResolvedValue({ ok: true, value: undefined }),
        isPending: false,
    })),
    useDocsMarkers: jest.fn(() => ({
        data: undefined,
        error: null,
        isLoading: false,
    })),
}));

jest.mock('next/navigation', () => ({
    useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
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
    const React = jest.requireActual<typeof import('react')>('react');

    return function FakeWordsTableBody({
        initialData,
        onAdminActionComplete,
    }: {
        initialData: Array<{
            word: string;
            status: 'add' | 'delete' | 'ok';
            maker?: string | null;
            mutationTarget: { kind: string; wordId?: number } | null;
        }>;
        onAdminActionComplete: (
            action: 'approve' | 'reject' | 'delete-directly',
            row: (typeof initialData)[number],
        ) => Promise<boolean>;
    }) {
        return React.createElement(
            'div',
            {},
            ...initialData.map((row) => React.createElement(
                'div',
                { key: row.word, 'data-testid': `docs-row-${row.word}` },
                `${row.word}|${row.status}|${row.maker ?? 'none'}|${
                    row.mutationTarget === null
                        ? 'null'
                        : `${row.mutationTarget.kind}:${row.mutationTarget.wordId ?? ''}`
                }`,
                React.createElement('button', {
                    'aria-label': `approve-${row.word}`,
                    onClick: () => void onAdminActionComplete('approve', row),
                }),
                React.createElement('button', {
                    'aria-label': `reject-${row.word}`,
                    onClick: () => void onAdminActionComplete('reject', row),
                }),
                React.createElement('button', {
                    'aria-label': `delete-directly-${row.word}`,
                    onClick: () => void onAdminActionComplete('delete-directly', row),
                }),
            )),
        );
    };
});

import { createBrowserWordModerationServices } from '../../../modules/word-moderation/infrastructure/browser/browser-word-moderation-services';
import { useDocsWordModeration } from '../../../modules/word-moderation';
import { useDocsContent, useRecordDocsView } from '../../../modules/docs';
import type { DocsWordMutationTarget } from '../../../modules/word-moderation/domain/docs-word-moderation';
import { err, ok } from '../../../shared/application/result';
import { loadingReducer, themeReducer, userReducer } from '../../../app/store/slice';
import DocsDataHome from '../../../app/words-docs/[id]/DocsDataHome';
import DocsDataPage from '../../../app/words-docs/[id]/DocsDataPage';
import Table from '../../../app/words-docs/[id]/Table';
import { useUserWordRequestActions } from '../../../app/words-docs/[id]/use-user-word-request-actions';

type DocsWordData = {
    word: string;
    status: 'add' | 'delete' | 'ok';
    maker?: string | null;
    mutationTarget: DocsWordMutationTarget | null;
};

const rows: DocsWordData[] = [
    {
        word: '가방',
        status: 'add',
        maker: 'requester-1',
        mutationTarget: {
            kind: 'word-request',
            requestId: 7,
            requestType: 'add',
            selectedThemeIds: [3, 9],
        },
    },
    {
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
    {
        word: '다람쥐',
        status: 'ok',
        maker: undefined,
        mutationTarget: { kind: 'registered-word', wordId: 17 },
    },
];

const requestSuccess = ok({
    processedWordRequestCount: 1,
    processedThemeChangeCount: 0,
    affectedDocsIds: [55],
});
const deleteSuccess = ok({ deletedWordCount: 1 as const, affectedDocsIds: [55] });

const mockUseDocsWordModeration = jest.mocked(useDocsWordModeration);
const mockUseUserWordRequestActions = jest.mocked(useUserWordRequestActions);
const mockCreateBrowserServices = jest.mocked(createBrowserWordModerationServices);
const mockApprove = jest.fn();
const mockReject = jest.fn();
const mockDeleteDirectly = jest.fn();
const mockClearError = jest.fn();
const mockCancelAddRequest = jest.fn();
const mockCancelDeleteRequest = jest.fn();
const mockRequestDelete = jest.fn();
const mockTargetGet = jest.fn();
const mockUseDocsContent = jest.mocked(useDocsContent);
const mockUseRecordDocsView = jest.mocked(useRecordDocsView);
const mockRecordDocsView = jest.fn();

const contentProjection = (overrides: Partial<{
    id: number;
    title: string;
    words: Array<{ word: string; status: 'add' | 'delete' | 'ok'; requesterNickname?: string }>;
}> = {}) => ({
    metadata: {
        id: overrides.id ?? 55,
        title: overrides.title ?? '테스트 주제',
        lastUpdatedAt: '2026-08-22T00:00:00.000Z',
        type: 'theme' as const,
    },
    starredUserIds: [],
    words: overrides.words ?? [{ word: '나비', status: 'ok' as const }],
    missionCharacter: null,
    isSpecial: false,
    isMissionParent: false,
});

const createDeferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((promiseResolve) => {
        resolve = promiseResolve;
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
            user: { username: uuid ? 'tester' : undefined, uuid, role },
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

const renderTable = ({
    role = 'admin',
    uuid = 'admin-1',
    data = rows,
    onAdminActionComplete = jest.fn().mockResolvedValue(true),
    onUserActionComplete = jest.fn().mockResolvedValue(true),
}: {
    role?: 'guest' | 'r1' | 'r4' | 'admin';
    uuid?: string;
    data?: DocsWordData[];
    onAdminActionComplete?: jest.Mock;
    onUserActionComplete?: jest.Mock;
    } = {}) => {
    render(
        <Table
            initialData={data}
            onAdminActionComplete={onAdminActionComplete}
            onUserActionComplete={onUserActionComplete}
        />,
        { wrapper: createWrapper(role, uuid) },
    );

    return { onAdminActionComplete, onUserActionComplete };
};

const openRow = async (word: string) => {
    const user = userEvent.setup();
    const row = screen.getByText(word).closest('tr');
    if (row === null) throw new Error(`row not found: ${word}`);
    await user.click(within(row).getByRole('button', { name: '작업' }));
    return user;
};

const clickAction = async (text: string) => {
    const user = userEvent.setup();
    const label = await screen.findByText(text);
    const block = label.parentElement;
    if (block === null) throw new Error(`action block not found: ${text}`);
    await user.click(within(block).getByRole('button'));
};

describe('Table administrator and legacy user actions', () => {
    beforeEach(() => {
        mockApprove.mockResolvedValue(requestSuccess);
        mockReject.mockResolvedValue(requestSuccess);
        mockDeleteDirectly.mockResolvedValue(deleteSuccess);
        mockUseDocsWordModeration.mockReturnValue({
            approve: mockApprove,
            reject: mockReject,
            deleteDirectly: mockDeleteDirectly,
            isPending: false,
            error: null,
            clearError: mockClearError,
        });
        mockUseUserWordRequestActions.mockReturnValue({
            cancelAddRequest: mockCancelAddRequest,
            cancelDeleteRequest: mockCancelDeleteRequest,
            requestDelete: mockRequestDelete,
        });
    });

    it('admin은 추가 승인 target을 parent에 전달하고 local 완료 모달을 소유하지 않는다', async () => {
        const { onAdminActionComplete } = renderTable();
        await openRow('가방');

        await clickAction('추가 요청을 수락합니다.');

        expect(mockApprove).toHaveBeenCalledWith(rows[0].mutationTarget);
        expect(onAdminActionComplete).toHaveBeenCalledWith('approve', rows[0]);
        expect(screen.queryByText('작업이 완료되었습니다!')).not.toBeInTheDocument();
    });

    it('사용자 삭제 요청 성공 뒤 현재 문서 갱신을 완료한다', async () => {
        mockUseUserWordRequestActions.mockImplementation((options) => ({
            cancelAddRequest: mockCancelAddRequest,
            cancelDeleteRequest: mockCancelDeleteRequest,
            requestDelete: async () => {
                await options.completeWork();
            },
        }));
        const onUserActionComplete = jest.fn().mockResolvedValue(true);
        renderTable({ role: 'r1', uuid: 'requester-1', data: [rows[2]], onUserActionComplete });
        await openRow('다람쥐');

        await clickAction('삭제 요청을 보냅니다.');

        await waitFor(() => expect(onUserActionComplete).toHaveBeenCalledTimes(1));
    });

    it('사용자 삭제 요청 취소 성공 뒤 현재 문서 갱신을 완료한다', async () => {
        mockUseUserWordRequestActions.mockImplementation((options) => ({
            cancelAddRequest: mockCancelAddRequest,
            cancelDeleteRequest: async () => {
                await options.completeWork();
            },
            requestDelete: mockRequestDelete,
        }));
        const onUserActionComplete = jest.fn().mockResolvedValue(true);
        renderTable({
            role: 'r1',
            uuid: 'requester-4',
            data: [{
                word: '마차',
                status: 'delete',
                maker: 'requester-4',
                mutationTarget: {
                    kind: 'word-request',
                    requestId: 29,
                    requestType: 'delete',
                    selectedThemeIds: [],
                },
            }],
            onUserActionComplete,
        });
        await openRow('마차');

        await clickAction('삭제 요청을 취소합니다.');

        await waitFor(() => expect(onUserActionComplete).toHaveBeenCalledTimes(1));
    });

    it('주제 삭제 변경 반려를 theme-change target으로 실행한다', async () => {
        const { onAdminActionComplete } = renderTable();
        await openRow('나비');

        await clickAction('삭제 요청을 거절합니다.');

        expect(mockReject).toHaveBeenCalledWith({
            kind: 'theme-change',
            wordId: 11,
            themeId: 13,
            type: 'delete',
        });
        expect(onAdminActionComplete).toHaveBeenCalledWith('reject', rows[1]);
    });

    it.each<{
        name: string;
        row: DocsWordData;
        actionText: string;
        action: 'approve' | 'reject';
    }>([
        {
            name: '전체 추가 반려',
            row: rows[0],
            actionText: '추가 요청을 거절합니다.',
            action: 'reject',
        },
        {
            name: '주제 추가 승인',
            row: {
                word: '라디오',
                status: 'add',
                maker: 'requester-3',
                mutationTarget: { kind: 'theme-change', wordId: 19, themeId: 23, type: 'add' },
            },
            actionText: '추가 요청을 수락합니다.',
            action: 'approve',
        },
        {
            name: '주제 추가 반려',
            row: {
                word: '라디오',
                status: 'add',
                maker: 'requester-3',
                mutationTarget: { kind: 'theme-change', wordId: 19, themeId: 23, type: 'add' },
            },
            actionText: '추가 요청을 거절합니다.',
            action: 'reject',
        },
        {
            name: '전체 삭제 승인',
            row: {
                word: '마차',
                status: 'delete',
                maker: 'requester-4',
                mutationTarget: {
                    kind: 'word-request',
                    requestId: 29,
                    requestType: 'delete',
                    selectedThemeIds: [],
                },
            },
            actionText: '삭제 요청을 수락합니다.',
            action: 'approve',
        },
        {
            name: '전체 삭제 반려',
            row: {
                word: '마차',
                status: 'delete',
                maker: 'requester-4',
                mutationTarget: {
                    kind: 'word-request',
                    requestId: 29,
                    requestType: 'delete',
                    selectedThemeIds: [],
                },
            },
            actionText: '삭제 요청을 거절합니다.',
            action: 'reject',
        },
        {
            name: '주제 삭제 승인',
            row: rows[1],
            actionText: '삭제 요청을 수락합니다.',
            action: 'approve',
        },
    ])('$name은 정확한 target과 action을 사용한다', async ({ row, actionText, action }) => {
        const { onAdminActionComplete } = renderTable({ data: [row] });
        await openRow(row.word);

        await clickAction(actionText);

        const actionMock = action === 'approve' ? mockApprove : mockReject;
        expect(actionMock).toHaveBeenCalledWith(row.mutationTarget);
        expect(onAdminActionComplete).toHaveBeenCalledWith(action, row);
    });

    it('등록 단어 관리자 삭제를 registered-word target으로 실행한다', async () => {
        const { onAdminActionComplete } = renderTable();
        await openRow('다람쥐');

        await clickAction('단어를 삭제합니다.');

        expect(mockDeleteDirectly).toHaveBeenCalledWith({ kind: 'registered-word', wordId: 17 });
        expect(onAdminActionComplete).toHaveBeenCalledWith('delete-directly', rows[2]);
    });

    it.each([
        ['r4' as const, 'requester-1'],
        ['r1' as const, 'requester-1'],
    ])('%s requester에게 관리자 action은 숨기고 자신의 취소 action은 유지한다', async (role, uuid) => {
        renderTable({ role, uuid });
        await openRow('가방');

        expect(screen.queryByText('추가 요청을 수락합니다.')).not.toBeInTheDocument();
        expect(screen.queryByText('추가 요청을 거절합니다.')).not.toBeInTheDocument();
        expect(screen.getByText('추가 요청을 취소합니다.')).toBeInTheDocument();
    });

    it('theme-change requester에게 wait_words 취소 action을 표시하지 않는다', async () => {
        renderTable({ role: 'r1', uuid: 'requester-2', data: [rows[1]] });
        await openRow('나비');
        await screen.findByText('현재 이 단어는 삭제 요청 상태입니다.');

        expect(screen.queryByText('삭제 요청을 취소합니다.')).not.toBeInTheDocument();
        expect(screen.queryByText('삭제 요청을 수락합니다.')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: '닫기' })).toBeEnabled();
        expect(mockCancelDeleteRequest).not.toHaveBeenCalled();
    });

    it('null target은 관리자 action을 표시하되 실행할 수 없게 한다', async () => {
        renderTable({ data: [{ ...rows[0], mutationTarget: null }] });
        await openRow('가방');

        const label = screen.getByText('추가 요청을 수락합니다.');
        expect(within(label.parentElement as HTMLElement).getByRole('button')).toBeDisabled();
    });

    it('pending 동안 관리자, requester, 닫기 action을 막고 Dialog close도 무시한다', async () => {
        mockUseDocsWordModeration.mockReturnValue({
            approve: mockApprove,
            reject: mockReject,
            deleteDirectly: mockDeleteDirectly,
            isPending: true,
            error: null,
            clearError: mockClearError,
        });
        renderTable({ role: 'admin', uuid: 'requester-1' });
        const user = await openRow('가방');

        for (const text of [
            '추가 요청을 수락합니다.',
            '추가 요청을 거절합니다.',
            '추가 요청을 취소합니다.',
        ]) {
            const label = screen.getByText(text);
            expect(within(label.parentElement as HTMLElement).getByRole('button')).toBeDisabled();
        }
        expect(screen.getByRole('button', { name: '닫기' })).toBeDisabled();

        await user.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.getByText('현재 이 단어는 추가 요청 상태입니다.')).toBeInTheDocument();
    });

    it.each([
        {
            error: { kind: 'validation' as const, message: '주제를 다시 확인해 주세요.' },
            publicMessage: '주제를 다시 확인해 주세요.',
        },
        {
            error: { kind: 'conflict' as const, message: 'private request version' },
            publicMessage: '요청 목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요.',
            privateMessage: 'private request version',
        },
        {
            error: { kind: 'unauthorized' as const, message: 'private session detail' },
            publicMessage: '로그인이 필요합니다.',
            privateMessage: 'private session detail',
        },
        {
            error: { kind: 'forbidden' as const, message: 'private role detail' },
            publicMessage: '관리자 권한이 필요합니다.',
            privateMessage: 'private role detail',
        },
        {
            error: { kind: 'infrastructure' as const, message: 'private database detail' },
            publicMessage: '문서 단어 처리 중 오류가 발생했습니다.',
            privateMessage: 'private database detail',
        },
    ])('$error.kind 실패는 작업 모달을 유지하고 안전한 메시지만 표시한다', async ({ error, publicMessage, privateMessage }) => {
        mockApprove.mockResolvedValue(err(error));
        renderTable();
        await openRow('가방');

        await clickAction('추가 요청을 수락합니다.');

        expect(await screen.findByText(publicMessage)).toBeInTheDocument();
        expect(screen.getByText('현재 이 단어는 추가 요청 상태입니다.')).toBeInTheDocument();
        if (privateMessage) expect(screen.queryByText(privateMessage)).not.toBeInTheDocument();
    });

    it('성공 mutation 뒤 parent target refresh가 실패하면 작업 모달을 닫고 완료 모달을 열지 않는다', async () => {
        const onAdminActionComplete = jest.fn().mockResolvedValue(false);
        renderTable({ onAdminActionComplete });
        await openRow('가방');

        await clickAction('추가 요청을 수락합니다.');

        await waitFor(() => {
            expect(screen.queryByText('현재 이 단어는 추가 요청 상태입니다.')).not.toBeInTheDocument();
        });
        expect(screen.queryByText('작업이 완료되었습니다!')).not.toBeInTheDocument();
        expect(mockApprove).toHaveBeenCalledTimes(1);
    });
});

describe('Docs word target enrichment', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseDocsContent.mockReset();
        mockUseRecordDocsView.mockReset();
        mockCreateBrowserServices.mockReset();
        mockTargetGet.mockReset();
        mockRecordDocsView.mockReset();
        mockRecordDocsView.mockResolvedValue(undefined);
        mockUseRecordDocsView.mockReturnValue({ record: mockRecordDocsView });
    });

    it('query success 동안 target enrichment이 pending이면 강제 표시 LoadingPage를 유지한다', async () => {
        const targetLoad = createDeferred<ReturnType<typeof ok<{ targets: DocsWordMutationTarget[] }>>>();
        mockUseDocsContent.mockReturnValue({
            data: contentProjection(),
            error: null,
            isLoading: false,
            refetch: jest.fn(),
        } as never);
        mockTargetGet.mockReturnValue(targetLoad.promise);
        mockCreateBrowserServices.mockReturnValue({
            docsWordMutationTargetService: { get: mockTargetGet },
        } as never);

        render(<DocsDataPage id={55} />, { wrapper: createWrapper('guest', undefined) });

        expect(screen.getByRole('status', { name: '문서 로딩 중...' })).toBeInTheDocument();
        targetLoad.resolve(ok({ targets: [{ kind: 'registered-word', wordId: 55 }] }));
        expect(await screen.findByTestId('docs-row-나비')).toBeInTheDocument();
    });

    it('initial loading, not-found, and query error states are stable before a snapshot exists', () => {
        mockUseDocsContent.mockReturnValue({ data: undefined, error: null, isLoading: true, refetch: jest.fn() } as never);
        const { rerender } = render(<DocsDataPage id={55} />, { wrapper: createWrapper('guest', undefined) });
        expect(screen.getByRole('status', { name: '문서 로딩 중...' })).toBeInTheDocument();

        mockUseDocsContent.mockReturnValue({
            data: undefined,
            error: { kind: 'not-found', message: '문서를 찾을 수 없습니다.' },
            isLoading: false,
            refetch: jest.fn(),
        } as never);
        rerender(<DocsDataPage id={55} />);
        expect(screen.getByText('페이지를 찾을 수 없습니다')).toBeInTheDocument();

        mockUseDocsContent.mockReturnValue({
            data: undefined,
            error: { kind: 'infrastructure', message: '안전한 오류' },
            isLoading: false,
            refetch: jest.fn(),
        } as never);
        rerender(<DocsDataPage id={55} />);
        expect(screen.getByText('안전한 오류')).toBeInTheDocument();
    });

    it('initial success renders Korean-sorted rows and records the view command once', async () => {
        mockUseDocsContent.mockReturnValue({
            data: contentProjection({ words: [{ word: '하마', status: 'ok' }, { word: '가방', status: 'ok' }] }),
            error: null,
            isLoading: false,
            refetch: jest.fn(),
        } as never);
        mockTargetGet.mockResolvedValue(ok({
            targets: [
                { kind: 'registered-word', wordId: 1 },
                { kind: 'registered-word', wordId: 2 },
            ],
        }));
        mockCreateBrowserServices.mockReturnValue({
            docsWordMutationTargetService: { get: mockTargetGet },
        } as never);

        render(<DocsDataPage id={55} />, { wrapper: createWrapper('guest', undefined) });

        const renderedRows = await screen.findAllByTestId(/docs-row-/);
        expect(renderedRows.map((row) => row.dataset.testid)).toEqual(['docs-row-가방', 'docs-row-하마']);
        expect(mockRecordDocsView).toHaveBeenCalledTimes(1);
        expect(mockRecordDocsView).toHaveBeenCalledWith(55);
    });

    it('unmount before enrichment resolves never starts the view command', async () => {
        const targetLoad = createDeferred<ReturnType<typeof ok<{ targets: DocsWordMutationTarget[] }>>>();
        mockUseDocsContent.mockReturnValue({
            data: contentProjection(),
            error: null,
            isLoading: false,
            refetch: jest.fn(),
        } as never);
        mockTargetGet.mockReturnValue(targetLoad.promise);
        mockCreateBrowserServices.mockReturnValue({
            docsWordMutationTargetService: { get: mockTargetGet },
        } as never);

        const { unmount } = render(<DocsDataPage id={55} />, { wrapper: createWrapper('guest', undefined) });
        unmount();
        await act(async () => {
            targetLoad.resolve(ok({ targets: [{ kind: 'registered-word', wordId: 55 }] }));
            await targetLoad.promise;
        });

        expect(mockRecordDocsView).not.toHaveBeenCalled();
    });

    it('admin refetch preserves the snapshot on failure and never records a second view command', async () => {
        let refreshPage: () => void = () => {};
        const refetch = jest.fn(async () => ({
            data: undefined,
            error: { kind: 'infrastructure', message: 'private refetch failure' },
        }));
        mockUseDocsContent.mockReturnValue({
            data: contentProjection({ words: [{ word: '가방', status: 'add', requesterNickname: 'requester-1' }] }),
            error: null,
            isLoading: false,
            refetch: async () => {
                refreshPage();
                return refetch();
            },
        } as never);
        mockTargetGet.mockResolvedValue(ok({ targets: [rows[0].mutationTarget] }));
        mockCreateBrowserServices.mockReturnValue({
            docsWordMutationTargetService: { get: mockTargetGet },
        } as never);

        const PageHarness = () => {
            const [, setRenderCount] = useState(0);
            refreshPage = () => setRenderCount((count) => count + 1);
            return <DocsDataPage id={55} />;
        };
        const user = userEvent.setup();
        render(<PageHarness />, { wrapper: createWrapper() });

        await screen.findByTestId('docs-row-가방');
        await user.click(screen.getByRole('button', { name: 'reject-가방' }));

        expect(await screen.findByText('문서 단어 처리 대상을 새로고침하는 중 오류가 발생했습니다.')).toBeInTheDocument();
        expect(screen.getByTestId('docs-row-가방')).toBeInTheDocument();
        expect(mockRecordDocsView).toHaveBeenCalledTimes(1);
    });

    it('overlapping admin refreshes keep the latest enriched snapshot when an older refresh resolves last', async () => {
        const olderRefresh = createDeferred<{
            data: ReturnType<typeof contentProjection>;
            error: null;
        }>();
        const newerRefresh = createDeferred<{
            data: ReturnType<typeof contentProjection>;
            error: null;
        }>();
        const olderTargets = createDeferred<ReturnType<typeof ok<{ targets: DocsWordMutationTarget[] }>>>();
        const newerTargets = createDeferred<ReturnType<typeof ok<{ targets: DocsWordMutationTarget[] }>>>();
        const refetch = jest.fn()
            .mockReturnValueOnce(olderRefresh.promise)
            .mockReturnValueOnce(newerRefresh.promise);
        mockUseDocsContent.mockReturnValue({
            data: contentProjection({ words: [{ word: '초기단어', status: 'add' }] }),
            error: null,
            isLoading: false,
            refetch,
        } as never);
        mockTargetGet
            .mockResolvedValueOnce(ok({ targets: [{ kind: 'registered-word', wordId: 1 }] }))
            .mockReturnValueOnce(olderTargets.promise)
            .mockReturnValueOnce(newerTargets.promise);
        mockCreateBrowserServices.mockReturnValue({
            docsWordMutationTargetService: { get: mockTargetGet },
        } as never);

        const user = userEvent.setup();
        render(<DocsDataPage id={55} />, { wrapper: createWrapper() });
        await screen.findByTestId('docs-row-초기단어');

        await user.click(screen.getByRole('button', { name: 'reject-초기단어' }));
        await act(async () => {
            olderRefresh.resolve({
                data: contentProjection({ words: [{ word: '오래된새로고침', status: 'ok' }] }),
                error: null,
            });
            await olderRefresh.promise;
        });
        await waitFor(() => expect(mockTargetGet).toHaveBeenCalledTimes(2));

        await user.click(screen.getByRole('button', { name: 'reject-초기단어' }));
        expect(refetch).toHaveBeenCalledTimes(2);
        await act(async () => {
            newerRefresh.resolve({
                data: contentProjection({ words: [{ word: '최신새로고침', status: 'ok' }] }),
                error: null,
            });
            await newerRefresh.promise;
        });
        await waitFor(() => expect(mockTargetGet).toHaveBeenCalledTimes(3));
        await act(async () => {
            newerTargets.resolve(ok({ targets: [{ kind: 'registered-word', wordId: 3 }] }));
            await newerTargets.promise;
        });
        expect(await screen.findByTestId('docs-row-최신새로고침')).toBeInTheDocument();

        await act(async () => {
            olderTargets.resolve(ok({ targets: [{ kind: 'registered-word', wordId: 2 }] }));
            await olderTargets.promise;
        });
        expect(screen.getByTestId('docs-row-최신새로고침')).toBeInTheDocument();
        expect(screen.queryByTestId('docs-row-오래된새로고침')).not.toBeInTheDocument();
    });

    it('an admin refresh resolving after an id change cannot replace the newer document snapshot', async () => {
        const staleRefresh = createDeferred<{
            data: ReturnType<typeof contentProjection>;
            error: null;
        }>();
        const refetch = jest.fn().mockReturnValue(staleRefresh.promise);
        mockUseDocsContent.mockImplementation((docsId) => ({
            data: contentProjection({
                id: docsId,
                title: docsId === 55 ? '이전 문서' : '현재 문서',
                words: [{ word: docsId === 55 ? '이전단어' : '현재단어', status: 'add' }],
            }),
            error: null,
            isLoading: false,
            refetch,
        } as never));
        mockTargetGet.mockResolvedValue(ok({ targets: [{ kind: 'registered-word', wordId: 55 }] }));
        mockCreateBrowserServices.mockReturnValue({
            docsWordMutationTargetService: { get: mockTargetGet },
        } as never);

        const user = userEvent.setup();
        const { rerender } = render(<DocsDataPage id={55} />, { wrapper: createWrapper() });
        await screen.findByTestId('docs-row-이전단어');
        await user.click(screen.getByRole('button', { name: 'reject-이전단어' }));
        rerender(<DocsDataPage id={56} />);
        expect(await screen.findByTestId('docs-row-현재단어')).toBeInTheDocument();

        await act(async () => {
            staleRefresh.resolve({
                data: contentProjection({ id: 55, words: [{ word: '오래된응답', status: 'ok' }] }),
                error: null,
            });
            await staleRefresh.promise;
        });

        expect(screen.getByTestId('docs-row-현재단어')).toBeInTheDocument();
        expect(screen.queryByTestId('docs-row-오래된응답')).not.toBeInTheDocument();
    });

    it('unmount during an admin refresh ignores its eventual enrichment result', async () => {
        const refresh = createDeferred<{
            data: ReturnType<typeof contentProjection>;
            error: null;
        }>();
        mockUseDocsContent.mockReturnValue({
            data: contentProjection({ words: [{ word: '언마운트단어', status: 'add' }] }),
            error: null,
            isLoading: false,
            refetch: jest.fn().mockReturnValue(refresh.promise),
        } as never);
        mockTargetGet.mockResolvedValueOnce(ok({ targets: [{ kind: 'registered-word', wordId: 1 }] }));
        mockCreateBrowserServices.mockReturnValue({
            docsWordMutationTargetService: { get: mockTargetGet },
        } as never);

        const user = userEvent.setup();
        const { unmount } = render(<DocsDataPage id={55} />, { wrapper: createWrapper() });
        await screen.findByTestId('docs-row-언마운트단어');
        await user.click(screen.getByRole('button', { name: 'reject-언마운트단어' }));
        unmount();
        await act(async () => {
            refresh.resolve({
                data: contentProjection({ words: [{ word: '늦은응답', status: 'ok' }] }),
                error: null,
            });
            await refresh.promise;
        });
        expect(mockTargetGet).toHaveBeenCalledTimes(1);

        expect(mockRecordDocsView).toHaveBeenCalledTimes(1);
    });

    it('unmount and id change discard a stale enrichment result without recording the view command', async () => {
        const firstLoad = createDeferred<ReturnType<typeof ok<{ targets: DocsWordMutationTarget[] }>>>();
        const secondLoad = createDeferred<ReturnType<typeof ok<{ targets: DocsWordMutationTarget[] }>>>();
        mockUseDocsContent.mockImplementation((docsId) => ({
            data: contentProjection({
                id: docsId,
                words: [{ word: docsId === 55 ? '오래된단어' : '새단어', status: 'ok' }],
            }),
            error: null,
            isLoading: false,
            refetch: jest.fn(),
        } as never));
        mockTargetGet.mockImplementation(({ docsId }: { docsId: number }) => docsId === 55 ? firstLoad.promise : secondLoad.promise);
        mockCreateBrowserServices.mockReturnValue({
            docsWordMutationTargetService: { get: mockTargetGet },
        } as never);

        const { rerender, unmount } = render(<DocsDataPage id={55} />, { wrapper: createWrapper('guest', undefined) });
        rerender(<DocsDataPage id={56} />);
        firstLoad.resolve(ok({ targets: [{ kind: 'registered-word', wordId: 55 }] }));
        secondLoad.resolve(ok({ targets: [{ kind: 'registered-word', wordId: 56 }] }));

        expect(await screen.findByTestId('docs-row-새단어')).toBeInTheDocument();
        expect(screen.queryByTestId('docs-row-오래된단어')).not.toBeInTheDocument();
        unmount();
        expect(mockRecordDocsView).toHaveBeenCalledTimes(1);
        expect(mockRecordDocsView).toHaveBeenCalledWith(56);
    });

    it('base rows를 한 번 조회하고 반환된 target을 입력 순서대로 보강한다', async () => {
        const { enrichDocsWordData } = await import('../../../app/words-docs/[id]/docs-word-data');
        const service = {
            get: jest.fn().mockResolvedValue(ok({
                targets: [rows[0].mutationTarget, rows[1].mutationTarget],
            })),
        };
        const baseRows = rows.slice(0, 2).map(({ mutationTarget: _target, ...row }) => row);

        const result = await enrichDocsWordData(55, baseRows, service);

        expect(service.get).toHaveBeenCalledWith({
            docsId: 55,
            rows: [
                { word: '가방', status: 'add' },
                { word: '나비', status: 'delete' },
            ],
        });
        expect(result).toEqual(ok(rows.slice(0, 2)));
    });

    it('target 개수가 base row와 다르면 내부 상세 없는 load 오류를 반환한다', async () => {
        const { enrichDocsWordData } = await import('../../../app/words-docs/[id]/docs-word-data');
        const service = { get: jest.fn().mockResolvedValue(ok({ targets: [] })) };

        const result = await enrichDocsWordData(55, [
            { word: '가방', status: 'add', maker: 'requester-1' },
        ], service);

        expect(result).toEqual(err({
            kind: 'infrastructure',
            message: '문서 단어 처리 대상을 불러오는 중 오류가 발생했습니다.',
        }));
    });

    it('DocsDataPage는 legacy rows를 target 조회로 보강하고 실패하면 safe ErrorPage를 표시한다', async () => {
        mockUseDocsContent.mockReturnValue({
            data: {
                metadata: { id: 55, title: '테스트 주제', lastUpdatedAt: '2026-08-22T00:00:00.000Z', type: 'theme' },
                starredUserIds: [],
                words: [{ word: '가방', status: 'ok' }, { word: '나비', status: 'delete', requesterNickname: 'requester-2' }],
                missionCharacter: null,
                isSpecial: false,
                isMissionParent: false,
            },
            error: null,
            isLoading: false,
            refetch: jest.fn(),
        } as never);
        mockTargetGet.mockResolvedValue(err({
            kind: 'infrastructure',
            message: 'private target query detail',
        }));
        mockCreateBrowserServices.mockReturnValue({
            docsWordMutationTargetService: { get: mockTargetGet },
        } as never);

        render(<DocsDataPage id={55} />, { wrapper: createWrapper('guest', undefined) });

        expect(await screen.findByText('문서 단어 처리 대상을 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument();
        expect(screen.queryByText('private target query detail')).not.toBeInTheDocument();
        expect(mockTargetGet).toHaveBeenCalledWith({
            docsId: 55,
            rows: [
                { word: '가방', status: 'ok' },
                { word: '나비', status: 'delete' },
            ],
        });
    });

});

describe('DocsDataHome row transitions', () => {
    beforeEach(() => {
        mockTargetGet.mockResolvedValue(ok({
            targets: [{ kind: 'registered-word', wordId: 101 }],
        }));
        mockCreateBrowserServices.mockReturnValue({
            docsWordMutationTargetService: { get: mockTargetGet },
        } as never);
    });

    const renderHome = (data: DocsWordData[]) => render(
        <DocsDataHome
            id={55}
            data={data}
            metaData={{ title: '테스트 문서', lastUpdate: '2026-08-22T00:00:00.000Z', typez: 'theme' }}
            starCount={[]}
        />,
        { wrapper: createWrapper('guest', undefined) },
    );

    it.each([
        { name: '추가 반려', row: rows[0], action: 'reject' as const },
        { name: '삭제 승인', row: rows[1], action: 'approve' as const },
        { name: '직접 삭제', row: rows[2], action: 'delete-directly' as const },
    ])('$name 성공은 정확한 대상 행을 제거한다', async ({ row, action }) => {
        const user = userEvent.setup();
        renderHome([row]);
        await waitFor(() => expect(screen.getByTestId(`docs-row-${row.word}`)).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: `${action}-${row.word}` }));

        await waitFor(() => expect(screen.queryByTestId(`docs-row-${row.word}`)).not.toBeInTheDocument());
        expect(mockTargetGet).not.toHaveBeenCalled();
    });

    it.each([
        { name: '전체 추가 승인', row: rows[0], action: 'approve' as const, wordId: 101 },
        {
            name: '주제 추가 승인',
            row: {
                word: '라디오',
                status: 'add' as const,
                maker: 'requester-3',
                mutationTarget: { kind: 'theme-change' as const, wordId: 19, themeId: 23, type: 'add' as const },
            },
            action: 'approve' as const,
            wordId: 103,
        },
        { name: '주제 삭제 반려', row: rows[1], action: 'reject' as const, wordId: 107 },
        {
            name: '전체 삭제 반려',
            row: {
                word: '마차',
                status: 'delete' as const,
                maker: 'requester-4',
                mutationTarget: {
                    kind: 'word-request' as const,
                    requestId: 29,
                    requestType: 'delete' as const,
                    selectedThemeIds: [],
                },
            },
            action: 'reject' as const,
            wordId: 109,
        },
    ])('$name 성공은 ok target을 다시 조회한 뒤 maker와 target을 교체한다', async ({ row, action, wordId }) => {
        mockTargetGet.mockResolvedValue(ok({
            targets: [{ kind: 'registered-word', wordId }],
        }));
        const user = userEvent.setup();
        renderHome([row]);
        await waitFor(() => expect(screen.getByTestId(`docs-row-${row.word}`)).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: `${action}-${row.word}` }));

        await waitFor(() => {
            expect(screen.getByTestId(`docs-row-${row.word}`)).toHaveTextContent(
                `${row.word}|ok|none|registered-word:${wordId}`,
            );
        });
        expect(mockTargetGet).toHaveBeenCalledWith({
            docsId: 55,
            rows: [{ word: row.word, status: 'ok' }],
        });
    });

    it.each([
        ['service failure', err({ kind: 'conflict' as const, message: 'private target detail' })],
        ['missing registered target', ok({ targets: [null] })],
    ])('%s 뒤에는 이미 처리된 행을 ok/null로 유지하고 안전한 Modal을 표시한다', async (_name, targetResult) => {
        mockTargetGet.mockResolvedValue(targetResult);
        const user = userEvent.setup();
        renderHome([rows[0]]);
        await waitFor(() => expect(screen.getByTestId('docs-row-가방')).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: 'approve-가방' }));

        await waitFor(() => {
            expect(screen.getByTestId('docs-row-가방')).toHaveTextContent('가방|ok|none|null');
            expect(screen.getByText('문서 단어 처리 대상을 새로고침하는 중 오류가 발생했습니다.')).toBeInTheDocument();
        });
        expect(screen.queryByText('private target detail')).not.toBeInTheDocument();
        expect(mockTargetGet).toHaveBeenCalledTimes(1);
    });
});

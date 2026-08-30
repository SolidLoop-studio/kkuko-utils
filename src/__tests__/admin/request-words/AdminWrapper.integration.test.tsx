import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';

jest.unmock('../../../app/components/ui/badge');
jest.unmock('../../../app/components/ui/button');
jest.unmock('../../../app/components/ui/card');
jest.unmock('../../../app/components/ui/checkbox');
jest.unmock('../../../app/components/ErrModal');

jest.mock('../../../modules/word-moderation/infrastructure/browser/browser-word-moderation-services', () => ({
    createBrowserWordModerationServices: jest.fn(),
}));

jest.mock('../../../app/admin/request-words/ThemeSelectModal', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../../../modules/word-moderation', () => ({
    ...jest.requireActual('../../../modules/word-moderation'),
    useWordRequestModeration: jest.fn(),
}));

import { store } from '../../../app/store/store';
import AdminWrapper from '../../../app/admin/request-words/AdminWrapper';
import {
    useWordRequestModeration,
    pendingWordModerationQueryKey,
    type PendingWordModerationRequest,
} from '../../../modules/word-moderation';
import { createBrowserWordModerationServices } from '../../../modules/word-moderation/infrastructure/browser/browser-word-moderation-services';
import { err, ok } from '../../../shared/application/result';

const pendingRequest: PendingWordModerationRequest = {
    requestKey: 'word-request:11',
    id: 11,
    word: '가나',
    requestType: 'delete',
    requestedAt: '2026-08-26T00:00:00.000Z',
    requesterNickname: '신청자',
};

const infrastructureError = {
    kind: 'infrastructure' as const,
    message: '단어 요청 목록을 불러오는 중 오류가 발생했습니다.',
};

describe('AdminWrapper query integration', () => {
    it('keeps a theme selection attached to its business request when a refetch reorders colliding numeric IDs', async () => {
        // Break caught: indexing UI state by a numeric ID shared by a grouped theme request and a word request.
        const user = userEvent.setup();
        const themeRequest: PendingWordModerationRequest = {
            requestKey: 'theme-change:10',
            id: 10,
            word: '가',
            requestType: 'theme_change',
            requestedAt: '2026-08-26T00:00:00.000Z',
            requesterNickname: '주제 요청자',
            wordId: 10,
            themes: [{ id: 101, name: '식물', code: 'plant', type: 'add' }],
        };
        const wordRequest: PendingWordModerationRequest = {
            requestKey: 'word-request:10',
            id: 10,
            word: '나',
            requestType: 'delete',
            requestedAt: '2026-08-26T01:00:00.000Z',
            requesterNickname: '단어 요청자',
            wordId: 20,
        };
        const get = jest.fn().mockResolvedValue(ok([themeRequest, wordRequest]));
        jest.mocked(createBrowserWordModerationServices).mockReturnValue({
            pendingWordModerationQueryService: { get },
        } as unknown as ReturnType<typeof createBrowserWordModerationServices>);
        const approve = jest.fn().mockResolvedValue({
            ok: true,
            value: {
                processedWordRequestCount: 0,
                processedThemeChangeCount: 1,
                affectedDocsIds: [],
            },
        });
        jest.mocked(useWordRequestModeration).mockReturnValue({
            approve,
            reject: jest.fn(),
            isPending: false,
            error: null,
            clearError: jest.fn(),
        });
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false, gcTime: Infinity },
                mutations: { retry: false },
            },
        });

        render(
            <Provider store={store}>
                <QueryClientProvider client={queryClient}>
                    <AdminWrapper />
                </QueryClientProvider>
            </Provider>,
        );

        await user.click(await screen.findByLabelText(/식물/));
        expect(screen.getByRole('checkbox', { name: '가 선택' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: '나 선택' })).not.toBeChecked();

        await act(async () => {
            queryClient.setQueryData(pendingWordModerationQueryKey, [wordRequest, themeRequest]);
        });
        expect(screen.getByRole('checkbox', { name: '가 선택' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: '나 선택' })).not.toBeChecked();

        await user.click(screen.getByRole('button', { name: '선택 승인' }));

        expect(approve).toHaveBeenCalledWith({
            selections: [{
                kind: 'theme-change',
                wordId: 10,
                changes: [{ themeId: 101, type: 'add' }],
            }],
        });
    });

    it('keeps cached moderation content mounted and shows its safe Modal after a failed refetch', async () => {
        // Break caught: treating a background refetch error as an initial full-page load error.
        const user = userEvent.setup();
        const get = jest.fn()
            .mockResolvedValueOnce(ok([pendingRequest]))
            .mockResolvedValue(err(infrastructureError));
        jest.mocked(createBrowserWordModerationServices).mockReturnValue({
            pendingWordModerationQueryService: { get },
        } as unknown as ReturnType<typeof createBrowserWordModerationServices>);
        const approve = jest.fn().mockResolvedValue({
            ok: true,
            value: {
                processedWordRequestCount: 1,
                processedThemeChangeCount: 0,
                affectedDocsIds: [],
            },
        });
        jest.mocked(useWordRequestModeration).mockReturnValue({
            approve,
            reject: jest.fn(),
            isPending: false,
            error: null,
            clearError: jest.fn(),
        });
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retryDelay: 0, gcTime: Infinity },
                mutations: { retry: false },
            },
        });

        render(
            <Provider store={store}>
                <QueryClientProvider client={queryClient}>
                    <AdminWrapper />
                </QueryClientProvider>
            </Provider>,
        );

        const rowSelection = await screen.findByRole('checkbox', { name: '가나 선택' });
        await user.click(rowSelection);
        await user.click(screen.getByRole('button', { name: '선택 승인' }));

        await waitFor(() => {
            expect(screen.getByText('요청 목록을 새로고침하는 중 오류가 발생했습니다.')).toBeInTheDocument();
        });
        expect(screen.getByText('가나', { selector: 'td' })).toBeInTheDocument();
        expect(approve).toHaveBeenCalledTimes(1);
        expect(get).toHaveBeenCalledTimes(5);
    });
});

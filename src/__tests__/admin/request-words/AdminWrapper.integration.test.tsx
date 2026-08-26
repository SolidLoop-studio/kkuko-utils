import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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
    type PendingWordModerationRequest,
} from '../../../modules/word-moderation';
import { createBrowserWordModerationServices } from '../../../modules/word-moderation/infrastructure/browser/browser-word-moderation-services';
import { err, ok } from '../../../shared/application/result';

const pendingRequest: PendingWordModerationRequest = {
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

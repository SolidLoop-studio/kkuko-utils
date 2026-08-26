import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { useState } from 'react';

jest.mock('../../../modules/word-moderation', () => ({
    usePendingWordModerationRequests: jest.fn(),
}));

jest.mock('../../../app/admin/request-words/AdminRequestHome', () => ({
    __esModule: true,
    default: ({ requestData, refreshFn }: {
        requestData: Array<{ word: string; request_type: string; requested_by: string }>;
        refreshFn: () => Promise<void>;
    }) => {
        const [refreshState, setRefreshState] = useState('idle');
        return (
            <div>
                <span>{requestData.map((request) => `${request.word}:${request.request_type}:${request.requested_by}`).join('|')}</span>
                <button type="button" onClick={() => {
                    void refreshFn().then(() => setRefreshState('success')).catch(() => setRefreshState('failed'));
                }}>새로고침</button>
                <span>{refreshState}</span>
            </div>
        );
    },
}));

import { store } from '../../../app/store/store';
import { usePendingWordModerationRequests } from '../../../modules/word-moderation';
import AdminWrapper from '../../../app/admin/request-words/AdminWrapper';

const mockUsePendingRequests = usePendingWordModerationRequests as jest.MockedFunction<typeof usePendingWordModerationRequests>;

const renderWrapper = () => render(
    <Provider store={store}>
        <AdminWrapper />
    </Provider>,
);

describe('AdminWrapper', () => {
    beforeEach(() => jest.clearAllMocks());

    it('renders the existing loading screen while the feature query is loading', () => {
        mockUsePendingRequests.mockReturnValue({ isLoading: true } as ReturnType<typeof usePendingWordModerationRequests>);

        renderWrapper();

        expect(screen.getByRole('heading', { name: '관리자 페이지 로딩 중' })).toBeInTheDocument();
    });

    it('passes the stable projection to the moderation screen using its existing prop shape', () => {
        mockUsePendingRequests.mockReturnValue({
            data: [{
                id: 100_000_000,
                word: '가나',
                requestType: 'theme_change',
                requestedAt: '2026-08-26T00:00:00.000Z',
                requesterNickname: '신청자',
                themes: [{ id: 3, name: '주제', code: 'theme', type: 'add' }],
                wordId: 7,
            }],
            error: null,
            isLoading: false,
            refetch: jest.fn(),
        } as unknown as ReturnType<typeof usePendingWordModerationRequests>);

        renderWrapper();

        expect(screen.getByText('가나:theme_change:신청자')).toBeInTheDocument();
    });

    it('renders only the stable application message on query failure', () => {
        mockUsePendingRequests.mockReturnValue({
            error: {
                kind: 'infrastructure',
                message: '단어 요청 목록을 불러오는 중 오류가 발생했습니다.',
            },
            isLoading: false,
        } as ReturnType<typeof usePendingWordModerationRequests>);

        renderWrapper();

        expect(screen.getByText('단어 요청 목록을 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument();
        expect(screen.queryByText(/ErrorName|private database detail/)).not.toBeInTheDocument();
    });

    it('keeps the existing refresh failure contract when React Query refetch returns an error', async () => {
        const refetch = jest.fn().mockResolvedValue({
            error: { kind: 'infrastructure', message: 'stable failure' },
        });
        mockUsePendingRequests.mockReturnValue({
            data: [], error: null, isLoading: false, refetch,
        } as unknown as ReturnType<typeof usePendingWordModerationRequests>);
        renderWrapper();

        fireEvent.click(screen.getByRole('button', { name: '새로고침' }));

        await waitFor(() => expect(screen.getByText('failed')).toBeInTheDocument());
        expect(refetch).toHaveBeenCalledTimes(1);
    });
});

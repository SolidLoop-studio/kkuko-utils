import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import userEvent from '@testing-library/user-event';

jest.unmock('../../../app/components/ui/card');
jest.unmock('../../../app/components/ui/button');
jest.unmock('../../../app/components/ui/checkbox');
jest.unmock('../../../app/components/ui/table');
jest.unmock('../../../app/components/ui/pagination');

jest.mock('../../../modules/docs', () => ({
    usePendingDocsRequests: jest.fn(),
    useDocsRequestModeration: jest.fn(),
}));

import { resetLoadingState, updateLoadingState } from '../../../app/store/slice';
import { store } from '../../../app/store/store';
import {
    useDocsRequestModeration,
    usePendingDocsRequests,
} from '../../../modules/docs';
import RequestDocsWrapper from '../../../app/admin/request-docs/RequestDocsWrapper';

const mockUsePendingDocsRequests = usePendingDocsRequests as jest.MockedFunction<typeof usePendingDocsRequests>;
const mockUseDocsRequestModeration = useDocsRequestModeration as jest.MockedFunction<typeof useDocsRequestModeration>;
const mockApprove = jest.fn();

const request = {
    id: 11,
    requestedAt: '2026-08-22T00:00:00.000Z',
    docsName: '가',
    requesterNickname: '신청자 A',
    requesterId: '00000000-0000-0000-0000-000000000011',
};

const createQueryClient = () => new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const renderWrapper = (queryClient = createQueryClient()) => ({
    queryClient,
    ...render(
        <Provider store={store}>
            <QueryClientProvider client={queryClient}>
                <RequestDocsWrapper />
            </QueryClientProvider>
        </Provider>,
    ),
});

const setPendingQuery = (result: {
    data?: (typeof request)[];
    error?: { kind: 'infrastructure'; message: string } | null;
    isLoading: boolean;
}) => {
    mockUsePendingDocsRequests.mockReturnValue(result as ReturnType<typeof usePendingDocsRequests>);
};

describe('RequestDocsWrapper', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        store.dispatch(updateLoadingState({ progress: 100, task: '완료' }));
        mockUseDocsRequestModeration.mockReturnValue({
            approve: mockApprove,
            reject: jest.fn(),
            isPending: false,
            error: null,
            clearError: jest.fn(),
        });
        mockApprove.mockResolvedValue({
            ok: true,
            value: { processedRequestIds: [11], processedRequestCount: 1 },
        });
    });

    it('renders the existing LoadingPage title while the pending query loads', () => {
        store.dispatch(resetLoadingState());
        setPendingQuery({ isLoading: true });

        renderWrapper();

        expect(screen.getByRole('status', { name: '문서 요청 목록 로딩 중...' })).toBeInTheDocument();
    });

    it('renders camelCase pending request DTOs in the existing moderation table', () => {
        setPendingQuery({ data: [request], isLoading: false });

        renderWrapper();

        expect(screen.getByText('가', { selector: 'td' })).toBeInTheDocument();
        expect(screen.getByText('신청자 A', { selector: 'td' })).toBeInTheDocument();
    });

    it('renders only the stable message for a typed infrastructure error', () => {
        setPendingQuery({
            error: {
                kind: 'infrastructure',
                message: '문서 요청 목록을 불러오는 중 오류가 발생했습니다.',
            },
            isLoading: false,
        });

        renderWrapper();

        expect(screen.getByText('문서 요청 목록을 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument();
    });

    it('renders the moderation screen without request rows for an empty result', () => {
        setPendingQuery({ data: [], isLoading: false });

        renderWrapper();

        expect(screen.getByText('문서 대기 관리자 페이지')).toBeInTheDocument();
        expect(screen.getByText('요청이 없습니다.')).toBeInTheDocument();
    });

    it('removes moderated requests from the pending-query cache before the screen remounts', async () => {
        const user = userEvent.setup();
        const queryClient = createQueryClient();
        queryClient.setQueryData(['docs', 'requests', 'pending'], [request]);
        mockUsePendingDocsRequests.mockImplementation(() => ({
            data: queryClient.getQueryData(['docs', 'requests', 'pending']),
            error: null,
            isLoading: false,
        }) as ReturnType<typeof usePendingDocsRequests>);

        const firstRender = renderWrapper(queryClient);
        await user.click(screen.getByRole('checkbox', { name: '가 선택' }));
        await user.click(screen.getByRole('button', { name: '선택 승인' }));
        await waitFor(() => expect(screen.queryByText('가', { selector: 'td' })).not.toBeInTheDocument());

        firstRender.unmount();
        renderWrapper(queryClient);

        expect(screen.queryByText('가', { selector: 'td' })).not.toBeInTheDocument();
    });
});

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.unmock('../../../app/components/ui/button');

Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { value: jest.fn(() => false), configurable: true },
    setPointerCapture: { value: jest.fn(), configurable: true },
    releasePointerCapture: { value: jest.fn(), configurable: true },
    scrollIntoView: { value: jest.fn(), configurable: true },
});

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('react-redux', () => ({
    useSelector: (selector: (state: unknown) => unknown) => selector({ user: { uuid: 'requester-1' } }),
}));
jest.mock('../../../modules/word-logs', () => ({ useWordLogPage: jest.fn() }));
jest.mock('../../../app/components/ErrModal', () => (
    ({ onClose, error }: { onClose: () => void; error: ErrorMessage }) => (
        <div data-testid="error-modal">
            <button onClick={onClose}>Close</button>
            <div>{error.ErrMessage}</div>
        </div>
    )
));

import type {
    WordLogPageProjection,
    WordLogPageQuery,
} from '@/src/modules/word-logs';
import { useWordLogPage } from '@/src/modules/word-logs';
import LogsHome from '@/src/app/word/logs/LogsHome';

const mockUseWordLogPage = useWordLogPage as jest.MockedFunction<typeof useWordLogPage>;

const row = {
    id: 31,
    createdAt: '2026-08-29T00:00:00.000Z',
    word: '가나',
    requesterId: 'requester-1',
    processorId: null,
    state: 'approved' as const,
    requestType: 'add' as const,
    requesterNickname: '신청자',
    processorNickname: null,
};

const projectionFor = (query: WordLogPageQuery): WordLogPageProjection => ({
    items: [row],
    totalCount: 61,
    page: query.page,
    pageSize: query.pageSize,
});

const lastQuery = (): WordLogPageQuery => {
    const calls = mockUseWordLogPage.mock.calls;
    return calls[calls.length - 1][0];
};

describe('LogsHome', () => {
    beforeEach(() => {
        const refetch = jest.fn().mockResolvedValue(undefined);
        mockUseWordLogPage.mockImplementation((query) => ({
            data: projectionFor(query),
            error: null,
            isLoading: false,
            isFetching: false,
            isPlaceholderData: false,
            refetch,
        } as unknown as ReturnType<typeof useWordLogPage>));
    });

    test('shows initial loading, then the exact count and visible row fields', () => {
        // Break caught: dropping the loading skeleton, exact count, or a currently visible column.
        mockUseWordLogPage.mockReturnValueOnce({
            data: undefined,
            error: null,
            isLoading: true,
            isFetching: true,
            refetch: jest.fn(),
        } as unknown as ReturnType<typeof useWordLogPage>);
        const { rerender } = render(<LogsHome />);

        expect(screen.getAllByTestId('word-log-skeleton')).toHaveLength(30);

        rerender(<LogsHome />);
        expect(lastQuery()).toEqual({
            page: 1,
            pageSize: 30,
            state: 'all',
            requestType: 'all',
        });
        expect(screen.getByText('총 61개 결과')).toBeInTheDocument();
        expect(screen.getByText('가나')).toBeInTheDocument();
        expect(screen.getByText('신청자')).toBeInTheDocument();
        expect(screen.getByText('승인')).toBeInTheDocument();
        expect(screen.getByText('추가')).toBeInTheDocument();
    });

    test('resets to page one on state and type changes and requests later pages', async () => {
        // Break caught: retaining a stale page across filters or failing to include visible inputs in the query.
        const user = userEvent.setup();
        render(<LogsHome />);

        await user.click(screen.getByRole('button', { name: '다음' }));
        expect(lastQuery().page).toBe(2);

        await user.click(screen.getAllByRole('combobox')[0]);
        await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: '대기중' }));
        await waitFor(() => expect(lastQuery()).toEqual({
            page: 1,
            pageSize: 30,
            state: 'pending',
            requestType: 'all',
        }));

        await user.click(screen.getAllByRole('combobox')[1]);
        await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: '삭제 요청' }));
        await waitFor(() => expect(lastQuery()).toEqual({
            page: 1,
            pageSize: 30,
            state: 'pending',
            requestType: 'delete',
        }));
    });

    test('keeps pagination metadata but hides stale rows during an uncached page transition', async () => {
        // Break caught: rendering `2 / 0` metadata or presenting page-one rows as page two while it loads.
        const user = userEvent.setup();
        mockUseWordLogPage.mockImplementation((currentQuery) => ({
            data: currentQuery.page === 1
                ? projectionFor(currentQuery)
                : projectionFor({ ...currentQuery, page: 1 }),
            error: null,
            isLoading: false,
            isFetching: currentQuery.page === 2,
            isPlaceholderData: currentQuery.page === 2,
            refetch: jest.fn(),
        } as unknown as ReturnType<typeof useWordLogPage>));
        render(<LogsHome />);

        expect(screen.getByText('가나')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: '다음' }));

        expect(lastQuery().page).toBe(2);
        expect(screen.getByText('2 / 3 페이지')).toBeInTheDocument();
        expect(screen.getByText('(31-60 / 61)')).toBeInTheDocument();
        expect(screen.getAllByTestId('word-log-skeleton')).toHaveLength(30);
        expect(screen.queryByText('가나')).not.toBeInTheDocument();
    });

    test('renders an empty page and bounds pagination from exact totalCount', () => {
        // Break caught: retaining stale rows or enabling pagination when exact count is zero.
        mockUseWordLogPage.mockImplementation((query) => ({
            data: { items: [], totalCount: 0, page: query.page, pageSize: query.pageSize },
            error: null,
            isLoading: false,
            isFetching: false,
            refetch: jest.fn(),
        } as unknown as ReturnType<typeof useWordLogPage>));

        render(<LogsHome />);

        expect(screen.getByText('조건에 맞는 로그가 없습니다.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
        expect(screen.getByText('1 / 0 페이지')).toBeInTheDocument();
    });

    test('refreshes through React Query and displays only the safe Korean error', async () => {
        // Break caught: bypassing React Query refresh or exposing private database diagnostics in the modal.
        const user = userEvent.setup();
        const refetch = jest.fn().mockResolvedValue(undefined);
        mockUseWordLogPage.mockReturnValue({
            data: undefined,
            error: {
                kind: 'infrastructure',
                message: '로그를 불러오는 중 오류가 발생했습니다.',
            },
            isLoading: false,
            isFetching: false,
            refetch,
        } as unknown as ReturnType<typeof useWordLogPage>);

        render(<LogsHome />);
        await user.click(screen.getByRole('button', { name: '새로고침' }));

        expect(refetch).toHaveBeenCalledTimes(1);
        expect(screen.getByText('로그를 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument();
        expect(screen.queryByText(/private|PostgREST|Supabase/)).not.toBeInTheDocument();
    });
});

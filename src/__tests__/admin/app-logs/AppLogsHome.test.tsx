import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.unmock('../../../app/components/ui/card');
jest.unmock('../../../app/components/ui/button');

jest.mock('../../../modules/admin-api-server', () => ({
    fetchAppErrorLogs: jest.fn(),
    deleteAppErrorLogs: jest.fn(),
}));

import AppLogsHome from '@/src/app/admin/app-logs/AppLogsHome';
import * as appLogServices from '@/src/modules/admin-api-server';

const mockServices = jest.mocked(appLogServices);
const logs = [
    {
        id: 'error-1', createdAt: '2026-08-31T01:02:03.000Z', message: '첫 번째 오류', severity: 'ERROR' as const,
        stack: 'Error: first', errorCode: 'FIRST', url: '/first', component: 'FirstView', browser: 'Chrome',
        os: 'Windows', userId: 'user-1', ipAddress: '127.0.0.1',
    },
    {
        id: 'error-2', createdAt: '2026-08-31T02:03:04.000Z', message: '두 번째 경고', severity: 'WARN' as const,
        stack: null, errorCode: null, url: null, component: null, browser: null,
        os: null, userId: null, ipAddress: null,
    },
];

const renderPage = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <AppLogsHome />
        </QueryClientProvider>,
    );
};

describe('AppLogsHome', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockServices.fetchAppErrorLogs.mockResolvedValue(logs);
        mockServices.deleteAppErrorLogs.mockResolvedValue({
            message: 'Error logs deleted successfully',
            deletedCount: 2,
        });
    });

    test('loads the latest 100 logs and exposes full details from a row', async () => {
        // Break caught: changing the safe initial query size or making diagnostic fields inaccessible from the list.
        const user = userEvent.setup();
        renderPage();

        expect(await screen.findByText('첫 번째 오류')).toBeInTheDocument();
        expect(mockServices.fetchAppErrorLogs).toHaveBeenCalledWith(100);
        expect(screen.getByRole('link', { name: '관리자 대시보드로 이동' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '관리자 대시보드로 이동' })).not.toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: '첫 번째 오류 (error-1) 선택' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: '첫 번째 오류 상세 보기' }));
        expect(screen.getByRole('dialog')).toHaveTextContent('Error: first');
        expect(screen.getByRole('dialog')).toHaveTextContent('127.0.0.1');
    });

    test('selects the current result set and deletes all selected ids after confirmation', async () => {
        // Break caught: deleting only one row, skipping confirmation, or retaining stale selected rows after deletion.
        const user = userEvent.setup();
        renderPage();
        await screen.findByText('첫 번째 오류');

        await user.click(screen.getByRole('checkbox', { name: '모든 로그 선택' }));
        await user.click(screen.getByRole('button', { name: '선택 로그 삭제 (2)' }));
        expect(mockServices.deleteAppErrorLogs).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: '확인' }));
        await waitFor(() => expect(mockServices.deleteAppErrorLogs.mock.calls[0]?.[0]).toEqual(['error-1', 'error-2']));
        await waitFor(() => expect(mockServices.fetchAppErrorLogs).toHaveBeenCalledTimes(2));
        expect(await screen.findByText('2개의 애플리케이션 로그를 삭제했습니다.')).toBeInTheDocument();
    });

    test('shows a stable error without leaking rejected transport details', async () => {
        // Break caught: rendering an upstream response body or stack in the administrator error modal.
        mockServices.fetchAppErrorLogs.mockRejectedValue(new Error('private upstream response'));
        renderPage();

        expect(await screen.findByText('애플리케이션 로그를 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument();
        expect(screen.queryByText(/private upstream response/)).not.toBeInTheDocument();
    });

    test('drops selections that are no longer present after refreshing the result set', async () => {
        // Break caught: submitting ids selected from a stale result after refresh replaces every visible row.
        const user = userEvent.setup();
        mockServices.fetchAppErrorLogs
            .mockResolvedValueOnce(logs)
            .mockResolvedValueOnce([{ ...logs[0], id: 'error-3', message: '새 오류' }]);
        renderPage();
        await screen.findByText('첫 번째 오류');

        await user.click(screen.getByRole('checkbox', { name: '첫 번째 오류 (error-1) 선택' }));
        await user.click(screen.getByRole('button', { name: '새로고침' }));

        expect(await screen.findByText('새 오류')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '선택 로그 삭제 (0)' })).toBeDisabled();
    });

    test('prevents repeated confirmation while a deletion request is pending', async () => {
        // Break caught: double-clicking confirmation starts concurrent destructive requests for the same ids.
        const user = userEvent.setup();
        let resolveDelete: ((value: { message: string; deletedCount: number }) => void) | undefined;
        mockServices.deleteAppErrorLogs.mockImplementation(() => new Promise((resolve) => {
            resolveDelete = resolve;
        }));
        renderPage();
        await screen.findByText('첫 번째 오류');
        await user.click(screen.getByRole('checkbox', { name: '첫 번째 오류 (error-1) 선택' }));
        await user.click(screen.getByRole('button', { name: '선택 로그 삭제 (1)' }));

        const confirmButton = screen.getByRole('button', { name: '확인' });
        await user.click(confirmButton);
        await waitFor(() => expect(mockServices.deleteAppErrorLogs).toHaveBeenCalledTimes(1));
        expect(screen.getByRole('button', { name: '처리 중...' })).toBeDisabled();
        await user.click(screen.getByRole('button', { name: '처리 중...' }));
        expect(mockServices.deleteAppErrorLogs).toHaveBeenCalledTimes(1);

        await act(async () => {
            resolveDelete?.({ message: 'Error logs deleted successfully', deletedCount: 1 });
        });
        expect(await screen.findByText('1개의 애플리케이션 로그를 삭제했습니다.')).toBeInTheDocument();
    });

    test('renders a safe fallback if an invalid timestamp reaches the component', async () => {
        // Break caught: one malformed record crashes the complete log table instead of remaining inspectable.
        mockServices.fetchAppErrorLogs.mockResolvedValue([{ ...logs[0], createdAt: 'not-a-timestamp' }]);
        renderPage();

        expect(await screen.findByText('알 수 없는 시각')).toBeInTheDocument();
        expect(screen.getByText('첫 번째 오류')).toBeInTheDocument();
    });

    test('removes deleted rows locally without showing a second dialog when refresh fails', async () => {
        // Break caught: retaining deleted rows and opening failure and completion dialogs together after a failed refresh.
        const user = userEvent.setup();
        mockServices.fetchAppErrorLogs
            .mockResolvedValueOnce(logs)
            .mockRejectedValueOnce(new Error('refresh failed'));
        mockServices.deleteAppErrorLogs.mockResolvedValue({
            message: 'Error logs deleted successfully',
            deletedCount: 1,
        });
        renderPage();
        await screen.findByText('첫 번째 오류');
        await user.click(screen.getByRole('checkbox', { name: '첫 번째 오류 (error-1) 선택' }));
        await user.click(screen.getByRole('button', { name: '선택 로그 삭제 (1)' }));
        await user.click(screen.getByRole('button', { name: '확인' }));

        expect(await screen.findByText('1개의 애플리케이션 로그를 삭제했습니다.')).toBeInTheDocument();
        expect(screen.queryByText('첫 번째 오류')).not.toBeInTheDocument();
        expect(screen.getByText('두 번째 경고')).toBeInTheDocument();
        expect(screen.queryByText('애플리케이션 로그 작업 오류')).not.toBeInTheDocument();
    });
});

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.unmock('../../../app/components/ui/card');
jest.unmock('../../../app/components/ui/button');

Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { value: jest.fn(() => false), configurable: true },
    setPointerCapture: { value: jest.fn(), configurable: true },
    releasePointerCapture: { value: jest.fn(), configurable: true },
    scrollIntoView: { value: jest.fn(), configurable: true },
});

jest.mock('../../../modules/admin-logs', () => ({
    useDeleteAdminLogs: jest.fn(),
    useAdminLogsPage: jest.fn(),
}));

import type {
    AdminLogsPageProjection,
    AdminLogsPageQuery,
} from '@/src/modules/admin-logs';
import { useAdminLogsPage, useDeleteAdminLogs } from '@/src/modules/admin-logs';
import { err, ok } from '@/src/shared/application/result';
import AdminLogsHome from '../../../app/admin/logs/AdminLogsHome';

const mockUseAdminLogsPage = useAdminLogsPage as jest.MockedFunction<typeof useAdminLogsPage>;
const mockUseDeleteAdminLogs = useDeleteAdminLogs as jest.MockedFunction<typeof useDeleteAdminLogs>;
const mockDeleteAdminLogs = jest.fn();

const wordItem = {
    id: 11,
    word: '가나',
    state: 'approved' as const,
    requestType: 'add' as const,
    requesterNickname: '신청자',
    processorNickname: null,
    createdAt: '2026-08-29T00:00:00.000Z',
};

const docsItem = {
    id: 21,
    word: '다라',
    documentName: '주제 문서',
    actorNickname: null,
    type: 'delete' as const,
    occurredAt: '2026-08-28T00:00:00.000Z',
};

const projectionFor = (query: AdminLogsPageQuery): AdminLogsPageProjection => (
    query.filter.kind === 'word'
        ? {
            kind: 'word',
            items: [wordItem],
            totalCount: 61,
            page: query.page,
            pageSize: query.pageSize,
        }
        : {
            kind: 'docs',
            items: [docsItem],
            totalCount: 31,
            page: query.page,
            pageSize: query.pageSize,
        }
);

const mockSuccessfulQuery = () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    mockUseAdminLogsPage.mockImplementation((query) => ({
        data: projectionFor(query),
        error: null,
        isFetching: false,
        refetch,
    } as unknown as ReturnType<typeof useAdminLogsPage>));
    return refetch;
};

const renderHome = () => render(<AdminLogsHome allDocs={[
    { id: 31, name: '주제 문서', typez: 'theme' },
    { id: 32, name: '자모 문서', typez: 'letter' },
]} />);

const lastQuery = (): AdminLogsPageQuery => {
    const calls = mockUseAdminLogsPage.mock.calls;
    return calls[calls.length - 1][0];
};

describe('AdminLogsHome', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSuccessfulQuery();
        mockDeleteAdminLogs.mockImplementation(async (command) => ok({
            deletedIds: [...command.ids],
        }));
        mockUseDeleteAdminLogs.mockReturnValue({
            deleteAdminLogs: mockDeleteAdminLogs,
            isPending: false,
        });
    });

    test('keeps direct Supabase and legacy SCM access out of the screen source', () => {
        const source = require('fs').readFileSync(
            require('path').resolve(process.cwd(), 'src/app/admin/logs/AdminLogsHome.tsx'),
            'utf8',
        );
        const forbiddenReadCoupling = [
            /@supabase\/supabase-js/,
            /\bbrowserSupabaseClient\b/,
            /\bcreateBrowserClient\b/,
            /(?<!\bArray)\.from\s*\(/,
            /\.rpc\s*\(/,
            /\bPostgrestError\b/,
            /\bSCM\b/,
            /\blogsByFilter\b/,
            /\bdocsLogsByFilter\b/,
            /\blogsByIds\b/,
            /\bdocsLogsByIds\b/,
            /\balert\s*\(/,
        ];

        for (const forbidden of forbiddenReadCoupling) {
            expect(source).not.toMatch(forbidden);
        }
    });

    test('renders server page items and totalCount with bounded navigation', async () => {
        // Break caught: slicing an initial 1,000-row array locally or enabling navigation outside server bounds.
        const user = userEvent.setup();
        renderHome();

        expect(lastQuery()).toEqual({
            page: 1,
            pageSize: 30,
            filter: { kind: 'word', state: 'all', requestType: 'all' },
        });
        expect(screen.getByText('전체 61개 중 61개 표시 (페이지당 30개)')).toBeInTheDocument();
        expect(screen.getByLabelText('Go to previous page')).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByLabelText('Go to next page')).toHaveAttribute('aria-disabled', 'false');

        await user.click(screen.getByRole('link', { name: '3' }));

        expect(lastQuery().page).toBe(3);
        expect(screen.getByLabelText('Go to previous page')).toHaveAttribute('aria-disabled', 'false');
        expect(screen.getByLabelText('Go to next page')).toHaveAttribute('aria-disabled', 'true');
    });

    test('resets to page one and clears selection after page, word-filter, and tab changes', async () => {
        // Break caught: carrying a selected row or stale page into another server query window.
        const user = userEvent.setup();
        renderHome();
        const rowCheckbox = screen.getByRole('checkbox', { name: '로그 11 선택' });

        await user.click(rowCheckbox);
        expect(rowCheckbox).toBeChecked();
        await user.click(screen.getByRole('link', { name: '2' }));
        await waitFor(() => expect(screen.getByRole('checkbox', { name: '로그 11 선택' })).not.toBeChecked());

        await user.click(screen.getByRole('checkbox', { name: '로그 11 선택' }));
        await user.click(screen.getByLabelText('상태'));
        await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: '승인' }));
        await waitFor(() => expect(lastQuery()).toEqual({
            page: 1,
            pageSize: 30,
            filter: { kind: 'word', state: 'approved', requestType: 'all' },
        }));
        expect(screen.getByRole('checkbox', { name: '로그 11 선택' })).not.toBeChecked();

        await user.click(screen.getByRole('checkbox', { name: '로그 11 선택' }));
        await user.click(screen.getByRole('tab', { name: '문서 로그' }));
        await waitFor(() => expect(lastQuery()).toEqual({
            page: 1,
            pageSize: 30,
            filter: { kind: 'docs', type: 'all' },
        }));
        expect(screen.getByRole('checkbox', { name: '로그 21 선택' })).not.toBeChecked();
    });

    test('converts non-empty date inputs to ISO and requests 150 rows from page one', async () => {
        // Break caught: sending datetime-local text to Application or retaining a later page/date page size.
        const user = userEvent.setup();
        const dateInputValue = '2026-08-29T12:34';
        renderHome();
        await user.click(screen.getByRole('link', { name: '2' }));

        fireEvent.change(screen.getByLabelText('시작 날짜+시간'), {
            target: { value: dateInputValue },
        });

        await waitFor(() => expect(lastQuery()).toEqual({
            page: 1,
            pageSize: 150,
            fromDate: new Date(dateInputValue).toISOString(),
            filter: { kind: 'word', state: 'all', requestType: 'all' },
        }));
        expect(screen.getByText(/날짜 필터가 적용되어 페이지당 150개씩 표시됩니다/)).toBeInTheDocument();
    });

    test('renders only a dismissible stable page-query error and preserves loading feedback', async () => {
        // Break caught: hiding query progress or exposing raw Supabase/PostgREST diagnostics.
        const user = userEvent.setup();
        mockUseAdminLogsPage.mockReturnValue({
            data: undefined,
            error: {
                kind: 'infrastructure',
                message: '관리자 로그를 불러오는 중 오류가 발생했습니다.',
            },
            isFetching: true,
            refetch: jest.fn(),
        } as unknown as ReturnType<typeof useAdminLogsPage>);

        renderHome();

        expect(screen.getByRole('button', { name: /로딩/ })).toBeDisabled();
        expect(screen.getByText('관리자 로그를 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument();
        expect(screen.queryByText(/private database detail|PostgREST|Supabase/)).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByText('관리자 로그를 불러오는 중 오류가 발생했습니다.')).not.toBeInTheDocument();
    });

    test('renders a Modal instead of submitting when no log is selected', async () => {
        // Break caught: using alert or issuing an empty delete command from the screen.
        const user = userEvent.setup();
        renderHome();

        await user.click(screen.getByRole('button', { name: '선택 삭제' }));

        expect(screen.getByText('선택된 로그가 없습니다.')).toBeInTheDocument();
        expect(mockDeleteAdminLogs).not.toHaveBeenCalled();
    });

    test('keeps the word-log selection and renders only the stable Modal on failure', async () => {
        // Break caught: clearing selection on failure or exposing returned private diagnostics.
        const user = userEvent.setup();
        mockDeleteAdminLogs.mockResolvedValue(err({
            kind: 'infrastructure',
            message: 'private PostgREST policy detail',
        }));
        renderHome();
        const rowCheckbox = screen.getByRole('checkbox', { name: '로그 11 선택' });

        await user.click(rowCheckbox);
        await user.click(screen.getByRole('button', { name: '선택 삭제' }));

        await waitFor(() => expect(mockDeleteAdminLogs).toHaveBeenCalledWith({
            kind: 'word',
            ids: [11],
        }));
        expect(rowCheckbox).toBeChecked();
        expect(screen.getByText('선택한 로그를 삭제하는 중 오류가 발생했습니다.')).toBeInTheDocument();
        expect(screen.queryByText(/private|PostgREST/)).not.toBeInTheDocument();
    });

    test('clears the word-log selection only after successful deletion', async () => {
        // Break caught: clearing optimistically before success or directly refetching around the command hook.
        const user = userEvent.setup();
        const refetch = mockSuccessfulQuery();
        renderHome();
        const rowCheckbox = screen.getByRole('checkbox', { name: '로그 11 선택' });

        await user.click(rowCheckbox);
        await user.click(screen.getByRole('button', { name: '선택 삭제' }));

        await waitFor(() => expect(mockDeleteAdminLogs).toHaveBeenCalledWith({
            kind: 'word',
            ids: [11],
        }));
        await waitFor(() => expect(rowCheckbox).not.toBeChecked());
        expect(refetch).not.toHaveBeenCalled();
    });

    test('submits the selected docs-log command and clears it after success', async () => {
        // Break caught: routing the docs tab through the word-log command or retaining committed selection.
        const user = userEvent.setup();
        renderHome();

        await user.click(screen.getByRole('tab', { name: '문서 로그' }));
        const rowCheckbox = await screen.findByRole('checkbox', { name: '로그 21 선택' });
        await user.click(rowCheckbox);
        await user.click(screen.getByRole('button', { name: '선택 삭제' }));

        await waitFor(() => expect(mockDeleteAdminLogs).toHaveBeenCalledWith({
            kind: 'docs',
            ids: [21],
        }));
        await waitFor(() => expect(rowCheckbox).not.toBeChecked());
    });
});

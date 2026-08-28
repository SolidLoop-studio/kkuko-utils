import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';

jest.mock('../../../modules/admin-logs', () => ({
    useAdminLogsInitial: jest.fn(),
}));

jest.mock('../../../app/lib/supabaseClient', () => ({
    SCM: {
        get: () => ({
            logsByFilter: jest.fn().mockResolvedValue({ data: [], error: null }),
            docsLogsByFilter: jest.fn().mockResolvedValue({ data: [], error: null }),
            allDocs: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
    },
}));

jest.mock('../../../app/admin/logs/AdminLogsHome', () => ({
    __esModule: true,
    default: ({ initialWordLogs, initialDocsLogs, allDocs }: {
        initialWordLogs: Array<{
            word: string;
            r_type: string;
            created_at: string;
            make_by_user: { nickname: string } | null;
        }>;
        initialDocsLogs: Array<{
            word: string;
            docs: { name: string } | null;
            users: { nickname: string } | null;
            date: string;
        }>;
        allDocs: Array<{ name: string; typez: string }>;
    }) => (
        <div>
            <span>{initialWordLogs.map((log) => (
                `${log.word}:${log.r_type}:${log.make_by_user?.nickname ?? 'N/A'}:${log.created_at}`
            )).join('|')}</span>
            <span>{initialDocsLogs.map((log) => (
                `${log.word}:${log.docs?.name ?? 'N/A'}:${log.users?.nickname ?? 'N/A'}:${log.date}`
            )).join('|')}</span>
            <span>{allDocs.map((docs) => `${docs.name}:${docs.typez}`).join('|')}</span>
        </div>
    ),
}));

import { useAdminLogsInitial } from '@/src/modules/admin-logs';
import { resetLoadingState, updateLoadingState } from '../../../app/store/slice';
import { store } from '../../../app/store/store';
import AdminLogsWrapper from '../../../app/admin/logs/AdminLogsWrapper';

const mockUseAdminLogsInitial = useAdminLogsInitial as jest.MockedFunction<typeof useAdminLogsInitial>;

const renderWrapper = () => render(
    <Provider store={store}>
        <AdminLogsWrapper />
    </Provider>,
);

describe('AdminLogsWrapper', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        store.dispatch(updateLoadingState({ progress: 100, task: '완료' }));
    });

    test('preserves the existing LoadingPage while the initial query loads', () => {
        // Break caught: rendering the administration screen before all three initial projections arrive.
        store.dispatch(resetLoadingState());
        mockUseAdminLogsInitial.mockReturnValue({
            isLoading: true,
        } as ReturnType<typeof useAdminLogsInitial>);

        renderWrapper();

        expect(screen.getByRole('heading', { name: '문서 요청 목록 로딩 중' })).toBeInTheDocument();
    });

    test('passes the initial projection to AdminLogsHome using its existing prop shape', () => {
        // Break caught: leaking camelCase DTOs into the legacy home or omitting the narrow document choices.
        mockUseAdminLogsInitial.mockReturnValue({
            data: {
                wordLogs: [{
                    id: 11,
                    word: '가나',
                    state: 'approved',
                    requestType: 'add',
                    requesterNickname: '신청자',
                    processorNickname: null,
                    createdAt: '2026-08-29T00:00:00.000Z',
                }],
                docsLogs: [{
                    id: 21,
                    word: '다라',
                    documentName: null,
                    actorNickname: null,
                    type: 'delete',
                    occurredAt: '2026-08-28T00:00:00.000Z',
                }],
                documentChoices: [{ id: 31, name: '주제 문서', type: 'theme' }],
            },
            error: null,
            isLoading: false,
        } as unknown as ReturnType<typeof useAdminLogsInitial>);

        renderWrapper();

        expect(screen.getByText('가나:add:신청자:2026-08-29T00:00:00.000Z')).toBeInTheDocument();
        expect(screen.getByText('다라:N/A:N/A:2026-08-28T00:00:00.000Z')).toBeInTheDocument();
        expect(screen.getByText('주제 문서:theme')).toBeInTheDocument();
    });

    test('renders only the stable public error message on initial query failure', async () => {
        // Break caught: reconstructing or exposing PostgREST diagnostics in the wrapper.
        mockUseAdminLogsInitial.mockReturnValue({
            error: {
                kind: 'infrastructure',
                message: '관리자 로그를 불러오는 중 오류가 발생했습니다.',
            },
            isLoading: false,
        } as ReturnType<typeof useAdminLogsInitial>);

        renderWrapper();

        await waitFor(() => expect(screen.getByText(
            '관리자 로그를 불러오는 중 오류가 발생했습니다.',
        )).toBeInTheDocument());
        expect(screen.queryByText(/ErrorName|private database detail/)).not.toBeInTheDocument();
    });
});

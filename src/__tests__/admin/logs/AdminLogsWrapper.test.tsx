import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';

jest.mock('../../../modules/admin-logs', () => ({
    useAdminLogsInitial: jest.fn(),
}));

jest.mock('../../../app/admin/logs/AdminLogsHome', () => ({
    __esModule: true,
    default: ({ allDocs }: {
        allDocs: Array<{ name: string; typez: string }>;
    }) => (
        <div>
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
        // Break caught: rendering the administration screen before document choices arrive.
        store.dispatch(resetLoadingState());
        mockUseAdminLogsInitial.mockReturnValue({
            isLoading: true,
        } as ReturnType<typeof useAdminLogsInitial>);

        renderWrapper();

        expect(screen.getByRole('status', { name: '문서 요청 목록 로딩 중...' })).toBeInTheDocument();
    });

    test('passes only document choices to AdminLogsHome', () => {
        // Break caught: retaining duplicated initial log rows after the page query owns them.
        mockUseAdminLogsInitial.mockReturnValue({
            data: {
                documentChoices: [{ id: 31, name: '주제 문서', type: 'theme' }],
            },
            error: null,
            isLoading: false,
        } as unknown as ReturnType<typeof useAdminLogsInitial>);

        renderWrapper();

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

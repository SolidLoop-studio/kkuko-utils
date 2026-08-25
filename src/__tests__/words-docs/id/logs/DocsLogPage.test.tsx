import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';

const mockDocsLogs = jest.fn((_props: unknown) => null);

jest.mock('../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn() },
}));

jest.mock('../../../../app/not-found-client', () => ({
    __esModule: true,
    default: () => <h1>페이지를 찾을 수 없습니다</h1>,
}));

jest.mock('../../../../modules/docs', () => ({
    ...jest.requireActual('../../../../modules/docs'),
    useDocsLogs: jest.fn(),
}));

jest.mock('../../../../app/words-docs/[id]/logs/DocsLogs', () => ({
    __esModule: true,
    default: (props: unknown) => mockDocsLogs(props),
}));

import DocsLogPage from '@/src/app/words-docs/[id]/logs/DocsLogPage';
import { resetLoadingState, updateLoadingState } from '@/src/app/store/slice';
import { store } from '@/src/app/store/store';
import { type DocsLogProjection, useDocsLogs } from '@/src/modules/docs';
import type { ApplicationError } from '@/src/shared/application/application-error';

const projection: DocsLogProjection = {
    docsId: 41,
    docsName: '나',
    entries: [{
        id: 9,
        word: '나라',
        userNickname: null,
        occurredAt: '2026-08-25T02:00:00.000Z',
        type: 'add',
    }],
};

const renderPage = () => render(
    <Provider store={store}>
        <DocsLogPage id={41} />
    </Provider>,
);

const setDocsLogsQuery = ({
    data,
    error = null,
    isLoading = false,
}: {
    data?: DocsLogProjection;
    error?: ApplicationError | null;
    isLoading?: boolean;
} = {}) => {
    jest.mocked(useDocsLogs).mockReturnValue({
        data,
        error,
        isLoading,
    } as ReturnType<typeof useDocsLogs>);
};

describe('DocsLogPage docs log query orchestration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        store.dispatch(resetLoadingState());
        store.dispatch(updateLoadingState({ progress: 100, task: '완료' }));
        setDocsLogsQuery({ data: projection });
    });

    it('renders the existing loading title while the docs logs query loads', () => {
        setDocsLogsQuery({ isLoading: true });
        store.dispatch(resetLoadingState());

        renderPage();

        expect(useDocsLogs).toHaveBeenCalledWith(41);
        expect(screen.getByRole('heading', { name: '문서 로그 로딩 중' })).toBeInTheDocument();
    });

    it('renders only the stable docs logs query error message', () => {
        setDocsLogsQuery({
            error: {
                kind: 'infrastructure',
                message: '문서 로그를 불러오는 중 오류가 발생했습니다.',
            },
        });

        renderPage();

        expect(screen.getByText('문서 로그를 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument();
    });

    it('renders the existing not-found page for a missing docs projection', () => {
        setDocsLogsQuery({
            error: {
                kind: 'not-found',
                message: '문서를 찾을 수 없습니다.',
            },
        });

        renderPage();

        expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeInTheDocument();
    });

    it('passes an empty logs array to the existing logs component', () => {
        setDocsLogsQuery({ data: { ...projection, entries: [] } });

        renderPage();

        expect(mockDocsLogs).toHaveBeenCalledWith({ id: 41, name: '나', Logs: [] });
    });

    it('maps nullable nicknames and log timestamps to the existing component props', () => {
        renderPage();

        expect(mockDocsLogs).toHaveBeenCalledWith({
            id: 41,
            name: '나',
            Logs: [{
                id: 9,
                word: '나라',
                user: undefined,
                date: '2026-08-25T02:00:00.000Z',
                type: 'add',
            }],
        });
    });
});

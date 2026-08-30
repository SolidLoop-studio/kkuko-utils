import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';

jest.mock('../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn() },
}));

jest.mock('../../modules/docs', () => ({
    ...jest.requireActual('../../modules/docs'),
    useDocsList: jest.fn(),
}));

import { resetLoadingState, updateLoadingState } from '../../app/store/slice';
import { store } from '../../app/store/store';
import WordsDocsHomePage from '../../app/words-docs/WordsDocsHomePage';
import { type DocsSummary, useDocsList } from '../../modules/docs';
import type { ApplicationError } from '../../shared/application/application-error';

const docsSummary: DocsSummary = {
    id: 31,
    name: '가',
    makerNickname: null,
    lastUpdatedAt: '2026-08-25T01:00:00.000Z',
    createdAt: '2026-08-20T01:00:00.000Z',
    type: 'letter',
};

const renderPage = () => render(
    <Provider store={store}>
        <QueryClientProvider client={new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })}>
            <WordsDocsHomePage />
        </QueryClientProvider>
    </Provider>,
);

const setDocsListQuery = ({
    data,
    error = null,
    isLoading = false,
}: {
    data?: DocsSummary[];
    error?: ApplicationError | null;
    isLoading?: boolean;
} = {}) => {
    jest.mocked(useDocsList).mockReturnValue({
        data,
        error,
        isLoading,
    } as ReturnType<typeof useDocsList>);
};

describe('WordsDocsHomePage docs list query orchestration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        store.dispatch(resetLoadingState());
        store.dispatch(updateLoadingState({ progress: 100, task: '완료' }));
        setDocsListQuery({ data: [docsSummary] });
    });

    it('renders the existing loading title while the docs list query loads', () => {
        setDocsListQuery({ isLoading: true });
        store.dispatch(resetLoadingState());

        renderPage();

        expect(useDocsList).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('heading', { name: '문서 목록 로딩 중' })).toBeInTheDocument();
    });

    it('renders query loading while the Redux startup loading state is already complete', () => {
        setDocsListQuery({ isLoading: true });

        renderPage();

        expect(screen.getByRole('heading', { name: '문서 목록 로딩 중' })).toBeInTheDocument();
        expect(screen.getByText('로딩 중...')).toBeInTheDocument();
    });

    it('renders only the stable list-query error message', () => {
        setDocsListQuery({
            error: {
                kind: 'infrastructure',
                message: '문서 목록을 불러오는 중 오류가 발생했습니다.',
            },
        });

        renderPage();

        expect(screen.getByText('문서 목록을 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument();
    });

    it('preserves cached docs while a background refetch reports an infrastructure error', () => {
        setDocsListQuery({
            data: [docsSummary],
            error: {
                kind: 'infrastructure',
                message: '문서 목록을 불러오는 중 오류가 발생했습니다.',
            },
        });

        renderPage();

        expect(screen.getByRole('link', { name: '가' })).toHaveAttribute('href', '/words-docs/31');
        expect(screen.queryByText('문서 목록을 불러오는 중 오류가 발생했습니다.')).not.toBeInTheDocument();
    });

    it('renders the real child zero-count sections for an empty docs list', () => {
        setDocsListQuery({ data: [] });

        renderPage();

        expect(screen.getByRole('button', { name: '글자 (0)' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '주제 (0)' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '특수 (0)' })).toBeInTheDocument();
    });

    it('maps a docs summary id to the existing child link contract', () => {
        renderPage();

        expect(screen.getByRole('link', { name: '가' })).toHaveAttribute('href', '/words-docs/31');
    });
});

import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';

const mockDocsInfo = jest.fn((_props: unknown) => null);

jest.mock('../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn() },
}));

jest.mock('../../../../app/not-found-client', () => ({
    __esModule: true,
    default: () => <h1>페이지를 찾을 수 없습니다</h1>,
}));

jest.mock('../../../../modules/docs', () => ({
    ...jest.requireActual('../../../../modules/docs'),
    useDocsInfo: jest.fn(),
}));

jest.mock('../../../../app/words-docs/[id]/info/DocsInfo', () => ({
    __esModule: true,
    default: (props: unknown) => mockDocsInfo(props),
}));

import DocsInfoPage from '@/src/app/words-docs/[id]/info/DocsInfoPage';
import { resetLoadingState, updateLoadingState } from '@/src/app/store/slice';
import { store } from '@/src/app/store/store';
import { type DocsInfoProjection, useDocsInfo } from '@/src/modules/docs';
import type { ApplicationError } from '@/src/shared/application/application-error';

const projection: DocsInfoProjection = {
    metadata: {
        id: 51,
        createdAt: '2026-08-01T00:00:00.000Z',
        name: '다',
        makerNickname: null,
        type: 'letter',
        lastUpdatedAt: '2026-08-25T03:00:00.000Z',
        views: 120,
    },
    wordCount: 32,
    starCount: 4,
    viewRank: 2,
};

const renderPage = () => render(
    <Provider store={store}>
        <DocsInfoPage id={51} />
    </Provider>,
);

const setDocsInfoQuery = ({
    data,
    error = null,
    isLoading = false,
}: {
    data?: DocsInfoProjection;
    error?: ApplicationError | null;
    isLoading?: boolean;
} = {}) => {
    jest.mocked(useDocsInfo).mockReturnValue({
        data,
        error,
        isLoading,
    } as ReturnType<typeof useDocsInfo>);
};

describe('DocsInfoPage docs info query orchestration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        store.dispatch(resetLoadingState());
        store.dispatch(updateLoadingState({ progress: 100, task: '완료' }));
        setDocsInfoQuery({ data: projection });
    });

    it('renders the existing loading title while the docs info query loads', () => {
        setDocsInfoQuery({ isLoading: true });

        renderPage();

        expect(useDocsInfo).toHaveBeenCalledWith(51);
        expect(screen.getByRole('heading', { name: '문서 정보 로딩 중' })).toBeInTheDocument();
        expect(screen.getByText('로딩 중...')).toBeInTheDocument();
    });

    it('renders only the stable docs info query error message', () => {
        setDocsInfoQuery({
            error: {
                kind: 'infrastructure',
                message: '문서 정보를 불러오는 중 오류가 발생했습니다.',
            },
        });

        renderPage();

        expect(screen.getByText('문서 정보를 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument();
    });

    it('preserves cached docs info while a background refetch reports an infrastructure error', () => {
        setDocsInfoQuery({
            data: projection,
            error: {
                kind: 'infrastructure',
                message: '문서 정보를 불러오는 중 오류가 발생했습니다.',
            },
        });

        renderPage();

        expect(mockDocsInfo).toHaveBeenCalledWith({
            metaData: {
                id: 51,
                created_at: '2026-08-01T00:00:00.000Z',
                name: '다',
                users: null,
                typez: 'letter',
                last_update: '2026-08-25T03:00:00.000Z',
                views: 120,
            },
            wordsCount: 32,
            starCount: 4,
            docsViewRank: 2,
        });
        expect(screen.queryByText('문서 정보를 불러오는 중 오류가 발생했습니다.')).not.toBeInTheDocument();
    });

    it('preserves cached docs info when a background refetch reports not-found', () => {
        setDocsInfoQuery({
            data: projection,
            error: {
                kind: 'not-found',
                message: '문서를 찾을 수 없습니다.',
            },
        });

        renderPage();

        expect(mockDocsInfo).toHaveBeenCalledWith(expect.objectContaining({
            wordsCount: 32,
            starCount: 4,
            docsViewRank: 2,
        }));
        expect(screen.queryByRole('heading', { name: '페이지를 찾을 수 없습니다' })).not.toBeInTheDocument();
    });

    it('renders the existing not-found page for a missing docs projection', () => {
        setDocsInfoQuery({
            error: {
                kind: 'not-found',
                message: '문서를 찾을 수 없습니다.',
            },
        });

        renderPage();

        expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeInTheDocument();
    });

    it('maps camelCase metadata and nullable maker back to the existing DocsInfo props', () => {
        renderPage();

        expect(mockDocsInfo).toHaveBeenCalledWith({
            metaData: {
                id: 51,
                created_at: '2026-08-01T00:00:00.000Z',
                name: '다',
                users: null,
                typez: 'letter',
                last_update: '2026-08-25T03:00:00.000Z',
                views: 120,
            },
            wordsCount: 32,
            starCount: 4,
            docsViewRank: 2,
        });
    });
});

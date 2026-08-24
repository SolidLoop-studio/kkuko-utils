import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';

type TestComponentProps = React.HTMLAttributes<HTMLElement> & {
    children: React.ReactNode;
};

jest.mock('../../../app/components/ui/card', () => ({
    Card: ({ children, ...props }: TestComponentProps) => <section {...props}>{children}</section>,
    CardContent: ({ children, ...props }: TestComponentProps) => <div {...props}>{children}</div>,
    CardDescription: ({ children, ...props }: TestComponentProps) => <p {...props}>{children}</p>,
    CardFooter: ({ children, ...props }: TestComponentProps) => <footer {...props}>{children}</footer>,
    CardHeader: ({ children, ...props }: TestComponentProps) => <header {...props}>{children}</header>,
    CardTitle: ({ children, ...props }: TestComponentProps) => <div {...props}>{children}</div>,
}));

jest.mock('../../../modules/word-catalog', () => ({
    useWordDownload: jest.fn(),
}));

import WordsDownloadHome from '../../../app/word/words-download/WordsDownloadHome';
import { useWordDownload, type WordDownloadData, type WordDownloadFilter } from '../../../modules/word-catalog';
import { userReducer } from '../../../app/store/slice';

const refetch = jest.fn();

const wordDownloadData = (filter: WordDownloadFilter): WordDownloadData => {
    if (!filter.includeAcknowledged && !filter.includeNotAcknowledged) {
        return {
            words: [],
            stats: {
                totalCount: 0,
                acknowledgedCount: 0,
                notAcknowledgedCount: 0,
                addedCount: 0,
                deletedCount: 0,
                wordChainCount: 0,
                wordNotChainCount: 0,
            },
        };
    }

    if (filter.includeDeleted) {
        return {
            words: ['정상단어'],
            stats: {
                totalCount: 303,
                acknowledgedCount: 303,
                notAcknowledgedCount: 0,
                addedCount: 0,
                deletedCount: 1,
                wordChainCount: 303,
                wordNotChainCount: 0,
            },
        };
    }

    if (filter.includeAdded) {
        return {
            words: ['정상단어', '삭제요청단어', '추가요청단어'],
            stats: {
                totalCount: 202,
                acknowledgedCount: 201,
                notAcknowledgedCount: 0,
                addedCount: 1,
                deletedCount: 0,
                wordChainCount: 201,
                wordNotChainCount: 0,
            },
        };
    }

    return {
        words: ['정상단어', '삭제요청단어'],
        stats: {
            totalCount: 101,
            acknowledgedCount: 101,
            notAcknowledgedCount: 0,
            addedCount: 0,
            deletedCount: 0,
            wordChainCount: 101,
            wordNotChainCount: 0,
        },
    };
};

const setWordDownloadQuery = ({
    error = null,
}: {
    error?: { kind: string; message: string } | null;
} = {}) => {
    jest.mocked(useWordDownload).mockImplementation((filter) => ({
        data: error === null ? wordDownloadData(filter) : undefined,
        error: error ?? (
            !filter.includeAcknowledged && !filter.includeNotAcknowledged
                ? {
                    kind: 'validation',
                    message: '어인정 단어 허용, 노인정 단어 허용 중 최소 하나는 선택해야 합니다.',
                }
                : null
        ),
        isLoading: false,
        refetch,
    }) as never);
};

const renderWithRole = (role: 'guest' | 'r1' | 'r2' | 'r3' | 'r4' | 'admin') => {
    const store = configureStore({
        reducer: {
            user: userReducer,
        },
        preloadedState: {
            user: {
                username: role === 'guest' ? undefined : '테스트 사용자',
                uuid: role === 'guest' ? undefined : 'test-user-id',
                role,
            },
        },
    });

    return render(
        <Provider store={store}>
            <WordsDownloadHome />
        </Provider>,
    );
};

describe('WordsDownloadHome', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setWordDownloadQuery();
    });

    it.each(['guest', 'r1'] as const)(
        'shows the unavailable page to %s without rendering the download UI',
        (role) => {
            jest.mocked(useWordDownload).mockImplementation(() => {
                throw new Error('The download query must remain outside unavailable roles.');
            });

            renderWithRole(role);

            expect(
                screen.getByRole('heading', { name: '오픈 DB 다운로드를 현재 사용할 수 없습니다' }),
            ).toBeInTheDocument();
            expect(screen.queryByText('한국어 오픈 DB 단어 통계')).not.toBeInTheDocument();
        },
    );

    it('explains the eligible roles and contribution requirements', () => {
        renderWithRole('guest');

        const accessDescription = screen.getByText(
            (_, element) =>
                element?.tagName === 'P'
                && element.textContent?.includes('일반 등급 이상인 회원만 이용할 수 있습니다.') === true,
        );
        expect(accessDescription).toHaveTextContent(
            '불편을 드려 죄송합니다. 최대한 빠르게 이용 가능하도록 하겠습니다.',
        );
        expect(screen.getByText('새싹 → 일반')).toBeInTheDocument();
        expect(screen.getByText('누적 기여도 500점')).toBeInTheDocument();
        expect(screen.getByText('일반 → 활동가')).toBeInTheDocument();
        expect(screen.getByText('누적 기여도 3,500점')).toBeInTheDocument();
        expect(screen.getByText('일반 · 활동가 · 베테랑 · 관리자')).toBeInTheDocument();
    });

    it.each(['r2', 'r3', 'r4', 'admin'] as const)(
        'renders the query projection statistics to %s users',
        (role) => {
            renderWithRole(role);

            expect(screen.getByText('한국어 오픈 DB 단어 통계')).toBeInTheDocument();
            expect(screen.getAllByText('101')).not.toHaveLength(0);
            expect(
                screen.queryByRole('heading', { name: '오픈 DB 다운로드를 현재 사용할 수 없습니다' }),
            ).not.toBeInTheDocument();
        },
    );

    it('renders the pending-addition projection when 추가요청 단어 포함 changes', async () => {
        const user = userEvent.setup();
        renderWithRole('r2');

        await user.click(screen.getByLabelText('추가요청 단어 포함'));

        await waitFor(() => expect(screen.getByText('202')).toBeInTheDocument());
        expect(screen.queryByText('101')).not.toBeInTheDocument();
    });

    it('downloads the deletion-request-filtered projection with the existing filename', async () => {
        const user = userEvent.setup();
        const originalBlob = global.Blob;
        const BlobMock = jest.fn();
        Object.defineProperty(global, 'Blob', { configurable: true, value: BlobMock });
        const appendChild = jest.spyOn(document.body, 'appendChild');
        const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        try {
            renderWithRole('r2');
            await user.click(screen.getByLabelText('삭제요청 단어 제거'));
            await waitFor(() => expect(screen.getAllByText('303')).not.toHaveLength(0));
            await user.click(screen.getByRole('button', { name: '텍스트 파일로 다운로드' }));

            expect(BlobMock).toHaveBeenCalledWith(['정상단어'], { type: 'text/plain' });
            const downloadLink = appendChild.mock.calls
                .map(([node]) => node)
                .find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement);
            expect(downloadLink?.download).toBe('끄코_단어목록.txt');
        } finally {
            click.mockRestore();
            appendChild.mockRestore();
            Object.defineProperty(global, 'Blob', { configurable: true, value: originalBlob });
        }
    });

    it('shows a stable message when the query fails', () => {
        setWordDownloadQuery({
            error: { kind: 'infrastructure', message: 'database connection secret' },
        });

        renderWithRole('r2');

        expect(screen.getByText('데이터를 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument();
        expect(screen.queryByText('database connection secret')).not.toBeInTheDocument();
    });

    it('shows the exact validation message when neither word class is selected', async () => {
        const user = userEvent.setup();
        renderWithRole('r2');

        await user.click(screen.getByLabelText('어인정 단어 허용'));

        expect(
            screen.getByText('어인정 단어 허용, 노인정 단어 허용 중 최소 하나는 선택해야 합니다.'),
        ).toBeInTheDocument();
    });
});

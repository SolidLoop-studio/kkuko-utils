import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import WordsDownloadHome from '../../../app/word/words-download/WordsDownloadHome';
import { userReducer } from '../../../app/store/slice';

const mockAllWords = jest.fn().mockResolvedValue({ data: [], error: null });

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

jest.mock('../../../app/lib/supabaseClient', () => ({
    SCM: {
        get: () => ({
            allWords: mockAllWords,
        }),
    },
}));

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

describe('WordsDownloadHome access control', () => {
    beforeEach(() => {
        mockAllWords.mockClear();
        mockAllWords.mockReturnValue(new Promise(() => {}));
    });

    it('shows the unavailable page to guests without loading word data', () => {
        renderWithRole('guest');

        expect(
            screen.getByRole('heading', { name: '오픈 DB 다운로드를 현재 사용할 수 없습니다' }),
        ).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: '한국어 오픈 DB 단어 통계' })).not.toBeInTheDocument();
        expect(mockAllWords).not.toHaveBeenCalled();
    });

    it('shows the unavailable page to r1 users without loading word data', () => {
        renderWithRole('r1');

        expect(
            screen.getByRole('heading', { name: '오픈 DB 다운로드를 현재 사용할 수 없습니다' }),
        ).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: '한국어 오픈 DB 단어 통계' })).not.toBeInTheDocument();
        expect(mockAllWords).not.toHaveBeenCalled();
    });

    it('explains the eligible roles and contribution requirements', () => {
        renderWithRole('guest');

        const accessDescription = screen.getByText(
            (_, element) =>
                element?.tagName === 'P' &&
                element.textContent?.includes('일반 등급 이상인 회원만 이용할 수 있습니다.') === true,
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
        'shows the existing download page to %s users',
        (role) => {
            renderWithRole(role);

            expect(screen.getByText('한국어 오픈 DB 단어 통계')).toBeInTheDocument();
            expect(
                screen.queryByRole('heading', { name: '오픈 DB 다운로드를 현재 사용할 수 없습니다' }),
            ).not.toBeInTheDocument();
            expect(mockAllWords).toHaveBeenCalled();
        },
    );
});

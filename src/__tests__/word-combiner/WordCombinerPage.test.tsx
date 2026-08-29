import { Provider } from 'react-redux';
import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('../../modules/word-catalog', () => ({
    useWordCombinerCandidates: jest.fn(),
}));

import { useWordCombinerCandidates } from '../../modules/word-catalog';
import { store } from '@/src/app/store/store';
import WordCombinerPage from '@/src/app/word-combiner/WordCombinerPage';

const renderPage = () => render(
    <Provider store={store}>
        <WordCombinerPage />
    </Provider>,
);

const mockQuery = (value: {
    data?: { word: string }[];
    error?: { kind: 'infrastructure'; message: string } | null;
    isLoading: boolean;
}) => {
    jest.mocked(useWordCombinerCandidates).mockReturnValue(value as ReturnType<typeof useWordCombinerCandidates>);
};

describe('WordCombinerPage', () => {
    test('renders the word-data loading state while candidates are pending', () => {
        mockQuery({ isLoading: true });

        renderPage();

        expect(screen.getByRole('heading', { name: '단어 데이터 로딩 중' })).toBeInTheDocument();
    });

    test('renders a safe query error without leaking infrastructure details', () => {
        mockQuery({
            isLoading: false,
            error: {
                kind: 'infrastructure',
                message: '단어 조합기 데이터를 불러오는 중 오류가 발생했습니다.',
            },
        });

        renderPage();

        expect(screen.getByText('단어 조합기 데이터를 불러오는 중 오류가 발생했습니다.'))
            .toBeInTheDocument();
        expect(screen.queryByText(/PostgREST|private/i)).not.toBeInTheDocument();
    });

    test('renders an operable combiner with empty 5/6-character lists', () => {
        mockQuery({ isLoading: false, data: [], error: null });

        renderPage();

        expect(screen.getByRole('heading', { name: '글자조각 조합기' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: '만들어진 5글자 단어', level: 3 }))
            .toBeInTheDocument();
        expect(screen.getByRole('heading', { name: '만들어진 6글자 단어', level: 3 }))
            .toBeInTheDocument();
    });

    test('uses only candidate words and splits them into the existing 5/6-character inputs', () => {
        jest.useFakeTimers();
        mockQuery({
            isLoading: false,
            data: [{ word: '가나다라마' }, { word: '바사아자차카' }],
            error: null,
        });
        renderPage();

        fireEvent.change(screen.getByPlaceholderText('일반 글자조각 입력'), {
            target: { value: '가나다라마바사아자차카' },
        });
        const combineButton = screen.getAllByRole('button', { name: '조합하기' })
            .find((button) => !button.hasAttribute('disabled'));
        expect(combineButton).toBeDefined();
        fireEvent.click(combineButton!);
        act(() => jest.runAllTimers());

        expect(screen.getByText('가나다라마')).toBeInTheDocument();
        expect(screen.getByText('바사아자차카')).toBeInTheDocument();
        jest.useRealTimers();
    });
});

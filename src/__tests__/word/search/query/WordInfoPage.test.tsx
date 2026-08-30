import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import WordInfoPage from '../../../../app/word/search/[query]/WordInfoPage';
import type { WordInfoProps } from '../../../../app/word/search/[query]/WordInfo';
import {
    type WordDetail,
    useRandomConnectedWord,
    useWordDetail,
} from '../../../../modules/word-catalog';
import type { ApplicationError } from '../../../../shared/application/application-error';

const mockPush = jest.fn();
const mockNotFound = jest.fn(() => 'not-found');
const mockAxiosGet = jest.fn();
const mockWordInfoRender = jest.fn();

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    notFound: () => mockNotFound(),
}));

jest.mock('axios', () => ({
    __esModule: true,
    default: { get: (...args: unknown[]) => mockAxiosGet(...args) },
}));

jest.mock('../../../../modules/word-catalog', () => ({
    useWordDetail: jest.fn(),
    useRandomConnectedWord: jest.fn(),
}));

jest.mock('../../../../app/components/LoadingPage', () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => <div>loading:{title}</div>,
}));

jest.mock('../../../../app/components/ErrorPage', () => ({
    __esModule: true,
    default: ({ message }: { message: string }) => <div role="alert">{message}</div>,
}));

jest.mock('../../../../app/word/search/[query]/WordInfo', () => ({
    __esModule: true,
    default: ({ wordInfo }: { wordInfo: WordInfoProps }) => {
        mockWordInfoRender(wordInfo);
        return (
            <section aria-label="word detail">
                <div data-testid="word">{wordInfo.word}</div>
                <div data-testid="initial">{wordInfo.initial}</div>
                <div data-testid="length">{wordInfo.length}</div>
                <div data-testid="status">{wordInfo.status}</div>
                <div data-testid="chainable">{String(wordInfo.isChainable)}</div>
                <div data-testid="senior-approved">{String(wordInfo.isSeniorApproved)}</div>
                <div data-testid="database-id">{wordInfo.dbId}</div>
                <div data-testid="mission">{JSON.stringify(wordInfo.missionLetter)}</div>
                <div data-testid="themes">{JSON.stringify(wordInfo.topic)}</div>
                <div data-testid="documents">{JSON.stringify(wordInfo.documents)}</div>
                <div data-testid="counts">
                    {wordInfo.goFirstLetterWords},{wordInfo.goLastLetterWords}
                </div>
                <div data-testid="requester">
                    {wordInfo.requester_uuid}|{wordInfo.requester}|{wordInfo.requestTime}
                </div>
                <div data-testid="connection-pending">{String(wordInfo.isConnectionLoading)}</div>
                <div data-testid="explanation">{wordInfo.moreExplanation as ReactNode}</div>
                <button onClick={() => void wordInfo.goFirstLetterWord(['라', '나'])}>previous</button>
                <button onClick={() => void wordInfo.goLastLetterWord(['다'])}>next</button>
                <button onClick={wordInfo.reloadWordInfo}>reload</button>
            </section>
        );
    },
}));

const refetch = jest.fn();
const mutateAsync = jest.fn();

const detailFixture: WordDetail = {
    id: 42,
    word: '가나다가',
    status: 'registered',
    canUseInChain: false,
    canUseWithoutInjeong: true,
    requesterId: 'requester-id',
    requesterNickname: '요청자',
    requestedAt: '2026-08-24T01:02:03.000Z',
    themes: {
        approved: ['동물'],
        pendingAddition: ['식물'],
        pendingDeletion: ['지명'],
    },
    documents: [
        { id: 7, name: '가' },
        { id: 9, name: '동물' },
    ],
    previousWordCount: 4,
    nextWordCount: 7,
};

const setDetailQuery = ({
    data,
    error = null,
    isPending = false,
}: {
    data?: WordDetail;
    error?: ApplicationError | null;
    isPending?: boolean;
}) => {
    jest.mocked(useWordDetail).mockReturnValue({
        data,
        error,
        isPending,
        refetch,
    } as never);
};

const setRandomMutation = ({
    error = null,
    isPending = false,
}: {
    error?: ApplicationError | null;
    isPending?: boolean;
} = {}) => {
    jest.mocked(useRandomConnectedWord).mockReturnValue({
        mutateAsync,
        error,
        isPending,
    } as never);
};

beforeEach(() => {
    jest.clearAllMocks();
    setDetailQuery({ data: detailFixture });
    setRandomMutation();
    mockAxiosGet.mockRejectedValue(new Error('wiki unavailable'));
    mutateAsync.mockResolvedValue('연결단어');
    refetch.mockResolvedValue(undefined);
});

describe('WordInfoPage query orchestration', () => {
    it('renders the loading page while the detail query is pending', () => {
        setDetailQuery({ isPending: true });

        render(<WordInfoPage query="가나다가" />);

        expect(screen.getByText('loading:단어 정보')).toBeInTheDocument();
    });

    it('delegates not-found query errors to the route not-found boundary', () => {
        setDetailQuery({
            error: { kind: 'not-found', message: '단어 정보를 찾을 수 없습니다.' },
        });

        render(<WordInfoPage query="없는단어" />);

        expect(mockNotFound).toHaveBeenCalledTimes(1);
        expect(screen.getByText('not-found')).toBeInTheDocument();
    });

    it('renders the stable detail-query error message', () => {
        setDetailQuery({
            error: { kind: 'infrastructure', message: '단어 검색 중 오류가 발생했습니다.' },
        });

        render(<WordInfoPage query="가나다가" />);

        expect(screen.getByRole('alert')).toHaveTextContent('단어 검색 중 오류가 발생했습니다.');
    });

    it.each([
        ['registered', 'ok'],
        ['pending-addition', '추가요청'],
        ['pending-deletion', '삭제요청'],
    ] as const)('maps the %s projection status to %s', (status, expectedStatus) => {
        setDetailQuery({ data: { ...detailFixture, status } });

        render(<WordInfoPage query="가나다가" />);

        expect(screen.getByTestId('status')).toHaveTextContent(expectedStatus);
    });

    it('maps the complete detail projection to the existing WordInfo contract', () => {
        render(<WordInfoPage query="가나다가" />);

        expect(screen.getByTestId('word')).toHaveTextContent('가나다가');
        expect(screen.getByTestId('initial')).toHaveTextContent('ㄱㄴㄷㄱ');
        expect(screen.getByTestId('length')).toHaveTextContent('4');
        expect(screen.getByTestId('chainable')).toHaveTextContent('false');
        expect(screen.getByTestId('senior-approved')).toHaveTextContent('true');
        expect(screen.getByTestId('database-id')).toHaveTextContent('42');
        expect(screen.getByTestId('mission')).toHaveTextContent('[[' + '"가",2],["나",1],["다",1]]');
        expect(screen.getByTestId('themes')).toHaveTextContent(
            JSON.stringify({ ok: ['동물'], waitAdd: ['식물'], waitDel: ['지명'] }),
        );
        expect(screen.getByTestId('documents')).toHaveTextContent(
            JSON.stringify([{ doc_id: 7, doc_name: '가' }, { doc_id: 9, doc_name: '동물' }]),
        );
        expect(screen.getByTestId('counts')).toHaveTextContent('4,7');
        expect(screen.getByTestId('requester')).toHaveTextContent(
            'requester-id|요청자|2026-08-24T01:02:03.000Z',
        );
        expect(screen.getByTestId('connection-pending')).toHaveTextContent('false');
    });

    it('refetches the detail projection when WordInfo requests a reload', () => {
        render(<WordInfoPage query="가나다가" />);

        fireEvent.click(screen.getByRole('button', { name: 'reload' }));

        expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('adds the KkukoWiki link only after an approved projection returns HTTP 200', async () => {
        mockAxiosGet.mockResolvedValue({ status: 200 });

        render(<WordInfoPage query="가나다가" />);

        const link = await screen.findByRole('link', { name: '해당 단어가 끄코위키에 있습니다.' });
        expect(link).toHaveAttribute('href', 'https://kkukowiki.kr/w/가나다가');
        expect(mockAxiosGet).toHaveBeenCalledWith('/api/get_kkukowiki?title=가나다가');
    });

    it('never renders a previous KkukoWiki link during word or approval-status transitions', async () => {
        mockAxiosGet.mockResolvedValue({ status: 200 });
        const view = render(<WordInfoPage query="가나다가" />);
        await screen.findByRole('link', { name: '해당 단어가 끄코위키에 있습니다.' });

        const nextApprovedDetail = { ...detailFixture, word: '나비' };
        mockWordInfoRender.mockClear();
        setDetailQuery({ data: nextApprovedDetail });
        view.rerender(<WordInfoPage query="나비" />);

        const firstWordTransition = mockWordInfoRender.mock.calls[0][0] as WordInfoProps;
        expect(firstWordTransition.moreExplanation).toBeUndefined();
        await waitFor(() => expect(screen.getByRole('link')).toHaveAttribute(
            'href',
            'https://kkukowiki.kr/w/나비',
        ));

        mockWordInfoRender.mockClear();
        setDetailQuery({
            data: { ...nextApprovedDetail, status: 'pending-addition' },
        });
        view.rerender(<WordInfoPage query="나비" />);

        const firstStatusTransition = mockWordInfoRender.mock.calls[0][0] as WordInfoProps;
        expect(firstStatusTransition.moreExplanation).toBeUndefined();
    });

    it('ignores failed KkukoWiki checks without replacing the word detail', async () => {
        render(<WordInfoPage query="가나다가" />);

        await waitFor(() => expect(mockAxiosGet).toHaveBeenCalledTimes(1));
        expect(screen.getByRole('region', { name: 'word detail' })).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('does not check or apply KkukoWiki to a pending-addition projection', () => {
        setDetailQuery({ data: { ...detailFixture, status: 'pending-addition' } });

        render(<WordInfoPage query="가나다가" />);

        expect(mockAxiosGet).not.toHaveBeenCalled();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('passes both navigation directions and candidate arrays to the random query', async () => {
        mutateAsync
            .mockResolvedValueOnce('앞단어')
            .mockResolvedValueOnce('뒷단어');
        render(<WordInfoPage query="가나다가" />);

        fireEvent.click(screen.getByRole('button', { name: 'previous' }));
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/word/search/앞단어'));
        fireEvent.click(screen.getByRole('button', { name: 'next' }));
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/word/search/뒷단어'));

        expect(mutateAsync.mock.calls).toEqual([
            [{ direction: 'previous', letters: ['라', '나'] }],
            [{ direction: 'next', letters: ['다'] }],
        ]);
    });

    it('returns to the current projected word when random navigation has no result', async () => {
        mutateAsync.mockResolvedValue(null);
        render(<WordInfoPage query="다른검색어" />);

        fireEvent.click(screen.getByRole('button', { name: 'next' }));

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/word/search/가나다가'));
    });

    it('catches random lookup rejection and renders its stable application error', async () => {
        const randomError: ApplicationError = {
            kind: 'infrastructure',
            message: '단어 검색 중 오류가 발생했습니다.',
        };
        mutateAsync.mockRejectedValue(randomError);
        const view = render(<WordInfoPage query="가나다가" />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'previous' }));
        });
        setRandomMutation({ error: randomError });
        view.rerender(<WordInfoPage query="가나다가" />);

        expect(screen.getByRole('alert')).toHaveTextContent('단어 검색 중 오류가 발생했습니다.');
    });

    it('passes the random query pending state to WordInfo', () => {
        setRandomMutation({ isPending: true });

        render(<WordInfoPage query="가나다가" />);

        expect(screen.getByTestId('connection-pending')).toHaveTextContent('true');
    });
});

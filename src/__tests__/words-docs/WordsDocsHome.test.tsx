import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSelector } from 'react-redux';

import WordsDocsHome from '../../app/words-docs/WordsDocsHome';
import { usePendingDocsRequests } from '../../modules/docs';

const legacyLetterDocs = jest.fn();
const legacyWaitDocs = jest.fn();

jest.mock('react-redux', () => ({ useSelector: jest.fn() }));
jest.mock('../../modules/docs', () => ({ usePendingDocsRequests: jest.fn() }));
jest.mock('../../app/lib/supabaseClient', () => ({
    SCM: {
        get: () => ({
            letterDocs: legacyLetterDocs,
        }),
        add: () => ({ waitDocs: legacyWaitDocs }),
    },
}));

const mockUsePendingDocsRequests = usePendingDocsRequests as jest.MockedFunction<typeof usePendingDocsRequests>;

const openAndSubmitRequest = async () => {
    const user = userEvent.setup();
    render(<WordsDocsHome docs={[]} />);

    await user.click(screen.getByRole('button', { name: '새 문서 추가 요청' }));
    await user.type(screen.getByPlaceholderText('가'), '가');
    await user.click(screen.getByRole('button', { name: '문서 추가 요청' }));
};

describe('WordsDocsHome docs request duplicate check', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(useSelector).mockImplementation((selector) => selector({
            user: { uuid: 'user-7', role: 'r1' },
        } as never));
        legacyLetterDocs.mockResolvedValue({ data: [], error: null });
        legacyWaitDocs.mockResolvedValue({ error: null });
    });

    it('checks refreshed pending requests before submitting a duplicate docs request', async () => {
        const refetch = jest.fn().mockResolvedValue({
            data: [{
                id: 7,
                requestedAt: '2026-08-25T00:00:00.000Z',
                docsName: '가',
                requesterNickname: '요청자',
                requesterId: 'user-7',
            }],
            error: null,
        });
        mockUsePendingDocsRequests.mockReturnValue({
            data: [],
            error: null,
            refetch,
        } as unknown as ReturnType<typeof usePendingDocsRequests>);

        await openAndSubmitRequest();

        await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
        expect(await screen.findByText('이미 추가 요청된 문서명입니다.')).toBeInTheDocument();
        expect(legacyWaitDocs).not.toHaveBeenCalled();
    });

    it('shows the stable pending-request query error message when refresh fails', async () => {
        const refetch = jest.fn().mockResolvedValue({
            data: undefined,
            error: {
                kind: 'infrastructure',
                message: '문서 요청 목록을 불러오는 중 오류가 발생했습니다.',
            },
        });
        mockUsePendingDocsRequests.mockReturnValue({
            data: [],
            error: null,
            refetch,
        } as unknown as ReturnType<typeof usePendingDocsRequests>);

        await openAndSubmitRequest();

        expect(await screen.findByText('문서 요청 목록을 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument();
    });
});

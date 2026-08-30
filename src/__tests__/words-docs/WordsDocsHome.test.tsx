import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSelector } from 'react-redux';

import WordsDocsHome from '../../app/words-docs/WordsDocsHome';
import {
    useDocsCreationRequest,
    useLetterDocsDuplicate,
    usePendingDocsRequests,
} from '../../modules/docs';
import { err, ok } from '../../shared/application/result';

jest.mock('react-redux', () => ({ useSelector: jest.fn() }));
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('../../modules/docs', () => ({
    usePendingDocsRequests: jest.fn(),
    useLetterDocsDuplicate: jest.fn(),
    useDocsCreationRequest: jest.fn(),
}));

const mockUsePendingDocsRequests = jest.mocked(usePendingDocsRequests);
const mockUseLetterDocsDuplicate = jest.mocked(useLetterDocsDuplicate);
const mockUseDocsCreationRequest = jest.mocked(useDocsCreationRequest);

const refetchLetterDocsDuplicate = jest.fn();
const refetchPendingDocsRequests = jest.fn();
const requestDocsCreation = jest.fn();

const openRequestModal = async () => {
    const user = userEvent.setup();
    render(<WordsDocsHome docs={[]} />);
    await user.click(screen.getByRole('button', { name: '새 문서 추가 요청' }));
    return user;
};

const openAndSubmitRequest = async () => {
    const user = await openRequestModal();
    await user.type(screen.getByPlaceholderText('가'), '가');
    await user.click(screen.getByRole('button', { name: '문서 추가 요청' }));
};

describe('WordsDocsHome docs creation request orchestration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(useSelector).mockImplementation((selector) => selector({
            user: { uuid: 'user-7', role: 'r1' },
        } as never));
        refetchLetterDocsDuplicate.mockResolvedValue({
            data: false,
            error: null,
        });
        refetchPendingDocsRequests.mockResolvedValue({
            data: [],
            error: null,
        });
        requestDocsCreation.mockResolvedValue(ok(undefined));
        mockUseLetterDocsDuplicate.mockReturnValue({
            refetch: refetchLetterDocsDuplicate,
        } as unknown as ReturnType<typeof useLetterDocsDuplicate>);
        mockUsePendingDocsRequests.mockReturnValue({
            data: [],
            error: null,
            refetch: refetchPendingDocsRequests,
        } as unknown as ReturnType<typeof usePendingDocsRequests>);
        mockUseDocsCreationRequest.mockReturnValue({
            request: requestDocsCreation,
            isPending: false,
            error: null,
            clearError: jest.fn(),
        });
    });

    it('checks refreshed pending requests after the letter duplicate query', async () => {
        refetchPendingDocsRequests.mockResolvedValue({
            data: [{
                id: 7,
                requestedAt: '2026-08-25T00:00:00.000Z',
                docsName: '가',
                requesterNickname: '요청자',
                requesterId: 'user-7',
            }],
            error: null,
        });

        await openAndSubmitRequest();

        expect(await screen.findByText('이미 추가 요청된 문서명입니다.'))
            .toBeInTheDocument();
        expect(refetchLetterDocsDuplicate).toHaveBeenCalledTimes(1);
        expect(refetchPendingDocsRequests).toHaveBeenCalledTimes(1);
        expect(refetchLetterDocsDuplicate.mock.invocationCallOrder[0])
            .toBeLessThan(refetchPendingDocsRequests.mock.invocationCallOrder[0]);
        expect(requestDocsCreation).not.toHaveBeenCalled();
    });

    it('shows the stable pending-request query error message when refresh fails', async () => {
        refetchPendingDocsRequests.mockResolvedValue({
            data: undefined,
            error: {
                kind: 'infrastructure',
                message: 'private pending query detail',
            },
        });

        await openAndSubmitRequest();

        expect(await screen.findByText('문서 요청 목록을 불러오는 중 오류가 발생했습니다.'))
            .toBeInTheDocument();
        expect(screen.queryByText('private pending query detail')).not.toBeInTheDocument();
        expect(requestDocsCreation).not.toHaveBeenCalled();
    });

    it('shows the existing-docs duplicate message without calling the command', async () => {
        refetchLetterDocsDuplicate.mockResolvedValue({
            data: true,
            error: null,
        });

        await openAndSubmitRequest();

        expect(await screen.findByText('이미 존재하는 문서명입니다.'))
            .toBeInTheDocument();
        expect(refetchPendingDocsRequests).toHaveBeenCalledTimes(1);
        expect(requestDocsCreation).not.toHaveBeenCalled();
    });

    it('shows the stable request failure message when the duplicate query fails', async () => {
        refetchLetterDocsDuplicate.mockResolvedValue({
            data: undefined,
            error: {
                kind: 'infrastructure',
                message: 'private duplicate query detail',
            },
        });

        await openAndSubmitRequest();

        expect(await screen.findByText('문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.'))
            .toBeInTheDocument();
        expect(screen.queryByText('private duplicate query detail')).not.toBeInTheDocument();
        expect(refetchPendingDocsRequests).toHaveBeenCalledTimes(1);
        expect(requestDocsCreation).not.toHaveBeenCalled();
    });

    it('submits the command, closes the request modal, and opens the completion modal', async () => {
        await openAndSubmitRequest();

        await waitFor(() => expect(requestDocsCreation).toHaveBeenCalledWith({
            docsName: '가',
            requesterId: 'user-7',
        }));
        expect(screen.queryByPlaceholderText('가')).not.toBeInTheDocument();
        expect(await screen.findByText('작업이 완료되었습니다!')).toBeInTheDocument();
    });

    it('shows only the stable command error message without raw message or details', async () => {
        requestDocsCreation.mockResolvedValue(err({
            kind: 'infrastructure',
            message: '문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
            cause: {
                message: 'private raw message',
                details: 'private raw details',
            },
        }));

        await openAndSubmitRequest();

        expect(await screen.findByText('문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.'))
            .toBeInTheDocument();
        expect(screen.queryByText(/private raw message/)).not.toBeInTheDocument();
        expect(screen.queryByText(/private raw details/)).not.toBeInTheDocument();
        expect(screen.queryByText('작업이 완료되었습니다!')).not.toBeInTheDocument();
    });

    it('opens the login-required modal without running either query or the command', async () => {
        jest.mocked(useSelector).mockImplementation((selector) => selector({
            user: { uuid: undefined, role: 'r1' },
        } as never));

        const user = userEvent.setup();
        render(<WordsDocsHome docs={[]} />);
        await user.click(screen.getByRole('button', { name: '새 문서 추가 요청' }));

        expect(await screen.findByText('로그인이 필요합니다')).toBeInTheDocument();
        expect(refetchLetterDocsDuplicate).not.toHaveBeenCalled();
        expect(refetchPendingDocsRequests).not.toHaveBeenCalled();
        expect(requestDocsCreation).not.toHaveBeenCalled();
    });
});

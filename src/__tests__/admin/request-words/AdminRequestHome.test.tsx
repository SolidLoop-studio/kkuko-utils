import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.unmock('../../../app/components/ui/badge');
jest.unmock('../../../app/components/ui/button');
jest.unmock('../../../app/components/ui/card');
jest.unmock('../../../app/components/ui/checkbox');
jest.unmock('../../../app/components/ErrModal');

jest.mock('../../../modules/word-moderation', () => ({
    useWordRequestModeration: jest.fn(),
}));

import { useWordRequestModeration } from '../../../modules/word-moderation';
import type { ApplicationError } from '../../../shared/application/application-error';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:9';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

let AdminRequestHome: typeof import('../../../app/admin/request-words/AdminRequestHome').default;

const mockUseWordRequestModeration = jest.mocked(useWordRequestModeration);
const mockApprove = jest.fn();
const mockReject = jest.fn();
const mockClearError = jest.fn();

const successfulResult = {
    ok: true as const,
    value: {
        processedWordRequestCount: 1,
        processedThemeChangeCount: 0,
        affectedDocsIds: [],
    },
};

const addRequest = {
    id: 11,
    word: '나비',
    request_type: 'add' as const,
    requested_at: 'unknown',
    requested_by: '신청자',
};

const themeChangeRequest = {
    id: 22,
    word: '사과',
    request_type: 'theme_change' as const,
    requested_at: 'unknown',
    requested_by: '신청자',
    word_id: 102,
    wait_themes: [
        { theme_id: 201, theme_name: '식물', theme_code: 'plant', typez: 'add' as const },
        { theme_id: 202, theme_name: '동물', theme_code: 'animal', typez: 'delete' as const },
    ],
};

const createDeferred = <T,>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });

    return { promise, resolve };
};

const renderHome = (
    requests = [addRequest, themeChangeRequest],
    refreshFn = jest.fn().mockResolvedValue(undefined),
) => {
    render(<AdminRequestHome requestData={requests} refreshFn={refreshFn} />);

    return { refreshFn };
};

describe('AdminRequestHome', () => {
    beforeAll(async () => {
        ({ default: AdminRequestHome } = await import('../../../app/admin/request-words/AdminRequestHome'));
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockApprove.mockResolvedValue(successfulResult);
        mockReject.mockResolvedValue(successfulResult);
        mockUseWordRequestModeration.mockReturnValue({
            approve: mockApprove,
            reject: mockReject,
            isPending: false,
            error: null,
            clearError: mockClearError,
        });
    });

    it('선택 없이 승인하면 오류 모달을 열고 action을 호출하지 않는다', async () => {
        const user = userEvent.setup();
        renderHome();

        await user.click(screen.getByRole('button', { name: '선택 승인' }));

        expect(mockClearError).toHaveBeenCalledTimes(1);
        expect(mockApprove).not.toHaveBeenCalled();
        expect(screen.getByText('선택된 요청이 없습니다.')).toBeInTheDocument();
    });

    it('추가 요청을 identifier command로 승인하고 성공 후 선택을 지운 다음 새로고침한다', async () => {
        const user = userEvent.setup();
        const refreshDeferred = createDeferred<void>();
        const refreshFn = jest.fn().mockReturnValue(refreshDeferred.promise);
        renderHome([addRequest], refreshFn);

        const rowSelection = screen.getByRole('checkbox', { name: '나비 선택' });
        await user.click(rowSelection);
        await user.click(screen.getByRole('button', { name: '선택 승인' }));

        expect(mockApprove).toHaveBeenCalledWith({
            selections: [{ kind: 'word-request', requestId: 11, selectedThemeIds: [] }],
        });
        await waitFor(() => expect(rowSelection).not.toBeChecked());
        expect(refreshFn).toHaveBeenCalledTimes(1);

        refreshDeferred.resolve();
    });

    it('주제 변경 승인은 선택한 변경만 보내고 type은 wait_themes에서 결정한다', async () => {
        const user = userEvent.setup();
        renderHome([themeChangeRequest]);

        await user.click(screen.getByLabelText(/동물/));
        await user.click(screen.getByRole('button', { name: '선택 승인' }));

        expect(mockApprove).toHaveBeenCalledWith({
            selections: [{
                kind: 'theme-change',
                wordId: 102,
                changes: [{ themeId: 202, type: 'delete' }],
            }],
        });
    });

    it('혼합 선택을 동일한 identifier command로 반려한다', async () => {
        const user = userEvent.setup();
        renderHome();

        await user.click(screen.getByRole('checkbox', { name: '나비 선택' }));
        await user.click(screen.getByLabelText(/식물/));
        await user.click(screen.getByRole('button', { name: '선택 반려' }));

        expect(mockReject).toHaveBeenCalledWith({
            selections: [
                { kind: 'word-request', requestId: 11, selectedThemeIds: [] },
                {
                    kind: 'theme-change',
                    wordId: 102,
                    changes: [{ themeId: 201, type: 'add' }],
                },
            ],
        });
    });

    it.each<{
        error: ApplicationError;
        publicMessage: string;
        privateMessage?: string;
    }>([
        {
            error: { kind: 'validation', message: '주제를 하나 이상 선택해 주세요.' },
            publicMessage: '주제를 하나 이상 선택해 주세요.',
        },
        {
            error: { kind: 'conflict', message: 'duplicate request version' },
            publicMessage: '요청 목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요.',
            privateMessage: 'duplicate request version',
        },
        {
            error: { kind: 'unauthorized', message: 'missing session token' },
            publicMessage: '로그인이 필요합니다.',
            privateMessage: 'missing session token',
        },
        {
            error: { kind: 'forbidden', message: 'role mismatch: guest' },
            publicMessage: '관리자 권한이 필요합니다.',
            privateMessage: 'role mismatch: guest',
        },
        {
            error: { kind: 'infrastructure', message: 'duplicate key value violates constraint' },
            publicMessage: '요청 단어 처리 중 오류가 발생했습니다.',
            privateMessage: 'duplicate key value violates constraint',
        },
    ])('$error.kind 실패는 선택을 유지하고 안전한 메시지만 보여준다', async ({ error, publicMessage, privateMessage }) => {
        const user = userEvent.setup();
        mockApprove.mockResolvedValue({ ok: false, error });
        const { refreshFn } = renderHome([addRequest]);

        const rowSelection = screen.getByRole('checkbox', { name: '나비 선택' });
        await user.click(rowSelection);
        await user.click(screen.getByRole('button', { name: '선택 승인' }));

        await waitFor(() => expect(screen.getByText(publicMessage)).toBeInTheDocument());
        expect(rowSelection).toBeChecked();
        expect(refreshFn).not.toHaveBeenCalled();
        if (privateMessage) {
            expect(screen.queryByText(privateMessage)).not.toBeInTheDocument();
        }
    });

    it('처리 중에는 승인과 반려를 모두 비활성화하여 중복 제출을 막는다', async () => {
        const user = userEvent.setup();
        mockUseWordRequestModeration.mockReturnValue({
            approve: mockApprove,
            reject: mockReject,
            isPending: true,
            error: null,
            clearError: mockClearError,
        });
        renderHome([addRequest]);

        const approveButton = screen.getByRole('button', { name: '선택 승인' });
        const rejectButton = screen.getByRole('button', { name: '선택 반려' });
        expect(approveButton).toBeDisabled();
        expect(rejectButton).toBeDisabled();

        await user.click(approveButton);
        await user.click(rejectButton);
        expect(mockApprove).not.toHaveBeenCalled();
        expect(mockReject).not.toHaveBeenCalled();
    });

    it('성공 후 refreshFn이 실패해도 mutation을 다시 호출하지 않고 안전한 오류를 보여준다', async () => {
        const user = userEvent.setup();
        const refreshFn = jest.fn().mockRejectedValue(new Error('private refresh detail'));
        renderHome([addRequest], refreshFn);

        const rowSelection = screen.getByRole('checkbox', { name: '나비 선택' });
        await user.click(rowSelection);
        await user.click(screen.getByRole('button', { name: '선택 승인' }));

        await waitFor(() => {
            expect(screen.getByText('요청 목록을 새로고침하는 중 오류가 발생했습니다.')).toBeInTheDocument();
        });
        expect(rowSelection).not.toBeChecked();
        expect(mockApprove).toHaveBeenCalledTimes(1);
        expect(refreshFn).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('private refresh detail')).not.toBeInTheDocument();
    });
});

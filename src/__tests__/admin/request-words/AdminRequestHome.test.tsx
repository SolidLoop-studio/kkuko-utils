import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

jest.unmock('../../../app/components/ui/badge');
jest.unmock('../../../app/components/ui/button');
jest.unmock('../../../app/components/ui/card');
jest.unmock('../../../app/components/ui/checkbox');
jest.unmock('../../../app/components/ErrModal');

jest.mock('../../../modules/word-moderation', () => ({
    useWordRequestModeration: jest.fn(),
}));

import {
    useWordRequestModeration,
    type ModerateWordRequestsCommand,
} from '../../../modules/word-moderation';
import type { ApplicationError } from '../../../shared/application/application-error';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:9';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

let AdminRequestHome: typeof import('../../../app/admin/request-words/AdminRequestHome').default;
type AdminRequest = Parameters<typeof AdminRequestHome>[0]['requestData'][number];

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

const malformedThemeChangeRequest = {
    id: 23,
    word: '손상단어',
    request_type: 'theme_change' as const,
    requested_at: 'unknown',
    requested_by: '신청자',
    wait_themes: [
        { theme_id: 203, theme_name: '잘못된 주제', theme_code: 'broken' },
    ],
} satisfies AdminRequest;

const createDeferred = <T,>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });

    return { promise, resolve };
};

const renderHome = (
    requests: AdminRequest[] = [addRequest, themeChangeRequest],
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

    it.each([
        { actionName: '승인', buttonName: '선택 승인', action: 'approve' as const },
        { actionName: '반려', buttonName: '선택 반려', action: 'reject' as const },
    ])('$actionName은 선택된 주제가 없는 주제 변경을 빈 changes로 전달하고 validation 실패 시 선택을 유지한다', async ({ buttonName, action }) => {
        const user = userEvent.setup();
        const validationResult = {
            ok: false as const,
            error: { kind: 'validation' as const, message: '주제 변경을 하나 이상 선택해 주세요.' },
        };
        const actionMock = action === 'approve' ? mockApprove : mockReject;
        actionMock.mockResolvedValue(validationResult);
        const { refreshFn } = renderHome([themeChangeRequest]);

        const rowSelection = screen.getByRole('checkbox', { name: '사과 선택' });
        await user.click(rowSelection);
        await user.click(screen.getByRole('button', { name: buttonName }));

        expect(actionMock).toHaveBeenCalledWith({
            selections: [{ kind: 'theme-change', wordId: 102, changes: [] }],
        });
        await waitFor(() => {
            expect(screen.getByText('주제 변경을 하나 이상 선택해 주세요.')).toBeInTheDocument();
        });
        expect(rowSelection).toBeChecked();
        expect(refreshFn).not.toHaveBeenCalled();
    });

    it('누락된 word_id와 typez를 가진 선택도 생략하지 않고 Domain 검증 경계로 전달한다', async () => {
        const user = userEvent.setup();
        mockApprove.mockResolvedValue({
            ok: false,
            error: { kind: 'validation', message: '단어 ID는 안전한 양의 정수여야 합니다.' },
        });
        const { refreshFn } = renderHome([malformedThemeChangeRequest]);

        const rowSelection = screen.getByRole('checkbox', { name: '손상단어 선택' });
        await user.click(screen.getByLabelText(/잘못된 주제/));
        await user.click(screen.getByRole('button', { name: '선택 승인' }));

        expect(mockApprove).toHaveBeenCalledWith({
            selections: [{
                kind: 'theme-change',
                wordId: Number.NaN,
                changes: [{ themeId: 203, type: '' }],
            }],
        });
        await waitFor(() => {
            expect(screen.getByText('단어 ID는 안전한 양의 정수여야 합니다.')).toBeInTheDocument();
        });
        expect(rowSelection).toBeChecked();
        expect(refreshFn).not.toHaveBeenCalled();
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

    it('첫 제출이 pending으로 전환되면 두 action을 비활성화하고 두 번째 제출을 막는다', async () => {
        const user = userEvent.setup();
        const actionDeferred = createDeferred<typeof successfulResult>();
        const pendingApprove = jest.fn();
        const refreshFn = jest.fn().mockResolvedValue(undefined);

        function useTransitioningModeration() {
            const [isPending, setIsPending] = useState(false);

            return {
                approve: async (command: ModerateWordRequestsCommand) => {
                    pendingApprove(command);
                    setIsPending(true);
                    const result = await actionDeferred.promise;
                    setIsPending(false);
                    return result;
                },
                reject: mockReject,
                isPending,
                error: null,
                clearError: mockClearError,
            };
        }

        mockUseWordRequestModeration.mockImplementation(useTransitioningModeration);
        renderHome([addRequest], refreshFn);

        const approveButton = screen.getByRole('button', { name: '선택 승인' });
        const rejectButton = screen.getByRole('button', { name: '선택 반려' });
        expect(approveButton).toBeEnabled();
        expect(rejectButton).toBeEnabled();

        await user.click(screen.getByRole('checkbox', { name: '나비 선택' }));
        await user.click(approveButton);
        await waitFor(() => {
            expect(approveButton).toBeDisabled();
            expect(rejectButton).toBeDisabled();
        });

        await user.click(rejectButton);
        await user.click(approveButton);
        expect(pendingApprove).toHaveBeenCalledTimes(1);
        expect(mockReject).not.toHaveBeenCalled();

        await act(async () => actionDeferred.resolve(successfulResult));
        await waitFor(() => expect(refreshFn).toHaveBeenCalledTimes(1));
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

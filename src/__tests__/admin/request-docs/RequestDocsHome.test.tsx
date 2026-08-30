import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

jest.unmock('../../../app/components/ui/card');
jest.unmock('../../../app/components/ui/button');
jest.unmock('../../../app/components/ui/checkbox');
jest.unmock('../../../app/components/ui/table');
jest.unmock('../../../app/components/ui/pagination');
jest.unmock('../../../app/components/ErrModal');

jest.mock('../../../modules/docs', () => ({
    useDocsRequestModeration: jest.fn(),
}));

import { useDocsRequestModeration } from '../../../modules/docs';
import DocsWaitManager from '../../../app/admin/request-docs/RequestDocsHome';

const mockUseDocsRequestModeration = useDocsRequestModeration as jest.MockedFunction<typeof useDocsRequestModeration>;
const mockApprove = jest.fn();
const mockReject = jest.fn();
const mockClearError = jest.fn();

const successfulResult = {
    ok: true as const,
    value: {
        processedRequestIds: [11],
        processedRequestCount: 1,
    },
};

const requests = [
    {
        id: 11,
        req_at: '2026-08-22T00:00:00.000Z',
        docs_name: '가',
        req_by: '신청자 A',
        initial_consonant: false,
        req_byId: '00000000-0000-0000-0000-000000000011',
    },
    {
        id: 22,
        req_at: '2026-08-22T00:01:00.000Z',
        docs_name: '나',
        req_by: '신청자 B',
        initial_consonant: false,
        req_byId: null,
    },
];

const createDeferred = <T,>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });

    return { promise, resolve };
};

const mockModerationHook = (isPending = false) => {
    mockUseDocsRequestModeration.mockReturnValue({
        approve: mockApprove,
        reject: mockReject,
        isPending,
        error: null,
        clearError: mockClearError,
    });
};

describe('DocsWaitManager docs request moderation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockModerationHook();
        mockApprove.mockResolvedValue(successfulResult);
        mockReject.mockResolvedValue(successfulResult);
    });

    const renderManager = () => render(<DocsWaitManager initialData={requests} />);

    it('선택이 없거나 요청 처리 중이면 두 작업 버튼을 비활성화한다', () => {
        const { rerender } = renderManager();

        expect(screen.getByRole('button', { name: '선택 승인' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '선택 거절' })).toBeDisabled();

        mockModerationHook(true);
        rerender(<DocsWaitManager initialData={requests} />);

        expect(screen.getByRole('button', { name: '선택 승인' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '선택 거절' })).toBeDisabled();
    });

    it('선택한 요청과 두음 설정으로 승인 명령을 보내고 처리된 ID만 정리한다', async () => {
        const user = userEvent.setup();
        renderManager();

        await user.click(screen.getByRole('checkbox', { name: '가 선택' }));
        await user.click(screen.getByRole('checkbox', { name: '나 선택' }));
        await user.click(document.getElementById('initial-consonant-11')!);
        await user.click(document.getElementById('initial-consonant-22')!);
        await user.click(screen.getByRole('button', { name: '선택 승인' }));

        expect(mockApprove).toHaveBeenCalledWith({
            selections: [
                { requestId: 11, duem: true },
                { requestId: 22, duem: true },
            ],
        });
        await waitFor(() => expect(screen.queryByText('가', { selector: 'td' })).not.toBeInTheDocument());
        expect(screen.getByText('나', { selector: 'td' })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: '나 선택' })).toBeChecked();
        expect(document.getElementById('initial-consonant-22')).toBeChecked();
    });

    it('선택한 요청으로 반려 명령을 보낸다', async () => {
        const user = userEvent.setup();
        mockReject.mockResolvedValue({
            ok: true,
            value: {
                processedRequestIds: [22],
                processedRequestCount: 1,
            },
        });
        renderManager();

        await user.click(screen.getByRole('checkbox', { name: '나 선택' }));
        await user.click(screen.getByRole('button', { name: '선택 거절' }));

        expect(mockReject).toHaveBeenCalledWith({ requestIds: [22] });
        await waitFor(() => expect(screen.queryByText('나', { selector: 'td' })).not.toBeInTheDocument());
    });

    it('변경된 요청 목록을 반영하면서 남은 요청의 선택과 두음 설정을 보존한다', async () => {
        const user = userEvent.setup();
        const { rerender } = renderManager();

        await user.click(screen.getByRole('checkbox', { name: '나 선택' }));
        await user.click(document.getElementById('initial-consonant-22')!);
        rerender(<DocsWaitManager initialData={[
            requests[1],
            {
                id: 33,
                req_at: '2026-08-22T00:02:00.000Z',
                docs_name: '다',
                req_by: '신청자 C',
                initial_consonant: false,
                req_byId: null,
            },
        ]} />);

        await waitFor(() => expect(screen.queryByText('가', { selector: 'td' })).not.toBeInTheDocument());
        expect(screen.getByText('다', { selector: 'td' })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: '나 선택' })).toBeChecked();
        expect(document.getElementById('initial-consonant-22')).toBeChecked();
    });

    it('처리 중에는 중복 제출을 막는다', async () => {
        const user = userEvent.setup();
        const pendingApprove = createDeferred<typeof successfulResult>();
        mockApprove.mockReturnValue(pendingApprove.promise);
        const { rerender } = renderManager();

        await user.click(screen.getByRole('checkbox', { name: '가 선택' }));
        await user.click(screen.getByRole('button', { name: '선택 승인' }));

        mockModerationHook(true);
        rerender(<DocsWaitManager initialData={requests} />);

        const approveButton = screen.getByRole('button', { name: '선택 승인' });
        const rejectButton = screen.getByRole('button', { name: '선택 거절' });
        expect(approveButton).toBeDisabled();
        expect(rejectButton).toBeDisabled();
        await user.click(approveButton);
        await user.click(rejectButton);
        expect(mockApprove).toHaveBeenCalledTimes(1);
        expect(mockReject).not.toHaveBeenCalled();

        await act(async () => {
            pendingApprove.resolve(successfulResult);
        });
    });

    it.each([
        ['validation', '입력값이 올바르지 않습니다.'],
        ['conflict', '요청 목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요.'],
        ['unauthorized', '로그인이 필요합니다.'],
        ['forbidden', '관리자 권한이 필요합니다.'],
        ['infrastructure', '문서 요청 처리 중 오류가 발생했습니다.'],
    ] as const)('%s 오류는 안전한 메시지를 표시하고 상태를 보존한다', async (kind, publicMessage) => {
        const user = userEvent.setup();
        const privateMessage = `${kind} private message`;
        mockApprove.mockResolvedValue({
            ok: false,
            error: {
                kind,
                message: kind === 'validation' ? publicMessage : privateMessage,
            },
        });
        renderManager();

        const selection = screen.getByRole('checkbox', { name: '가 선택' });
        await user.click(selection);
        await user.click(screen.getByRole('button', { name: '선택 승인' }));

        expect(await screen.findByText(publicMessage)).toBeInTheDocument();
        if (kind !== 'validation') {
            expect(screen.queryByText(privateMessage)).not.toBeInTheDocument();
        }
        expect(selection).toBeChecked();
        expect(screen.getByText('가', { selector: 'td' })).toBeInTheDocument();
    });
});

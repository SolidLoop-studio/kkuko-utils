import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import WordApprovalPanel, {
    type WordApprovalPanelProps,
} from '../../../app/admin/add-words/WordApprovalPanel';

const idleState: WordApprovalPanelProps['approvalState'] = {
    pendingJobs: [],
    progress: null,
    isProcessing: false,
    error: null,
};

const uploadJson = async (value: unknown) => {
    const user = userEvent.setup();
    const input = screen.getByLabelText(/클릭하여 파일 업로드/) as HTMLInputElement;
    const file = new File([JSON.stringify(value)], 'words.json', {
        type: 'application/json',
    });

    await user.upload(input, file);
    return user;
};

describe('WordApprovalPanel', () => {
    it('유효한 JSON 파일의 entries를 승인 command로 전달한다', async () => {
        const onStart = jest.fn().mockResolvedValue(undefined);
        render(
            <WordApprovalPanel
                onStart={onStart}
                onResume={jest.fn()}
                onCancel={jest.fn()}
                approvalState={idleState}
            />,
        );

        const user = await uploadJson({ 나비: ['10', '20'] });
        expect(await screen.findByText(/나비/)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: '처리 시작' }));

        expect(onStart).toHaveBeenCalledWith([
            { word: '나비', themeCodes: ['10', '20'] },
        ]);
    });

    it('중단된 작업을 표시하고 정확한 operation ID로 재개하거나 취소한다', async () => {
        const user = userEvent.setup();
        const onResume = jest.fn().mockResolvedValue(undefined);
        const onCancel = jest.fn().mockResolvedValue(undefined);
        render(
            <WordApprovalPanel
                onStart={jest.fn()}
                onResume={onResume}
                onCancel={onCancel}
                approvalState={{
                    ...idleState,
                    pendingJobs: [{
                        operationId: 'operation-1',
                        inputHash: 'input-hash',
                        entries: [{
                            word: '나비',
                            themeCodes: ['10'],
                            noinCanUse: true,
                        }],
                        batchSize: 50,
                        createdAt: '2026-08-20T00:00:00.000Z',
                    }],
                }}
            />,
        );

        expect(screen.getByText('중단된 작업')).toBeInTheDocument();
        expect(screen.getByText(/operation-1/)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: '작업 재개' }));
        expect(onResume).toHaveBeenCalledWith('operation-1');

        await user.click(screen.getByRole('button', { name: '작업 취소' }));
        expect(onCancel).toHaveBeenCalledWith('operation-1');
    });

    it('진행 단계와 단어 및 배치 처리 수를 표시한다', () => {
        render(
            <WordApprovalPanel
                onStart={jest.fn()}
                onResume={jest.fn()}
                onCancel={jest.fn()}
                approvalState={{
                    ...idleState,
                    isProcessing: true,
                    progress: {
                        stage: 'applying',
                        completedEntries: 25,
                        totalEntries: 100,
                        completedBatches: 2,
                        totalBatches: 8,
                    },
                }}
            />,
        );

        expect(screen.getByText('승인 적용 중')).toBeInTheDocument();
        expect(screen.getByText('단어 25/100')).toBeInTheDocument();
        expect(screen.getByText('배치 2/8')).toBeInTheDocument();
        expect(screen.getByText('25% 완료')).toBeInTheDocument();
    });

    it('완료 progress를 기존 완료 안내로 표시한다', () => {
        render(
            <WordApprovalPanel
                onStart={jest.fn()}
                onResume={jest.fn()}
                onCancel={jest.fn()}
                approvalState={{
                    ...idleState,
                    progress: {
                        stage: 'completed',
                        completedEntries: 2,
                        totalEntries: 2,
                        completedBatches: 1,
                        totalBatches: 1,
                    },
                }}
            />,
        );

        expect(screen.getByText('처리가 완료되었습니다!')).toBeInTheDocument();
        expect(screen.getByText('100% 완료')).toBeInTheDocument();
    });

    it('처리 요청이 끝나기 전 중복 시작을 막는다', async () => {
        let finishStart: (() => void) | undefined;
        const onStart = jest.fn(() => new Promise<void>((resolve) => {
            finishStart = resolve;
        }));
        render(
            <WordApprovalPanel
                onStart={onStart}
                onResume={jest.fn()}
                onCancel={jest.fn()}
                approvalState={idleState}
            />,
        );

        const user = await uploadJson({ 나비: ['10'] });
        const startButton = screen.getByRole('button', { name: '처리 시작' });
        const firstClick = user.click(startButton);

        await waitFor(() => expect(startButton).toBeDisabled());
        fireEvent.click(startButton);
        expect(onStart).toHaveBeenCalledTimes(1);

        finishStart?.();
        await firstClick;
    });

    it('잘못된 JSON을 안정된 ErrorModal 메시지로 표시한다', async () => {
        const user = userEvent.setup();
        render(
            <WordApprovalPanel
                onStart={jest.fn()}
                onResume={jest.fn()}
                onCancel={jest.fn()}
                approvalState={idleState}
            />,
        );
        const input = screen.getByLabelText(/클릭하여 파일 업로드/) as HTMLInputElement;

        await user.upload(
            input,
            new File(['{"나비": ["10"], SQL relation'], 'broken.json', {
                type: 'application/json',
            }),
        );

        expect(await screen.findByText('JSON 파일 파싱 중 오류가 발생했거나 형식이 올바르지 않습니다.')).toBeInTheDocument();
        expect(screen.queryByText(/SQL relation/i)).not.toBeInTheDocument();
    });

    it('application 오류를 ErrorModal용 안정된 정보로 표시한다', () => {
        render(
            <WordApprovalPanel
                onStart={jest.fn()}
                onResume={jest.fn()}
                onCancel={jest.fn()}
                approvalState={{
                    ...idleState,
                    error: {
                        kind: 'forbidden',
                        message: 'relation words SQL stack denied',
                    },
                }}
            />,
        );

        expect(screen.getByText('관리자 권한이 필요합니다.')).toBeInTheDocument();
        expect(screen.queryByText(/relation|SQL stack/i)).not.toBeInTheDocument();
    });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import WordDeletionPanel, {
    type WordDeletionPanelProps,
} from '../../../app/admin/del-words/WordDeletionPanel';

const idleDeletion: WordDeletionPanelProps['deletion'] = {
    start: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    cancel: jest.fn().mockResolvedValue(undefined),
    clearError: jest.fn(),
    pendingJobs: [],
    progress: null,
    result: null,
    error: null,
    isPending: false,
};

const uploadText = async (content: string, fileName = 'words.txt') => {
    const user = userEvent.setup();
    const input = screen.getByLabelText(/클릭하여 파일 업로드/) as HTMLInputElement;
    await user.upload(input, new File([content], fileName, { type: 'text/plain' }));
    return user;
};

describe('WordDeletionPanel', () => {
    it('파일의 원본 줄을 한번만 삭제 hook command로 전달한다', async () => {
        const start = jest.fn().mockResolvedValue(undefined);
        render(<WordDeletionPanel deletion={{ ...idleDeletion, start }} />);

        const user = await uploadText('하늘\r\n\n가방\n하늘');
        expect(await screen.findByText('파일 미리보기')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: '파일 처리' }));

        expect(start).toHaveBeenCalledTimes(1);
        expect(start).toHaveBeenCalledWith([
            { word: '하늘\r' },
            { word: '' },
            { word: '가방' },
            { word: '하늘' },
        ]);
    });

    it('파일 전에는 처리 버튼이 비활성화되고 지원 파일명과 미리보기를 표시한다', async () => {
        render(<WordDeletionPanel deletion={idleDeletion} />);
        expect(screen.getByRole('button', { name: '파일 처리' })).toBeDisabled();

        await uploadText('가방', 'delete-list.txt');
        expect(await screen.findByText('delete-list.txt 선택됨')).toBeInTheDocument();
        expect(screen.getByDisplayValue('가방')).toBeInTheDocument();
    });

    it('드래그한 파일의 이름과 1000자 제한 미리보기를 표시한다', async () => {
        render(<WordDeletionPanel deletion={idleDeletion} />);
        const content = '가'.repeat(1001);
        const dropZone = screen.getByLabelText('파일 업로드 영역');
        fireEvent.drop(dropZone, {
            dataTransfer: { files: [new File([content], 'dragged.txt', { type: 'text/plain' })] },
        });

        expect(await screen.findByText('dragged.txt 선택됨')).toBeInTheDocument();
        expect(await screen.findByDisplayValue(`${'가'.repeat(1000)}...`)).toBeInTheDocument();
    });

    it('새 파일을 선택하면 이전 완료 결과와 오류를 숨긴다', async () => {
        const clearError = jest.fn();
        render(
            <WordDeletionPanel
                deletion={{
                    ...idleDeletion,
                    clearError,
                    result: {
                        operationId: 'completed-operation',
                        deletedWordCount: 1,
                        protectedWordCount: 0,
                        missingWordCount: 0,
                        processedRequestCount: 0,
                        affectedDocsIds: [],
                    },
                }}
            />,
        );

        expect(screen.getByText('삭제된 단어: 1개')).toBeInTheDocument();
        await uploadText('새 단어');

        expect(screen.queryByText('삭제된 단어: 1개')).not.toBeInTheDocument();
        expect(clearError).toHaveBeenCalled();
    });

    it('진행률과 완료 결과의 삭제·보호·누락·처리 요청 수를 표시한다', () => {
        render(
            <WordDeletionPanel
                deletion={{
                    ...idleDeletion,
                    progress: {
                        stage: 'completed',
                        completedEntries: 3,
                        totalEntries: 4,
                        completedBatches: 1,
                        totalBatches: 2,
                    },
                    result: {
                        operationId: 'operation-1',
                        deletedWordCount: 2,
                        protectedWordCount: 1,
                        missingWordCount: 1,
                        processedRequestCount: 2,
                        affectedDocsIds: [],
                    },
                }}
            />,
        );

        expect(screen.getAllByText('처리 완료!')).not.toHaveLength(0);
        expect(screen.getByText('단어 3/4')).toBeInTheDocument();
        expect(screen.getByText('75% 완료')).toBeInTheDocument();
        expect(screen.getByText('삭제된 단어: 2개')).toBeInTheDocument();
        expect(screen.getByText('보호된 단어: 1개')).toBeInTheDocument();
        expect(screen.getByText('없는 단어: 1개')).toBeInTheDocument();
        expect(screen.getByText('처리된 요청: 2개')).toBeInTheDocument();
    });

    it('application 오류를 내부 정보 없는 안정된 Modal 메시지로 표시하고 닫는다', async () => {
        const clearError = jest.fn();
        const user = userEvent.setup();
        render(
            <WordDeletionPanel
                deletion={{
                    ...idleDeletion,
                    clearError,
                    error: {
                        kind: 'infrastructure',
                        message: 'relation words SQL stack failed',
                    },
                }}
            />,
        );

        expect(screen.getByText('단어 삭제 작업 처리 중 오류가 발생했습니다.')).toBeInTheDocument();
        expect(screen.queryByText(/relation|SQL stack/i)).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Close' }));
        await waitFor(() => expect(clearError).toHaveBeenCalledTimes(1));
    });

    it('저장된 작업의 ID와 생성 시간을 표시하고 재개와 취소를 각각 한번만 요청한다', async () => {
        const resume = jest.fn().mockResolvedValue(undefined);
        const cancel = jest.fn().mockResolvedValue(undefined);
        const user = userEvent.setup();
        render(
            <WordDeletionPanel
                deletion={{
                    ...idleDeletion,
                    resume,
                    cancel,
                    pendingJobs: [{
                        operationId: 'operation-1',
                        inputHash: 'input-hash',
                        entries: [{ word: '가방' }],
                        batchSize: 50,
                        createdAt: '2026-08-21T00:00:00.000Z',
                    }],
                }}
            />,
        );

        expect(screen.getByText('중단된 작업')).toBeInTheDocument();
        expect(screen.getByText(/operation-1/)).toBeInTheDocument();
        expect(screen.getByText(/2026-08-21T00:00:00.000Z/)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'operation-1 작업 재개' }));
        await user.click(screen.getByRole('button', { name: 'operation-1 작업 취소' }));
        expect(resume).toHaveBeenCalledTimes(1);
        expect(resume).toHaveBeenCalledWith('operation-1');
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(cancel).toHaveBeenCalledWith('operation-1');
    });

    it('처리 중에는 중복 시작과 진행 Modal 닫기를 막고 완료 후에는 닫을 수 있다', async () => {
        const user = userEvent.setup();
        let resolveStart: (() => void) | undefined;
        const start = jest.fn(() => new Promise<void>((resolve) => {
            resolveStart = resolve;
        }));
        const { rerender } = render(<WordDeletionPanel deletion={{ ...idleDeletion, start }} />);
        await uploadText('가방');
        await user.click(screen.getByRole('button', { name: '파일 처리' }));
        const startButton = screen.getByTestId('button');
        expect(startButton).toBeDisabled();
        fireEvent.click(startButton);
        expect(start).toHaveBeenCalledTimes(1);
        resolveStart?.();
        await waitFor(() => expect(startButton).not.toBeDisabled());

        rerender(
            <WordDeletionPanel
                deletion={{
                    ...idleDeletion,
                    progress: {
                        stage: 'completed',
                        completedEntries: 1,
                        totalEntries: 1,
                        completedBatches: 1,
                        totalBatches: 1,
                    },
                    result: {
                        operationId: 'operation-1',
                        deletedWordCount: 1,
                        protectedWordCount: 0,
                        missingWordCount: 0,
                        processedRequestCount: 0,
                        affectedDocsIds: [],
                    },
                }}
            />,
        );
        await user.click(screen.getByRole('button', { name: '확인' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('source boundary does not reference SCM or Supabase query APIs', () => {
        const source = require('fs').readFileSync(
            require('path').resolve(process.cwd(), 'src/app/admin/del-words/WordDeletionPanel.tsx'),
            'utf8',
        );
        for (const forbidden of ['SCM', '@supabase/supabase-js', '.rpc(', '.from(']) {
            expect(source).not.toContain(forbidden);
        }
    });
});

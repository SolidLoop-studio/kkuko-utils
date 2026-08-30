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

    it('application 오류를 내부 정보 없는 접근 가능한 Modal로 표시하고 focus를 가둔다', async () => {
        const clearError = jest.fn();
        const user = userEvent.setup();
        const { rerender } = render(
            <WordDeletionPanel deletion={{ ...idleDeletion, clearError }} />,
        );
        const fileInput = screen.getByLabelText(/클릭하여 파일 업로드/) as HTMLInputElement;

        rerender(
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

        const dialog = await screen.findByRole('dialog', { name: '삭제 작업 오류' });
        expect(dialog).toHaveTextContent('단어 삭제 작업 처리 중 오류가 발생했습니다.');
        expect(screen.queryByText(/relation|SQL stack/i)).not.toBeInTheDocument();
        await waitFor(() =>
            expect(dialog).toContainElement(document.activeElement as HTMLElement),
        );
        await user.tab();
        expect(dialog).toContainElement(document.activeElement as HTMLElement);
        await user.tab();
        expect(dialog).toContainElement(document.activeElement as HTMLElement);
        expect(fileInput.closest('[aria-hidden="true"]')).not.toBeNull();
        expect(screen.queryByRole('button', { name: '파일 처리' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: '확인' }));
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

    it('활성 작업은 Escape, 바깥 클릭, 파일 교체로 진행 Modal을 닫지 않는다', async () => {
        const user = userEvent.setup();
        let resolveStart: (() => void) | undefined;
        const start = jest.fn(() => new Promise<void>((resolve) => {
            resolveStart = resolve;
        }));
        render(<WordDeletionPanel deletion={{ ...idleDeletion, start }} />);

        await uploadText('가방', 'original.txt');
        await user.click(screen.getByRole('button', { name: '파일 처리' }));
        expect(start).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('alertdialog', { name: '처리 진행 중' })).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });
        fireEvent.pointerDown(document.querySelector('[data-state="open"][aria-hidden="true"]') as Element);
        fireEvent.change(screen.getByLabelText(/클릭하여 파일 업로드/, { selector: 'input' }), {
            target: { files: [new File(['새 단어'], 'replacement.txt', { type: 'text/plain' })] },
        });
        fireEvent.drop(screen.getByLabelText('파일 업로드 영역'), {
            dataTransfer: { files: [new File(['또 다른 단어'], 'dropped.txt', { type: 'text/plain' })] },
        });

        expect(screen.getByRole('alertdialog', { name: '처리 진행 중' })).toBeInTheDocument();
        expect(start).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('replacement.txt 선택됨')).not.toBeInTheDocument();
        expect(screen.queryByText('dropped.txt 선택됨')).not.toBeInTheDocument();

        resolveStart?.();
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    });

    it('지연된 시작 실패 오류를 닫으면 처리 시작 control로 focus를 복원한다', async () => {
        const user = userEvent.setup();
        let rejectStart: ((reason?: unknown) => void) | undefined;
        const start = jest.fn(() => new Promise<void>((_resolve, reject) => {
            rejectStart = reject;
        }).catch(() => undefined));
        const clearError = jest.fn();
        const { rerender } = render(
            <WordDeletionPanel deletion={{ ...idleDeletion, start, clearError }} />,
        );

        await uploadText('가방');
        const processButton = screen.getByRole('button', { name: '파일 처리' });
        await user.click(processButton);
        const progressDialog = screen.getByRole('alertdialog', { name: '처리 진행 중' });
        progressDialog.focus();
        expect(progressDialog).toHaveFocus();

        rejectStart?.(new Error('delayed start failure'));
        rerender(
            <WordDeletionPanel
                deletion={{
                    ...idleDeletion,
                    start,
                    clearError,
                    error: { kind: 'infrastructure', message: 'delayed start failure' },
                }}
            />,
        );

        await screen.findByRole('dialog', { name: '삭제 작업 오류' });
        await user.click(screen.getByRole('button', { name: '확인' }));
        await waitFor(() => expect(processButton).toHaveFocus());
    });

    it('파일 읽기 오류를 닫으면 keyboard-focusable 업로드 control로 focus를 복원한다', async () => {
        const user = userEvent.setup();
        const readAsText = jest.spyOn(FileReader.prototype, 'readAsText').mockImplementation(
            function readAsTextWithFailure(this: FileReader) {
                this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
            },
        );

        try {
            render(<WordDeletionPanel deletion={idleDeletion} />);
            const uploadControl = screen.getByRole('button', { name: '파일 업로드 영역' });
            uploadControl.focus();
            expect(uploadControl).toHaveFocus();

            fireEvent.drop(uploadControl, {
                dataTransfer: { files: [new File(['가방'], 'broken.txt', { type: 'text/plain' })] },
            });
            await screen.findByRole('dialog', { name: '파일 읽기 오류' });

            await user.click(screen.getByRole('button', { name: '확인' }));
            await waitFor(() => expect(uploadControl).toHaveFocus());
        } finally {
            readAsText.mockRestore();
        }
    });

    it('숨겨진 file input click 버블링이 업로드 picker를 다시 열지 않는다', () => {
        render(<WordDeletionPanel deletion={idleDeletion} />);
        const fileInput = screen.getByLabelText(/클릭하여 파일 업로드/) as HTMLInputElement;
        const click = jest.spyOn(fileInput, 'click').mockImplementation();

        fireEvent.click(fileInput);

        expect(click).not.toHaveBeenCalled();
        click.mockRestore();
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

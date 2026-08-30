import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import WordApprovalPanel, {
    type WordApprovalPanelProps,
} from '../../../app/admin/add-words/WordApprovalPanel';

const idleState: WordApprovalPanelProps['approvalState'] = {
    pendingJobs: [],
    isPendingJobsLoading: false,
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

    it('중단된 작업별 접근 가능한 이름으로 정확한 operation ID를 재개하거나 취소한다', async () => {
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
                    pendingJobs: [
                        {
                            operationId: 'operation-1',
                            inputHash: 'input-hash-1',
                            entries: [{
                                word: '나비',
                                themeCodes: ['10'],
                                noinCanUse: true,
                            }],
                            batchSize: 50,
                            createdAt: '2026-08-20T00:00:00.000Z',
                        },
                        {
                            operationId: 'operation-2',
                            inputHash: 'input-hash-2',
                            entries: [{
                                word: '가방',
                                themeCodes: ['20'],
                                noinCanUse: true,
                            }],
                            batchSize: 50,
                            createdAt: '2026-08-20T01:00:00.000Z',
                        },
                    ],
                }}
            />,
        );

        expect(screen.getByText('중단된 작업')).toBeInTheDocument();
        expect(screen.getByText(/operation-1/)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'operation-1 작업 재개' }));
        expect(onResume).toHaveBeenCalledWith('operation-1');

        await user.click(screen.getByRole('button', { name: 'operation-2 작업 취소' }));
        expect(onCancel).toHaveBeenCalledWith('operation-2');
    });

    it('pending 작업을 조회하는 동안 새 작업 시작을 막는다', async () => {
        render(
            <WordApprovalPanel
                onStart={jest.fn()}
                approvalState={{ ...idleState, isPendingJobsLoading: true }}
            />,
        );

        await uploadJson({ 나비: ['10'] });
        expect(await screen.findByText(/나비/)).toBeInTheDocument();

        expect(screen.getByRole('button', { name: '처리 시작' })).toBeDisabled();
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

    it('부분 progress와 application 오류가 함께 오면 ErrorModal만 표시한다', () => {
        render(
            <WordApprovalPanel
                approvalState={{
                    ...idleState,
                    progress: {
                        stage: 'applying',
                        completedEntries: 1,
                        totalEntries: 2,
                        completedBatches: 1,
                        totalBatches: 2,
                    },
                    error: {
                        kind: 'infrastructure',
                        message: 'relation words SQL stack failed',
                    },
                }}
            />,
        );

        expect(screen.getByText('단어 승인 작업 처리 중 오류가 발생했습니다.')).toBeInTheDocument();
        expect(screen.queryByText('승인 적용 중')).not.toBeInTheDocument();
        expect(screen.queryByText(/relation|SQL stack/i)).not.toBeInTheDocument();
    });

    describe('controlled file reads', () => {
        const NativeFileReader = global.FileReader;

        class ControlledFileReader {
            static instances: ControlledFileReader[] = [];
            static readonly EMPTY = 0;
            static readonly LOADING = 1;
            static readonly DONE = 2;

            result: string | ArrayBuffer | null = null;
            error: DOMException | null = null;
            readonly EMPTY = ControlledFileReader.EMPTY;
            readonly LOADING = ControlledFileReader.LOADING;
            readonly DONE = ControlledFileReader.DONE;
            readyState: number = FileReader.EMPTY;
            abortCount = 0;
            onload: FileReader['onload'] = null;
            onerror: FileReader['onerror'] = null;
            onabort: FileReader['onabort'] = null;

            constructor() {
                ControlledFileReader.instances.push(this);
            }

            readAsText(): void {
                this.readyState = FileReader.LOADING;
            }

            abort(): void {
                this.abortCount += 1;
                this.readyState = FileReader.DONE;
                this.onabort?.call(
                    this as unknown as FileReader,
                    { target: this } as unknown as ProgressEvent<FileReader>,
                );
            }

            succeed(value: string, force = false): void {
                if (!force && this.readyState !== FileReader.LOADING) {
                    throw new Error('Reader is not loading.');
                }
                this.result = value;
                this.readyState = FileReader.DONE;
                this.onload?.call(
                    this as unknown as FileReader,
                    { target: { result: value } } as unknown as ProgressEvent<FileReader>,
                );
            }

            fail(): void {
                this.error = new DOMException('relation words SQL stack read failed');
                this.readyState = FileReader.DONE;
                this.onerror?.call(
                    this as unknown as FileReader,
                    { target: this } as unknown as ProgressEvent<FileReader>,
                );
            }

            externalAbort(): void {
                this.readyState = FileReader.DONE;
                this.onabort?.call(
                    this as unknown as FileReader,
                    { target: this } as unknown as ProgressEvent<FileReader>,
                );
            }
        }

        beforeEach(() => {
            ControlledFileReader.instances = [];
            global.FileReader = ControlledFileReader as unknown as typeof FileReader;
        });

        afterEach(() => {
            global.FileReader = NativeFileReader;
        });

        it('늦게 끝난 이전 파일이 최신 파일의 command를 덮어쓰지 않는다', async () => {
            const user = userEvent.setup();
            const onStart = jest.fn().mockResolvedValue(undefined);
            render(
                <WordApprovalPanel
                    onStart={onStart}
                    approvalState={idleState}
                />,
            );
            const input = screen.getByLabelText(/클릭하여 파일 업로드/) as HTMLInputElement;

            await user.upload(input, new File(['first'], 'first.json'));
            const firstReader = ControlledFileReader.instances[0];
            await user.upload(input, new File(['second'], 'second.json'));
            const secondReader = ControlledFileReader.instances[1];

            expect(firstReader.abortCount).toBe(1);
            act(() => secondReader.succeed(JSON.stringify({ 최신: ['20'] })));
            act(() => firstReader.succeed(JSON.stringify({ 오래됨: ['10'] }), true));
            await user.click(screen.getByRole('button', { name: '처리 시작' }));

            expect(onStart).toHaveBeenCalledWith([
                { word: '최신', themeCodes: ['20'] },
            ]);
        });

        it('새 파일을 읽는 동안 이전 entries를 제출하지 않는다', async () => {
            const user = userEvent.setup();
            const onStart = jest.fn().mockResolvedValue(undefined);
            render(
                <WordApprovalPanel
                    onStart={onStart}
                    approvalState={idleState}
                />,
            );
            const input = screen.getByLabelText(/클릭하여 파일 업로드/) as HTMLInputElement;

            await user.upload(input, new File(['first'], 'first.json'));
            act(() => ControlledFileReader.instances[0].succeed(
                JSON.stringify({ 이전: ['10'] }),
            ));
            await user.upload(input, new File(['second'], 'second.json'));

            const startButton = screen.getByRole('button', { name: '처리 시작' });
            expect(startButton).toBeDisabled();
            await user.click(startButton);
            expect(onStart).not.toHaveBeenCalled();
        });

        it('파일 read 오류를 내부 정보 없는 안정된 ErrorModal 메시지로 표시한다', async () => {
            const user = userEvent.setup();
            render(<WordApprovalPanel approvalState={idleState} />);
            const input = screen.getByLabelText(/클릭하여 파일 업로드/) as HTMLInputElement;

            await user.upload(input, new File(['broken'], 'broken.json'));
            act(() => ControlledFileReader.instances[0].fail());

            expect(await screen.findByText('JSON 파일을 읽는 중 오류가 발생했습니다.')).toBeInTheDocument();
            expect(screen.queryByText(/relation|SQL stack/i)).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: '처리 시작' })).toBeDisabled();
        });

        it('같은 파일을 다시 선택해도 새로 읽어 최신 결과를 제출한다', async () => {
            const user = userEvent.setup();
            const onStart = jest.fn().mockResolvedValue(undefined);
            render(
                <WordApprovalPanel
                    onStart={onStart}
                    approvalState={idleState}
                />,
            );
            const input = screen.getByLabelText(/클릭하여 파일 업로드/) as HTMLInputElement;
            const sameFile = new File(['same'], 'same.json');

            await user.upload(input, sameFile);
            act(() => ControlledFileReader.instances[0].succeed(
                JSON.stringify({ 첫번째: ['10'] }),
            ));
            await user.upload(input, sameFile);

            expect(ControlledFileReader.instances).toHaveLength(2);
            act(() => ControlledFileReader.instances[1].succeed(
                JSON.stringify({ 두번째: ['20'] }),
            ));
            await user.click(screen.getByRole('button', { name: '처리 시작' }));
            expect(onStart).toHaveBeenCalledWith([
                { word: '두번째', themeCodes: ['20'] },
            ]);
        });

        it('현재 read가 중단되면 안정된 메시지를 표시하고 unmount 시 read를 정리한다', async () => {
            const user = userEvent.setup();
            const { unmount } = render(<WordApprovalPanel approvalState={idleState} />);
            const input = screen.getByLabelText(/클릭하여 파일 업로드/) as HTMLInputElement;

            await user.upload(input, new File(['abort'], 'abort.json'));
            const reader = ControlledFileReader.instances[0];
            act(() => reader.externalAbort());
            expect(await screen.findByText('JSON 파일 읽기가 취소되었습니다.')).toBeInTheDocument();

            await user.upload(input, new File(['pending'], 'pending.json'));
            const pendingReader = ControlledFileReader.instances[1];
            unmount();
            expect(pendingReader.abortCount).toBe(1);
        });
    });
});

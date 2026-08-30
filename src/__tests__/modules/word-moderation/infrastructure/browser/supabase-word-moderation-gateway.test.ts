import type {
    ApproveWordBatchCommand,
    ApproveWordBatchResult,
    StartWordApprovalOperationInput,
    WordApprovalOperation,
} from '@/src/modules/word-moderation/application/word-approval-types';

type RpcResponse = {
    data: unknown;
    error: { code?: string | null; message: string; cause?: unknown } | null;
};

type Rpc = jest.Mock<Promise<RpcResponse>, [string, Record<string, unknown>]>;

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { rpc: jest.fn() },
}));

import { SupabaseWordModerationGateway } from '../../../../../modules/word-moderation/infrastructure/browser/supabase-word-moderation-gateway';

const rpc = (
    jest.requireMock('../../../../../shared/infrastructure/supabase/browser-client') as {
        browserSupabaseClient: { rpc: Rpc };
    }
).browserSupabaseClient.rpc;

const input: StartWordApprovalOperationInput = {
    operationId: '083db149-31ee-4e48-bc15-4a428d52a518',
    inputHash: '415e4e4aa15a6be0024de360004ac918711fd8ced59396662948a0e6db839b8e',
    totalEntries: 2,
    totalBatches: 1,
};

const command: ApproveWordBatchCommand = {
    operationId: input.operationId,
    batchIndex: 0,
    totalBatches: 1,
    payloadHash: 'cbd6f7316dba3be3fd8a6191ac84e3e7d8b0f6233214fae476761420e7b71b4c',
    entries: [
        { word: '가방', themeCodes: ['10'], noinCanUse: true },
        { word: '나비', themeCodes: ['11'], noinCanUse: false },
    ],
};

const successfulBatchResult: ApproveWordBatchResult = {
    approvedWordCount: 2,
    addedThemeCount: 3,
    removedThemeCount: 1,
    processedRequestCount: 4,
    affectedDocsIds: [5, 10],
};

const operationResult = (
    completedBatches: WordApprovalOperation['completedBatches'] = [],
): WordApprovalOperation => ({
    ...input,
    completedBatches,
    status: 'running',
});

describe('SupabaseWordModerationGateway', () => {
    const gateway = new SupabaseWordModerationGateway();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('시작 input을 snake_case RPC argument로 변환하고 operation DTO를 반환한다', async () => {
        rpc.mockResolvedValue({ data: operationResult(), error: null });

        await expect(gateway.startOperation(input)).resolves.toEqual({
            ok: true,
            value: operationResult(),
        });
        expect(rpc).toHaveBeenCalledWith('start_word_approval_operation', {
            p_operation_id: input.operationId,
            p_input_hash: input.inputHash,
            p_total_entries: input.totalEntries,
            p_total_batches: input.totalBatches,
        });
    });

    it('get operation 응답의 completed batch를 index 오름차순으로 정규화한다', async () => {
        rpc.mockResolvedValue({
            data: operationResult([
                { batchIndex: 2, payloadHash: 'hash-2', result: successfulBatchResult },
                { batchIndex: 0, payloadHash: 'hash-0', result: successfulBatchResult },
            ]),
            error: null,
        });

        await expect(gateway.getOperation(input.operationId)).resolves.toEqual({
            ok: true,
            value: operationResult([
                { batchIndex: 0, payloadHash: 'hash-0', result: successfulBatchResult },
                { batchIndex: 2, payloadHash: 'hash-2', result: successfulBatchResult },
            ]),
        });
        expect(rpc).toHaveBeenCalledWith('get_word_approval_operation', {
            p_operation_id: input.operationId,
        });
    });

    it('application command를 snake_case RPC argument로 변환한다', async () => {
        rpc.mockResolvedValue({ data: successfulBatchResult, error: null });

        await expect(gateway.approveBatch(command)).resolves.toEqual({
            ok: true,
            value: successfulBatchResult,
        });
        expect(rpc).toHaveBeenCalledWith('apply_word_approval_batch', {
            p_operation_id: command.operationId,
            p_batch_index: command.batchIndex,
            p_total_batches: command.totalBatches,
            p_payload_hash: command.payloadHash,
            p_entries: command.entries,
        });
    });

    it('공개 DB error token을 ApplicationError로 변환한다', async () => {
        rpc.mockResolvedValue({
            data: null,
            error: { code: 'P0001', message: 'WORD_APPROVAL_CONFLICT' },
        });

        await expect(gateway.approveBatch(command)).resolves.toMatchObject({
            ok: false,
            error: { kind: 'conflict' },
        });
    });

    it('cancel operation을 RPC에 전달하고 성공 시 void result를 반환한다', async () => {
        rpc.mockResolvedValue({ data: { cancelled: true }, error: null });

        await expect(gateway.cancelOperation(input.operationId)).resolves.toEqual({
            ok: true,
            value: undefined,
        });
        expect(rpc).toHaveBeenCalledWith('cancel_word_approval_operation', {
            p_operation_id: input.operationId,
        });
    });

    it('잘못된 RPC JSON은 내부 오류로 안전하게 변환한다', async () => {
        rpc.mockResolvedValue({ data: { approvedWordCount: 'two' }, error: null });

        await expect(gateway.approveBatch(command)).resolves.toEqual({
            ok: false,
            error: {
                kind: 'infrastructure',
                message: '데이터 처리 중 오류가 발생했습니다.',
            },
        });
    });
});

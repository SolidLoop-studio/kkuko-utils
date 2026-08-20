import type {
    DeleteWordBatchCommand,
    DeleteWordBatchResult,
    StartWordDeletionOperationInput,
    WordDeletionOperation,
} from '@/src/modules/word-moderation/application/word-deletion-types';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { rpc: jest.fn() },
}));

import { SupabaseWordDeletionGateway } from '@/src/modules/word-moderation/infrastructure/browser/supabase-word-deletion-gateway';

type RpcResponse = {
    data: unknown;
    error: { code?: string | null; message: string; cause?: unknown } | null;
};

type Rpc = jest.Mock<Promise<RpcResponse>, [string, Record<string, unknown>]>;

const input: StartWordDeletionOperationInput = {
    operationId: '083db149-31ee-4e48-bc15-4a428d52a518',
    inputHash: '415e4e4aa15a6be0024de360004ac918711fd8ced59396662948a0e6db839b8e',
    totalEntries: 1,
    totalBatches: 1,
};

const command: DeleteWordBatchCommand = {
    operationId: input.operationId,
    batchIndex: 0,
    totalBatches: 1,
    payloadHash: 'cbd6f7316dba3be3fd8a6191ac84e3e7d8b0f6233214fae476761420e7b71b4c',
    entries: [{ word: '가방' }],
};

const successfulBatchResult: DeleteWordBatchResult = {
    deletedWordCount: 1,
    protectedWordCount: 2,
    missingWordCount: 3,
    processedRequestCount: 4,
    affectedDocsIds: [5, 10],
};

const operationResult = (
    completedBatches: WordDeletionOperation['completedBatches'] = [],
): WordDeletionOperation => ({
    ...input,
    completedBatches,
    status: 'running',
});

describe('SupabaseWordDeletionGateway', () => {
    const rpc: Rpc = jest.fn();
    const gateway = new SupabaseWordDeletionGateway({ rpc });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('starts an operation with snake_case RPC arguments', async () => {
        rpc.mockResolvedValue({ data: operationResult(), error: null });

        await expect(gateway.startOperation(input)).resolves.toEqual({
            ok: true,
            value: operationResult(),
        });
        expect(rpc).toHaveBeenCalledWith('start_word_deletion_operation', {
            p_operation_id: input.operationId,
            p_input_hash: input.inputHash,
            p_total_entries: input.totalEntries,
            p_total_batches: input.totalBatches,
        });
    });

    it('gets an operation and sorts complete batch results by index', async () => {
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
        expect(rpc).toHaveBeenCalledWith('get_word_deletion_operation', {
            p_operation_id: input.operationId,
        });
    });

    it('applies a deletion batch with its complete counters', async () => {
        rpc.mockResolvedValue({ data: successfulBatchResult, error: null });

        await expect(gateway.deleteBatch(command)).resolves.toEqual({
            ok: true,
            value: successfulBatchResult,
        });
        expect(rpc).toHaveBeenCalledWith('apply_word_deletion_batch', {
            p_operation_id: input.operationId,
            p_batch_index: 0,
            p_total_batches: 1,
            p_payload_hash: command.payloadHash,
            p_entries: [{ word: '가방' }],
        });
    });

    it('cancels an operation with its operation id', async () => {
        rpc.mockResolvedValue({ data: { status: 'cancelled' }, error: null });

        await expect(gateway.cancelOperation(input.operationId)).resolves.toEqual({
            ok: true,
            value: undefined,
        });
        expect(rpc).toHaveBeenCalledWith('cancel_word_deletion_operation', {
            p_operation_id: input.operationId,
        });
    });

    it('rejects a malformed operation result as infrastructure failure', async () => {
        rpc.mockResolvedValue({
            data: { ...operationResult(), completedBatches: [{ batchIndex: 0, payloadHash: 'hash' }] },
            error: null,
        });

        await expect(gateway.getOperation(input.operationId)).resolves.toEqual({
            ok: false,
            error: {
                kind: 'infrastructure',
                message: '데이터 처리 중 오류가 발생했습니다.',
            },
        });
    });

    it('rejects a malformed deletion batch result as infrastructure failure', async () => {
        rpc.mockResolvedValue({
            data: { ...successfulBatchResult, missingWordCount: 'three' },
            error: null,
        });

        await expect(gateway.deleteBatch(command)).resolves.toEqual({
            ok: false,
            error: {
                kind: 'infrastructure',
                message: '데이터 처리 중 오류가 발생했습니다.',
            },
        });
    });

    it.each([
        ['WORD_DELETION_INVALID_INPUT', 'validation'],
        ['WORD_DELETION_UNAUTHORIZED', 'unauthorized'],
        ['WORD_DELETION_FORBIDDEN', 'forbidden'],
        ['WORD_DELETION_NOT_FOUND', 'not-found'],
        ['WORD_DELETION_CONFLICT', 'conflict'],
        ['WORD_DELETION_INTERNAL_ERROR', 'infrastructure'],
    ] as const)('maps %s to the %s application error kind', async (message, kind) => {
        rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message } });

        await expect(gateway.deleteBatch(command)).resolves.toMatchObject({
            ok: false,
            error: { kind, code: 'P0001' },
        });
    });

    it('maps unknown RPC failures to infrastructure errors', async () => {
        rpc.mockResolvedValue({
            data: null,
            error: { code: 'XX000', message: 'unexpected database failure' },
        });

        await expect(gateway.startOperation(input)).resolves.toMatchObject({
            ok: false,
            error: { kind: 'infrastructure', code: 'XX000' },
        });
    });

    it('maps rejected RPC calls to infrastructure errors', async () => {
        rpc.mockRejectedValue(new Error('network unavailable'));

        await expect(gateway.getOperation(input.operationId)).resolves.toMatchObject({
            ok: false,
            error: { kind: 'infrastructure' },
        });
    });
});

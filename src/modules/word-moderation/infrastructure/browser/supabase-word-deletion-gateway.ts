import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { WordDeletionOperationGateway } from '../../application/word-deletion-ports';
import type {
    DeleteWordBatchCommand,
    DeleteWordBatchResult,
    StartWordDeletionOperationInput,
    WordDeletionOperation,
    WordDeletionOperationStatus,
} from '../../application/word-deletion-types';

type RpcError = {
    code?: string | null;
    message: string;
    cause?: unknown;
};

type RpcResponse = {
    data: unknown;
    error: RpcError | null;
};

interface WordDeletionRpcClient {
    rpc(functionName: string, args: Record<string, unknown>): Promise<RpcResponse>;
}

const infrastructureError = (cause?: unknown): ApplicationError => ({
    kind: 'infrastructure',
    message: '데이터 처리 중 오류가 발생했습니다.',
    ...(cause === undefined ? {} : { cause }),
});

const wordDeletionErrors = {
    WORD_DELETION_INVALID_INPUT: {
        kind: 'validation',
        message: '입력값이 올바르지 않습니다.',
    },
    WORD_DELETION_UNAUTHORIZED: {
        kind: 'unauthorized',
        message: '인증이 필요합니다.',
    },
    WORD_DELETION_FORBIDDEN: {
        kind: 'forbidden',
        message: '권한이 없습니다.',
    },
    WORD_DELETION_NOT_FOUND: {
        kind: 'not-found',
        message: '요청한 데이터를 찾을 수 없습니다.',
    },
    WORD_DELETION_CONFLICT: {
        kind: 'conflict',
        message: '요청이 이미 처리되었거나 충돌이 발생했습니다.',
    },
} as const;

const mapWordDeletionError = (error: RpcError): ApplicationError => {
    const mappedError = wordDeletionErrors[error.message as keyof typeof wordDeletionErrors];

    if (mappedError) {
        return {
            ...mappedError,
            code: error.code ?? undefined,
        };
    }

    return {
        ...infrastructureError(error.cause),
        code: error.code ?? undefined,
    };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonNegativeInteger = (value: unknown): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isOperationStatus = (value: unknown): value is WordDeletionOperationStatus =>
    value === 'running' || value === 'completed' || value === 'cancelled';

const parseDeleteWordBatchResult = (value: unknown): DeleteWordBatchResult | null => {
    if (!isRecord(value)
        || !isNonNegativeInteger(value.deletedWordCount)
        || !isNonNegativeInteger(value.protectedWordCount)
        || !isNonNegativeInteger(value.missingWordCount)
        || !isNonNegativeInteger(value.processedRequestCount)
        || !Array.isArray(value.affectedDocsIds)
        || !value.affectedDocsIds.every(isNonNegativeInteger)) {
        return null;
    }

    return {
        deletedWordCount: value.deletedWordCount,
        protectedWordCount: value.protectedWordCount,
        missingWordCount: value.missingWordCount,
        processedRequestCount: value.processedRequestCount,
        affectedDocsIds: value.affectedDocsIds,
    };
};

const parseWordDeletionOperation = (value: unknown): WordDeletionOperation | null => {
    if (!isRecord(value)
        || typeof value.operationId !== 'string'
        || typeof value.inputHash !== 'string'
        || !isNonNegativeInteger(value.totalEntries)
        || !isNonNegativeInteger(value.totalBatches)
        || !Array.isArray(value.completedBatches)
        || !isOperationStatus(value.status)) {
        return null;
    }

    const completedBatches: WordDeletionOperation['completedBatches'] = [];
    for (const completedBatch of value.completedBatches) {
        if (!isRecord(completedBatch)
            || !isNonNegativeInteger(completedBatch.batchIndex)
            || typeof completedBatch.payloadHash !== 'string') {
            return null;
        }

        const result = parseDeleteWordBatchResult(completedBatch.result);
        if (result === null) {
            return null;
        }

        completedBatches.push({
            batchIndex: completedBatch.batchIndex,
            payloadHash: completedBatch.payloadHash,
            result,
        });
    }

    completedBatches.sort((left, right) => left.batchIndex - right.batchIndex);

    return {
        operationId: value.operationId,
        inputHash: value.inputHash,
        totalEntries: value.totalEntries,
        totalBatches: value.totalBatches,
        completedBatches,
        status: value.status,
    };
};

/** 브라우저 단어 삭제 RPC와 Application DTO를 연결한다. */
export class SupabaseWordDeletionGateway implements WordDeletionOperationGateway {
    constructor(
        private readonly rpcClient: WordDeletionRpcClient = browserSupabaseClient as unknown as WordDeletionRpcClient,
    ) {}

    async startOperation(
        input: StartWordDeletionOperationInput,
    ): Promise<Result<WordDeletionOperation>> {
        const response = await this.call('start_word_deletion_operation', {
            p_operation_id: input.operationId,
            p_input_hash: input.inputHash,
            p_total_entries: input.totalEntries,
            p_total_batches: input.totalBatches,
        });
        if (!response.ok) {
            return response;
        }
        if (response.value.error) {
            return err(mapWordDeletionError(response.value.error));
        }

        const operation = parseWordDeletionOperation(response.value.data);
        return operation === null ? err(infrastructureError()) : ok(operation);
    }

    async getOperation(operationId: string): Promise<Result<WordDeletionOperation>> {
        const response = await this.call('get_word_deletion_operation', {
            p_operation_id: operationId,
        });
        if (!response.ok) {
            return response;
        }
        if (response.value.error) {
            return err(mapWordDeletionError(response.value.error));
        }

        const operation = parseWordDeletionOperation(response.value.data);
        return operation === null ? err(infrastructureError()) : ok(operation);
    }

    async deleteBatch(command: DeleteWordBatchCommand): Promise<Result<DeleteWordBatchResult>> {
        const response = await this.call('apply_word_deletion_batch', {
            p_operation_id: command.operationId,
            p_batch_index: command.batchIndex,
            p_total_batches: command.totalBatches,
            p_payload_hash: command.payloadHash,
            p_entries: command.entries,
        });
        if (!response.ok) {
            return response;
        }
        if (response.value.error) {
            return err(mapWordDeletionError(response.value.error));
        }

        const result = parseDeleteWordBatchResult(response.value.data);
        return result === null ? err(infrastructureError()) : ok(result);
    }

    async cancelOperation(operationId: string): Promise<Result<void>> {
        const response = await this.call('cancel_word_deletion_operation', {
            p_operation_id: operationId,
        });
        if (!response.ok) {
            return response;
        }

        return response.value.error ? err(mapWordDeletionError(response.value.error)) : ok(undefined);
    }

    private async call(
        functionName: string,
        args: Record<string, unknown>,
    ): Promise<Result<RpcResponse>> {
        try {
            return ok(await this.rpcClient.rpc(functionName, args));
        } catch (cause: unknown) {
            return err(infrastructureError(cause));
        }
    }
}

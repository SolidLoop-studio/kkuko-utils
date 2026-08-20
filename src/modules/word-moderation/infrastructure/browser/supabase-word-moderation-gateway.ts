import type { Database, Json } from '../../../../app/types/database.types';
import type { WordApprovalOperationGateway } from '../../application/ports';
import type {
    ApproveWordBatchCommand,
    ApproveWordBatchResult,
    StartWordApprovalOperationInput,
    WordApprovalOperation,
    WordApprovalOperationStatus,
} from '../../application/word-approval-types';
import { err, ok } from '../../../../shared/application/result';
import type { Result } from '../../../../shared/application/result';
import { browserSupabaseClient } from '../../../../shared/infrastructure/supabase/browser-client';
import { mapSupabaseError } from '../../../../shared/infrastructure/supabase/map-supabase-error';

type StartOperationArgs = Database['public']['Functions']['start_word_approval_operation']['Args'];
type GetOperationArgs = Database['public']['Functions']['get_word_approval_operation']['Args'];
type ApproveBatchArgs = Database['public']['Functions']['apply_word_approval_batch']['Args'];
type CancelOperationArgs = Database['public']['Functions']['cancel_word_approval_operation']['Args'];

const infrastructureError = () => ({
    kind: 'infrastructure' as const,
    message: '데이터 처리 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonNegativeInteger = (value: unknown): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isOperationStatus = (value: unknown): value is WordApprovalOperationStatus =>
    value === 'running' || value === 'completed' || value === 'cancelled';

const parseApproveWordBatchResult = (value: unknown): ApproveWordBatchResult | null => {
    if (!isRecord(value)
        || !isNonNegativeInteger(value.approvedWordCount)
        || !isNonNegativeInteger(value.addedThemeCount)
        || !isNonNegativeInteger(value.removedThemeCount)
        || !isNonNegativeInteger(value.processedRequestCount)
        || !Array.isArray(value.affectedDocsIds)
        || !value.affectedDocsIds.every(isNonNegativeInteger)) {
        return null;
    }

    return {
        approvedWordCount: value.approvedWordCount,
        addedThemeCount: value.addedThemeCount,
        removedThemeCount: value.removedThemeCount,
        processedRequestCount: value.processedRequestCount,
        affectedDocsIds: value.affectedDocsIds,
    };
};

const parseWordApprovalOperation = (value: unknown): WordApprovalOperation | null => {
    if (!isRecord(value)
        || typeof value.operationId !== 'string'
        || typeof value.inputHash !== 'string'
        || !isNonNegativeInteger(value.totalEntries)
        || !isNonNegativeInteger(value.totalBatches)
        || !Array.isArray(value.completedBatches)
        || !isOperationStatus(value.status)) {
        return null;
    }

    const completedBatches: WordApprovalOperation['completedBatches'] = [];
    for (const completedBatch of value.completedBatches) {
        if (!isRecord(completedBatch)
            || !isNonNegativeInteger(completedBatch.batchIndex)
            || typeof completedBatch.payloadHash !== 'string') {
            return null;
        }

        const result = parseApproveWordBatchResult(completedBatch.result);
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

/** 브라우저에서 단어 승인 RPC와 Application DTO를 연결한다. */
export class SupabaseWordModerationGateway implements WordApprovalOperationGateway {
    async startOperation(
        input: StartWordApprovalOperationInput,
    ): Promise<Result<WordApprovalOperation>> {
        const args: StartOperationArgs = {
            p_operation_id: input.operationId,
            p_input_hash: input.inputHash,
            p_total_entries: input.totalEntries,
            p_total_batches: input.totalBatches,
        };
        const { data, error } = await browserSupabaseClient.rpc('start_word_approval_operation', args);

        if (error) {
            return err(mapSupabaseError(error));
        }

        const operation = parseWordApprovalOperation(data);
        return operation === null ? err(infrastructureError()) : ok(operation);
    }

    async getOperation(operationId: string): Promise<Result<WordApprovalOperation>> {
        const args: GetOperationArgs = { p_operation_id: operationId };
        const { data, error } = await browserSupabaseClient.rpc('get_word_approval_operation', args);

        if (error) {
            return err(mapSupabaseError(error));
        }

        const operation = parseWordApprovalOperation(data);
        return operation === null ? err(infrastructureError()) : ok(operation);
    }

    async approveBatch(command: ApproveWordBatchCommand): Promise<Result<ApproveWordBatchResult>> {
        const entries: Json = command.entries;
        const args: ApproveBatchArgs = {
            p_operation_id: command.operationId,
            p_batch_index: command.batchIndex,
            p_total_batches: command.totalBatches,
            p_payload_hash: command.payloadHash,
            p_entries: entries,
        };
        const { data, error } = await browserSupabaseClient.rpc('apply_word_approval_batch', args);

        if (error) {
            return err(mapSupabaseError(error));
        }

        const result = parseApproveWordBatchResult(data);
        return result === null ? err(infrastructureError()) : ok(result);
    }

    async cancelOperation(operationId: string): Promise<Result<void>> {
        const args: CancelOperationArgs = { p_operation_id: operationId };
        const { error } = await browserSupabaseClient.rpc('cancel_word_approval_operation', args);

        return error ? err(mapSupabaseError(error)) : ok(undefined);
    }
}

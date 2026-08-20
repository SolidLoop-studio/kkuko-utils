import type { Result } from '@/src/shared/application/result';
import { err, ok } from '@/src/shared/application/result';
import {
    MAX_WORD_APPROVAL_BATCH_SIZE,
    normalizeWordApprovalEntries,
    type RawWordApprovalEntry,
} from '@/src/modules/word-moderation/domain/word-approval';
import { buildApprovalPayload } from './word-approval-payload';
import type { WordApprovalJobStore, WordApprovalOperationGateway } from './ports';
import type {
    ApprovalProgress,
    ApproveWordBatchResult,
    StoredWordApprovalJob,
    WordApprovalOperation,
    WordApprovalPayload,
    WordApprovalRunResult,
} from './word-approval-types';

const conflict = (message: string) => err({ kind: 'conflict' as const, message });

const emptyResult = (): ApproveWordBatchResult => ({
    approvedWordCount: 0,
    addedThemeCount: 0,
    removedThemeCount: 0,
    processedRequestCount: 0,
    affectedDocsIds: [],
});

const addBatchResult = (
    aggregate: ApproveWordBatchResult,
    batchResult: ApproveWordBatchResult,
): ApproveWordBatchResult => ({
    approvedWordCount: aggregate.approvedWordCount + batchResult.approvedWordCount,
    addedThemeCount: aggregate.addedThemeCount + batchResult.addedThemeCount,
    removedThemeCount: aggregate.removedThemeCount + batchResult.removedThemeCount,
    processedRequestCount:
        aggregate.processedRequestCount + batchResult.processedRequestCount,
    affectedDocsIds: Array.from(new Set([
        ...aggregate.affectedDocsIds,
        ...batchResult.affectedDocsIds,
    ])),
});

/**
 * 단어 승인 작업을 시작하거나 저장된 작업부터 재개하는 애플리케이션 서비스입니다.
 */
export class RunWordApprovalService {
    constructor(
        private readonly operationGateway: WordApprovalOperationGateway,
        private readonly jobStore: WordApprovalJobStore,
        private readonly createOperationId: () => string = () => crypto.randomUUID(),
        private readonly batchSize = MAX_WORD_APPROVAL_BATCH_SIZE,
    ) {}

    async start(
        entries: RawWordApprovalEntry[],
        onProgress?: (progress: ApprovalProgress) => void,
    ): Promise<Result<WordApprovalRunResult>> {
        const normalizedResult = normalizeWordApprovalEntries(entries);
        if (!normalizedResult.ok) {
            return err(normalizedResult.error);
        }

        const normalizedEntries = normalizedResult.value;
        const payload = await buildApprovalPayload(normalizedEntries, this.batchSize);
        const candidateOperationId = this.createOperationId();
        const candidateJob: StoredWordApprovalJob = {
            operationId: candidateOperationId,
            inputHash: payload.inputHash,
            entries: normalizedEntries,
            batchSize: this.batchSize,
            createdAt: new Date().toISOString(),
        };

        this.reportProgress(onProgress, 'validating', 0, payload, normalizedEntries.length);
        await this.jobStore.save(candidateJob);

        const startResult = await this.operationGateway.startOperation({
            operationId: candidateOperationId,
            inputHash: payload.inputHash,
            totalEntries: normalizedEntries.length,
            totalBatches: payload.batches.length,
        });
        if (!startResult.ok) {
            return startResult;
        }

        const operation = startResult.value;
        const validationResult = this.validateOperation(operation, candidateJob, payload, false);
        if (!validationResult.ok) {
            return validationResult;
        }

        let operationJob = candidateJob;
        if (operation.operationId !== candidateOperationId) {
            operationJob = { ...candidateJob, operationId: operation.operationId };
            await this.jobStore.save(operationJob);
            await this.jobStore.remove(candidateOperationId);
        }

        return this.runValidatedOperation(operation, operationJob, payload, onProgress);
    }

    async resume(
        operationId: string,
        onProgress?: (progress: ApprovalProgress) => void,
    ): Promise<Result<WordApprovalRunResult>> {
        const operationResult = await this.operationGateway.getOperation(operationId);
        if (!operationResult.ok) {
            return operationResult;
        }

        const job = await this.jobStore.get(operationId);
        if (job === null) {
            return err({ kind: 'not-found', message: '저장된 단어 승인 작업을 찾을 수 없습니다.' });
        }

        const payload = await buildApprovalPayload(job.entries, job.batchSize);
        this.reportProgress(onProgress, 'validating', 0, payload, job.entries.length);

        const validationResult = this.validateOperation(operationResult.value, job, payload, true);
        if (!validationResult.ok) {
            return validationResult;
        }

        return this.runValidatedOperation(operationResult.value, job, payload, onProgress);
    }

    async listPending(): Promise<StoredWordApprovalJob[]> {
        return this.jobStore.listPending();
    }

    async cancel(operationId: string): Promise<Result<void>> {
        const cancelResult = await this.operationGateway.cancelOperation(operationId);
        if (!cancelResult.ok) {
            return cancelResult;
        }

        await this.jobStore.remove(operationId);
        return ok(undefined);
    }

    private validateOperation(
        operation: WordApprovalOperation,
        job: StoredWordApprovalJob,
        payload: WordApprovalPayload,
        requireMatchingOperationId: boolean,
    ): Result<void> {
        if (
            (requireMatchingOperationId && operation.operationId !== job.operationId)
            || operation.operationId.length === 0
            || job.inputHash !== payload.inputHash
            || operation.inputHash !== payload.inputHash
            || operation.totalEntries !== job.entries.length
            || operation.totalBatches !== payload.batches.length
        ) {
            return conflict('DB operation과 로컬 승인 payload가 일치하지 않습니다.');
        }

        if (operation.status === 'cancelled') {
            return conflict('취소된 단어 승인 작업은 실행할 수 없습니다.');
        }

        const completedIndexes = new Set<number>();
        for (const completedBatch of operation.completedBatches) {
            const expectedBatch = payload.batches[completedBatch.batchIndex];
            if (
                !Number.isInteger(completedBatch.batchIndex)
                || expectedBatch === undefined
                || completedIndexes.has(completedBatch.batchIndex)
                || completedBatch.payloadHash !== expectedBatch.payloadHash
            ) {
                return conflict('완료된 DB batch와 로컬 승인 payload가 일치하지 않습니다.');
            }
            completedIndexes.add(completedBatch.batchIndex);
        }

        if (
            operation.status === 'completed'
            && completedIndexes.size !== payload.batches.length
        ) {
            return conflict('완료된 operation의 batch metadata가 완전하지 않습니다.');
        }

        return ok(undefined);
    }

    private async runValidatedOperation(
        operation: WordApprovalOperation,
        job: StoredWordApprovalJob,
        payload: WordApprovalPayload,
        onProgress?: (progress: ApprovalProgress) => void,
    ): Promise<Result<WordApprovalRunResult>> {
        const completedByIndex = new Map(
            operation.completedBatches.map((batch) => [batch.batchIndex, batch]),
        );
        let completedEntries = 0;
        let completedBatches = 0;

        for (const batch of payload.batches) {
            const completedBatch = completedByIndex.get(batch.batchIndex);
            if (completedBatch === undefined) {
                continue;
            }
            completedEntries += batch.entries.length;
            completedBatches += 1;
        }

        this.reportProgress(
            onProgress,
            'applying',
            completedEntries,
            payload,
            job.entries.length,
            completedBatches,
        );

        for (const batch of payload.batches) {
            if (completedByIndex.has(batch.batchIndex)) {
                continue;
            }

            const batchResult = await this.operationGateway.approveBatch({
                operationId: operation.operationId,
                batchIndex: batch.batchIndex,
                totalBatches: payload.batches.length,
                payloadHash: batch.payloadHash,
                entries: batch.entries,
            });
            if (!batchResult.ok) {
                return batchResult;
            }

            completedEntries += batch.entries.length;
            completedBatches += 1;
            this.reportProgress(
                onProgress,
                'applying',
                completedEntries,
                payload,
                job.entries.length,
                completedBatches,
            );
        }

        const finalOperationResult = await this.operationGateway.getOperation(
            operation.operationId,
        );
        if (!finalOperationResult.ok) {
            return finalOperationResult;
        }

        const finalValidationResult = this.validateOperation(
            finalOperationResult.value,
            job,
            payload,
            true,
        );
        if (!finalValidationResult.ok) {
            return finalValidationResult;
        }
        if (finalOperationResult.value.status !== 'completed') {
            return conflict('DB operation이 아직 완료되지 않았습니다.');
        }

        const authoritativeResults = new Map(
            finalOperationResult.value.completedBatches.map(
                (batch) => [batch.batchIndex, batch.result],
            ),
        );
        let aggregate = emptyResult();
        for (const batch of payload.batches) {
            const authoritativeResult = authoritativeResults.get(batch.batchIndex);
            if (authoritativeResult !== undefined) {
                aggregate = addBatchResult(aggregate, authoritativeResult);
            }
        }

        this.reportProgress(
            onProgress,
            'finalizing',
            job.entries.length,
            payload,
            job.entries.length,
            payload.batches.length,
        );
        await this.jobStore.remove(operation.operationId);
        this.reportProgress(
            onProgress,
            'completed',
            job.entries.length,
            payload,
            job.entries.length,
            payload.batches.length,
        );

        return ok({
            operationId: operation.operationId,
            ...aggregate,
        });
    }

    private reportProgress(
        onProgress: ((progress: ApprovalProgress) => void) | undefined,
        stage: ApprovalProgress['stage'],
        completedEntries: number,
        payload: WordApprovalPayload,
        totalEntries: number,
        completedBatches = 0,
    ): void {
        onProgress?.({
            completedEntries,
            totalEntries,
            completedBatches,
            totalBatches: payload.batches.length,
            stage,
        });
    }
}

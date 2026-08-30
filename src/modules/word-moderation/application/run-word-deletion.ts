import { err, ok, type Result } from '@/src/shared/application/result';
import { MAX_WORD_DELETION_BATCH_SIZE, normalizeWordDeletionEntries, type RawWordDeletionEntry } from '@/src/modules/word-moderation/domain/word-deletion';
import { buildWordDeletionPayload } from './word-deletion-payload';
import type { WordDeletionJobStore, WordDeletionOperationGateway } from './word-deletion-ports';
import type { DeleteWordBatchResult, DeletionProgress, StoredWordDeletionJob, WordDeletionOperation, WordDeletionPayload, WordDeletionRunResult } from './word-deletion-types';

const conflict = (message: string) => err({ kind: 'conflict' as const, message });
const emptyResult = (): DeleteWordBatchResult => ({ deletedWordCount: 0, protectedWordCount: 0, missingWordCount: 0, processedRequestCount: 0, affectedDocsIds: [] });
const addResult = (left: DeleteWordBatchResult, right: DeleteWordBatchResult): DeleteWordBatchResult => ({ deletedWordCount: left.deletedWordCount + right.deletedWordCount, protectedWordCount: left.protectedWordCount + right.protectedWordCount, missingWordCount: left.missingWordCount + right.missingWordCount, processedRequestCount: left.processedRequestCount + right.processedRequestCount, affectedDocsIds: [...new Set([...left.affectedDocsIds, ...right.affectedDocsIds])] });

/** 단어 삭제 작업을 시작하거나 저장된 작업부터 재개하는 애플리케이션 서비스입니다. */
export class RunWordDeletionService {
    constructor(private readonly operationGateway: WordDeletionOperationGateway, private readonly jobStore: WordDeletionJobStore, private readonly createOperationId: () => string = () => crypto.randomUUID(), private readonly batchSize = MAX_WORD_DELETION_BATCH_SIZE) {}
    async start(entries: RawWordDeletionEntry[], onProgress?: (progress: DeletionProgress) => void): Promise<Result<WordDeletionRunResult>> {
        const normalized = normalizeWordDeletionEntries(entries); if (!normalized.ok) return err(normalized.error);
        const payload = await buildWordDeletionPayload(normalized.value, this.batchSize); const job: StoredWordDeletionJob = { operationId: this.createOperationId(), inputHash: payload.inputHash, entries: normalized.value, batchSize: this.batchSize, createdAt: new Date().toISOString() };
        this.progress(onProgress, 'validating', 0, payload, job.entries.length); await this.jobStore.save(job);
        const started = await this.operationGateway.startOperation({ operationId: job.operationId, inputHash: job.inputHash, totalEntries: job.entries.length, totalBatches: payload.batches.length }); if (!started.ok) return started;
        const validated = this.validate(started.value, job, payload, false); if (!validated.ok) return validated;
        let operationJob = job; if (started.value.operationId !== job.operationId) { operationJob = { ...job, operationId: started.value.operationId }; await this.jobStore.save(operationJob); await this.jobStore.remove(job.operationId); }
        return this.run(started.value, operationJob, payload, onProgress);
    }
    async resume(operationId: string, onProgress?: (progress: DeletionProgress) => void): Promise<Result<WordDeletionRunResult>> {
        const job = await this.jobStore.get(operationId); if (!job) return err({ kind: 'not-found', message: '저장된 단어 삭제 작업을 찾을 수 없습니다.' });
        const payload = await buildWordDeletionPayload(job.entries, job.batchSize); this.progress(onProgress, 'validating', 0, payload, job.entries.length);
        if (job.operationId !== operationId || job.inputHash !== payload.inputHash) return conflict('로컬 삭제 작업과 payload가 일치하지 않습니다.');
        let operationResult = await this.operationGateway.getOperation(operationId); let restarted = false;
        if (!operationResult.ok && operationResult.error.kind === 'not-found') { restarted = true; operationResult = await this.operationGateway.startOperation({ operationId: job.operationId, inputHash: payload.inputHash, totalEntries: job.entries.length, totalBatches: payload.batches.length }); }
        if (!operationResult.ok) return operationResult; const validated = this.validate(operationResult.value, job, payload, !restarted); if (!validated.ok) return validated;
        let operationJob = job; if (operationResult.value.operationId !== job.operationId) { operationJob = { ...job, operationId: operationResult.value.operationId }; await this.jobStore.save(operationJob); await this.jobStore.remove(job.operationId); }
        return this.run(operationResult.value, operationJob, payload, onProgress);
    }
    async listPending(): Promise<StoredWordDeletionJob[]> { return this.jobStore.listPending(); }
    async cancel(operationId: string): Promise<Result<void>> { const result = await this.operationGateway.cancelOperation(operationId); if (!result.ok && result.error.kind !== 'not-found') return result; await this.jobStore.remove(operationId); return ok(undefined); }
    private validate(operation: WordDeletionOperation, job: StoredWordDeletionJob, payload: WordDeletionPayload, matchingId: boolean): Result<void> {
        if ((matchingId && operation.operationId !== job.operationId) || !operation.operationId || job.inputHash !== payload.inputHash || operation.inputHash !== payload.inputHash || operation.totalEntries !== job.entries.length || operation.totalBatches !== payload.batches.length) return conflict('DB operation과 로컬 삭제 payload가 일치하지 않습니다.');
        if (operation.status === 'cancelled') return conflict('취소된 단어 삭제 작업은 실행할 수 없습니다.'); const indexes = new Set<number>();
        for (const batch of operation.completedBatches) { const expected = payload.batches[batch.batchIndex]; if (!Number.isInteger(batch.batchIndex) || !expected || indexes.has(batch.batchIndex) || batch.payloadHash !== expected.payloadHash) return conflict('완료된 DB batch와 로컬 삭제 payload가 일치하지 않습니다.'); indexes.add(batch.batchIndex); }
        return operation.status === 'completed' && indexes.size !== payload.batches.length ? conflict('완료된 operation의 batch metadata가 완전하지 않습니다.') : ok(undefined);
    }
    private async run(operation: WordDeletionOperation, job: StoredWordDeletionJob, payload: WordDeletionPayload, onProgress?: (progress: DeletionProgress) => void): Promise<Result<WordDeletionRunResult>> {
        const completed = new Map(operation.completedBatches.map((batch) => [batch.batchIndex, batch])); let entries = 0; let batches = 0; for (const batch of payload.batches) if (completed.has(batch.batchIndex)) { entries += batch.entries.length; batches += 1; }
        this.progress(onProgress, 'applying', entries, payload, job.entries.length, batches);
        for (const batch of payload.batches) { if (completed.has(batch.batchIndex)) continue; const result = await this.operationGateway.deleteBatch({ operationId: operation.operationId, batchIndex: batch.batchIndex, totalBatches: payload.batches.length, payloadHash: batch.payloadHash, entries: batch.entries }); if (!result.ok) return result; entries += batch.entries.length; batches += 1; this.progress(onProgress, 'applying', entries, payload, job.entries.length, batches); }
        const final = await this.operationGateway.getOperation(operation.operationId); if (!final.ok) return final; const valid = this.validate(final.value, job, payload, true); if (!valid.ok) return valid; if (final.value.status !== 'completed') return conflict('DB operation이 아직 완료되지 않았습니다.');
        let aggregate = emptyResult(); for (const batch of payload.batches) { const result = final.value.completedBatches.find((completedBatch) => completedBatch.batchIndex === batch.batchIndex)?.result; if (result) aggregate = addResult(aggregate, result); }
        this.progress(onProgress, 'finalizing', job.entries.length, payload, job.entries.length, payload.batches.length); await this.jobStore.remove(operation.operationId); this.progress(onProgress, 'completed', job.entries.length, payload, job.entries.length, payload.batches.length); return ok({ operationId: operation.operationId, ...aggregate });
    }
    private progress(onProgress: ((progress: DeletionProgress) => void) | undefined, stage: DeletionProgress['stage'], completedEntries: number, payload: WordDeletionPayload, totalEntries: number, completedBatches = 0): void { onProgress?.({ stage, completedEntries, totalEntries, completedBatches, totalBatches: payload.batches.length }); }
}

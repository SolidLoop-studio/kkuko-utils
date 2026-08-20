import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import type { Result } from '@/src/shared/application/result';
import { err, ok } from '@/src/shared/application/result';
import { RunWordDeletionService } from '@/src/modules/word-moderation/application/run-word-deletion';
import type {
    DeletionProgress,
    DeleteWordBatchCommand,
    DeleteWordBatchResult,
    StartWordDeletionOperationInput,
    StoredWordDeletionJob,
    WordDeletionOperation,
} from '@/src/modules/word-moderation/application/word-deletion-types';
import type {
    WordDeletionJobStore,
    WordDeletionOperationGateway,
} from '@/src/modules/word-moderation/application/word-deletion-ports';

if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
}
if (!globalThis.TextEncoder) {
    Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: TextEncoder });
}

const INPUT_HASH = '000d198e4730bec9464d285c9227dd9aa00431a7100a70fd0491a5614dbf2645';
const BATCH_HASHES = [
    '0a1891bb52f8bc9d5cfa42cda3f9f3d2bca5c72ca26ba4996bb52863c29961c1',
    '6951f484bf17da976df9b08fd24ed63dbb70271d217ccf1948d797ddcf4f8371',
    '1edd879581443a9fb0d932a82b8cd773a14eb54439b4de31c07de45330db63d5',
];
const rawEntries = [{ word: '가방' }, { word: '나비' }, { word: '다람쥐' }];
const normalizedEntries = rawEntries;
const emptyResult = (): DeleteWordBatchResult => ({ deletedWordCount: 0, protectedWordCount: 0, missingWordCount: 0, processedRequestCount: 0, affectedDocsIds: [] });
const batchResult = (deletedWordCount: number, affectedDocsIds: number[]): DeleteWordBatchResult => ({
    deletedWordCount, protectedWordCount: deletedWordCount + 1, missingWordCount: deletedWordCount + 2,
    processedRequestCount: deletedWordCount + 3, affectedDocsIds,
});
const storedJob = (operationId = 'operation-1', batchSize = 1): StoredWordDeletionJob => ({ operationId, inputHash: INPUT_HASH, entries: normalizedEntries, batchSize, createdAt: '2026-08-21T00:00:00.000Z' });
const runningOperation = (completedBatches: WordDeletionOperation['completedBatches'] = []): WordDeletionOperation => ({ operationId: 'operation-1', inputHash: INPUT_HASH, totalEntries: 3, totalBatches: 3, completedBatches, status: 'running' });

class FakeStore implements WordDeletionJobStore {
    private readonly jobs = new Map<string, StoredWordDeletionJob>();
    readonly removed: string[] = [];
    readonly events: string[];
    constructor(events: string[]) { this.events = events; }
    async save(job: StoredWordDeletionJob): Promise<void> { this.events.push('store:save'); this.jobs.set(job.operationId, job); }
    async get(operationId: string): Promise<StoredWordDeletionJob | null> { this.events.push('store:get'); return this.jobs.get(operationId) ?? null; }
    async listPending(): Promise<StoredWordDeletionJob[]> { return [...this.jobs.values()]; }
    async remove(operationId: string): Promise<void> { this.events.push('store:remove'); this.removed.push(operationId); this.jobs.delete(operationId); }
}
class FakeGateway implements WordDeletionOperationGateway {
    operation: WordDeletionOperation | null = null;
    failBatch: number | null = null;
    complete = true;
    cancelResult: Result<void> = ok(undefined);
    readonly events: string[];
    readonly commands: DeleteWordBatchCommand[] = [];
    readonly started: StartWordDeletionOperationInput[] = [];
    readonly getResults: Result<WordDeletionOperation>[] = [];
    readonly results = new Map<number, DeleteWordBatchResult>();
    constructor(events: string[]) { this.events = events; }
    async startOperation(input: StartWordDeletionOperationInput): Promise<Result<WordDeletionOperation>> { this.events.push('gateway:start'); this.started.push(input); this.operation ??= { ...input, completedBatches: [], status: 'running' }; return ok(this.operation); }
    async getOperation(operationId: string): Promise<Result<WordDeletionOperation>> { this.events.push('gateway:get'); return this.getResults.shift() ?? (this.operation ? ok(this.operation) : err({ kind: 'not-found', message: 'not found' })); }
    async deleteBatch(command: DeleteWordBatchCommand): Promise<Result<DeleteWordBatchResult>> {
        this.events.push(`gateway:batch:${command.batchIndex}`); this.commands.push(command);
        if (this.failBatch === command.batchIndex) return err({ kind: 'infrastructure', message: 'failed' });
        const result = this.results.get(command.batchIndex) ?? emptyResult();
        if (this.operation) this.operation = { ...this.operation, completedBatches: [...this.operation.completedBatches, { batchIndex: command.batchIndex, payloadHash: command.payloadHash, result }], status: this.complete && this.operation.completedBatches.length + 1 === command.totalBatches ? 'completed' : 'running' };
        return ok(result);
    }
    async cancelOperation(operationId: string): Promise<Result<void>> { this.events.push(`gateway:cancel:${operationId}`); return this.cancelResult; }
}
const setup = (batchSize = 1) => { const events: string[] = []; const gateway = new FakeGateway(events); const store = new FakeStore(events); return { events, gateway, store, service: new RunWordDeletionService(gateway, store, () => 'operation-1', batchSize) }; };

describe('RunWordDeletionService', () => {
    it('saves before starting, deletes ordered batches, aggregates authoritative counts, and removes only after completion', async () => {
        const { events, gateway, service, store } = setup(2); const progress: DeletionProgress[] = [];
        gateway.results.set(0, batchResult(2, [10, 20])); gateway.results.set(1, batchResult(1, [20, 30]));
        await expect(service.start(rawEntries, (value) => progress.push(value))).resolves.toEqual(ok({ operationId: 'operation-1', deletedWordCount: 3, protectedWordCount: 5, missingWordCount: 7, processedRequestCount: 9, affectedDocsIds: [10, 20, 30] }));
        expect(events).toEqual(['store:save', 'gateway:start', 'gateway:batch:0', 'gateway:batch:1', 'gateway:get', 'store:remove']);
        expect(gateway.commands).toEqual([
            { operationId: 'operation-1', batchIndex: 0, totalBatches: 2, payloadHash: expect.any(String), entries: [{ word: '가방' }, { word: '나비' }] },
            { operationId: 'operation-1', batchIndex: 1, totalBatches: 2, payloadHash: expect.any(String), entries: [{ word: '다람쥐' }] },
        ]);
        expect(progress.map((value) => value.stage)).toEqual(['validating', 'applying', 'applying', 'applying', 'finalizing', 'completed']);
        expect(store.removed).toEqual(['operation-1']);
    });
    it('returns validation without saving or calling the gateway for invalid input', async () => {
        const { events, service } = setup();
        await expect(service.start([{ word: '' }])).resolves.toMatchObject({ ok: false, error: { kind: 'validation' } });
        expect(events).toEqual([]);
    });
    it('rejects a local input hash mismatch before gateway mutation', async () => {
        const { gateway, service, store } = setup(); await store.save({ ...storedJob(), inputHash: 'wrong' });
        await expect(service.resume('operation-1')).resolves.toMatchObject({ ok: false, error: { kind: 'conflict' } }); expect(gateway.commands).toEqual([]);
    });
    it('restarts a saved operation when the database reports not-found', async () => {
        const { gateway, service, store } = setup(); await store.save(storedJob()); gateway.getResults.push(err({ kind: 'not-found', message: 'not found' }));
        await expect(service.resume('operation-1')).resolves.toMatchObject({ ok: true }); expect(gateway.started).toEqual([{ operationId: 'operation-1', inputHash: INPUT_HASH, totalEntries: 3, totalBatches: 3 }]);
    });
    it('skips matching completed batches while resuming', async () => {
        const { gateway, service, store } = setup(); await store.save(storedJob()); gateway.operation = runningOperation([{ batchIndex: 0, payloadHash: BATCH_HASHES[0], result: batchResult(1, [1]) }]);
        await service.resume('operation-1'); expect(gateway.commands.map(({ batchIndex }) => batchIndex)).toEqual([1, 2]);
    });
    it.each([
        ['duplicate', [{ batchIndex: 0, payloadHash: BATCH_HASHES[0], result: emptyResult() }, { batchIndex: 0, payloadHash: BATCH_HASHES[0], result: emptyResult() }]],
        ['out-of-range', [{ batchIndex: 3, payloadHash: 'wrong', result: emptyResult() }]],
        ['hash-mismatched', [{ batchIndex: 0, payloadHash: 'wrong', result: emptyResult() }]],
    ])('returns conflict for %s completed metadata', async (_name, completedBatches) => {
        const { gateway, service, store } = setup(); await store.save(storedJob()); gateway.operation = runningOperation(completedBatches);
        await expect(service.resume('operation-1')).resolves.toMatchObject({ ok: false, error: { kind: 'conflict' } }); expect(gateway.commands).toEqual([]);
    });
    it('returns conflict for a cancelled operation', async () => { const { gateway, service, store } = setup(); await store.save(storedJob()); gateway.operation = { ...runningOperation(), status: 'cancelled' }; await expect(service.resume('operation-1')).resolves.toMatchObject({ ok: false, error: { kind: 'conflict' } }); });
    it('preserves the job after a batch failure', async () => { const { gateway, service, store } = setup(); gateway.failBatch = 1; await expect(service.start(rawEntries)).resolves.toMatchObject({ ok: false }); await expect(store.get('operation-1')).resolves.not.toBeNull(); });
    it('removes a job after successful completion', async () => { const { service, store } = setup(); await service.start(rawEntries); await expect(store.get('operation-1')).resolves.toBeNull(); });
    it('treats cancel not-found as success and removes the job', async () => { const { gateway, service, store } = setup(); await store.save(storedJob()); gateway.cancelResult = err({ kind: 'not-found', message: 'not found' }); await expect(service.cancel('operation-1')).resolves.toEqual(ok(undefined)); await expect(store.get('operation-1')).resolves.toBeNull(); });
    it('preserves the job when the final operation is not completed', async () => { const { gateway, service, store } = setup(); gateway.complete = false; await expect(service.start(rawEntries)).resolves.toMatchObject({ ok: false, error: { kind: 'conflict' } }); await expect(store.get('operation-1')).resolves.not.toBeNull(); });
    it('requires complete final batch metadata', async () => { const { gateway, service, store } = setup(); gateway.complete = false; gateway.getResults.push(ok({ ...runningOperation(), status: 'completed', completedBatches: [] })); await expect(service.start(rawEntries)).resolves.toMatchObject({ ok: false, error: { kind: 'conflict' } }); await expect(store.get('operation-1')).resolves.not.toBeNull(); });
});

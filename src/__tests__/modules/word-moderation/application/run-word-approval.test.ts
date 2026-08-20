import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import type { Result } from '@/src/shared/application/result';
import { err, ok } from '@/src/shared/application/result';
import { RunWordApprovalService } from '@/src/modules/word-moderation/application/run-word-approval';
import type {
    ApprovalProgress,
    ApproveWordBatchCommand,
    ApproveWordBatchResult,
    StartWordApprovalOperationInput,
    StoredWordApprovalJob,
    WordApprovalOperation,
} from '@/src/modules/word-moderation/application/word-approval-types';
import type {
    WordApprovalJobStore,
    WordApprovalOperationGateway,
} from '@/src/modules/word-moderation/application/ports';

if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: webcrypto,
    });
}

if (!globalThis.TextEncoder) {
    Object.defineProperty(globalThis, 'TextEncoder', {
        configurable: true,
        value: TextEncoder,
    });
}

const INPUT_HASH = '415e4e4aa15a6be0024de360004ac918711fd8ced59396662948a0e6db839b8e';
const SINGLE_BATCH_HASHES = [
    'cbd6f7316dba3be3fd8a6191ac84e3e7d8b0f6233214fae476761420e7b71b4c',
    'eef18fca013c0e7aaf8200815b60f100b6c90bf8fab4ed3ec99cd54b0e8825bd',
    'e2af49bb1b4a36a564e8c3cc6302b465380e16bf860f022e0340685e06937daa',
];

const rawEntries = [
    { word: '가방', themeCodes: ['11'] },
    { word: '나비', themeCodes: ['12'] },
    { word: '다람쥐', themeCodes: ['13'] },
];

const normalizedEntries = rawEntries.map((entry) => ({
    ...entry,
    noinCanUse: false,
}));

const emptyBatchResult = (): ApproveWordBatchResult => ({
    approvedWordCount: 0,
    addedThemeCount: 0,
    removedThemeCount: 0,
    processedRequestCount: 0,
    affectedDocsIds: [],
});

const batchResult = (
    approvedWordCount: number,
    affectedDocsIds: number[],
): ApproveWordBatchResult => ({
    approvedWordCount,
    addedThemeCount: approvedWordCount + 1,
    removedThemeCount: approvedWordCount + 2,
    processedRequestCount: approvedWordCount + 3,
    affectedDocsIds,
});

const storedJob = (operationId = 'operation-1', batchSize = 1): StoredWordApprovalJob => ({
    operationId,
    inputHash: INPUT_HASH,
    entries: normalizedEntries,
    batchSize,
    createdAt: '2026-08-20T00:00:00.000Z',
});

const runningOperation = (
    completedBatches: WordApprovalOperation['completedBatches'] = [],
): WordApprovalOperation => ({
    operationId: 'operation-1',
    inputHash: INPUT_HASH,
    totalEntries: 3,
    totalBatches: 3,
    completedBatches,
    status: 'running',
});

class FakeWordApprovalJobStore implements WordApprovalJobStore {
    private readonly jobs = new Map<string, StoredWordApprovalJob>();
    failSaveOperationId: string | null = null;
    readonly savedOperationIds: string[] = [];
    readonly removedOperationIds: string[] = [];
    listPendingCalls = 0;

    constructor(private readonly events: string[]) {}

    async save(job: StoredWordApprovalJob): Promise<void> {
        this.events.push('store:save');
        this.savedOperationIds.push(job.operationId);
        if (job.operationId === this.failSaveOperationId) {
            throw new Error('save failed');
        }
        this.jobs.set(job.operationId, job);
    }

    async get(operationId: string): Promise<StoredWordApprovalJob | null> {
        this.events.push('store:get');
        return this.jobs.get(operationId) ?? null;
    }

    async listPending(): Promise<StoredWordApprovalJob[]> {
        this.listPendingCalls += 1;
        return Array.from(this.jobs.values());
    }

    async remove(operationId: string): Promise<void> {
        this.events.push('store:remove');
        this.removedOperationIds.push(operationId);
        this.jobs.delete(operationId);
    }
}

class FakeWordApprovalOperationGateway implements WordApprovalOperationGateway {
    operation: WordApprovalOperation | null = null;
    failBatchIndex: number | null = null;
    doesCompleteAfterAllBatches = true;
    cancelResult: Result<void> = ok(undefined);
    readonly getOperationResults: Result<WordApprovalOperation>[] = [];
    readonly approvedIndexes: number[] = [];
    readonly approvedCommands: ApproveWordBatchCommand[] = [];
    readonly results = new Map<number, ApproveWordBatchResult>();
    readonly authoritativeResults = new Map<number, ApproveWordBatchResult>();

    constructor(private readonly events: string[]) {}

    async startOperation(
        input: StartWordApprovalOperationInput,
    ): Promise<Result<WordApprovalOperation>> {
        this.events.push('gateway:start');
        this.operation ??= {
            ...input,
            completedBatches: [],
            status: 'running',
        };
        return ok(this.operation);
    }

    async getOperation(operationId: string): Promise<Result<WordApprovalOperation>> {
        this.events.push('gateway:get');
        const queuedResult = this.getOperationResults.shift();
        if (queuedResult !== undefined) {
            return queuedResult;
        }
        if (this.operation === null) {
            return err({ kind: 'not-found', message: 'operation not found' });
        }
        return ok(this.operation);
    }

    async approveBatch(command: ApproveWordBatchCommand): Promise<Result<ApproveWordBatchResult>> {
        this.events.push(`gateway:batch:${command.batchIndex}`);
        this.approvedIndexes.push(command.batchIndex);
        this.approvedCommands.push(command);
        if (command.batchIndex === this.failBatchIndex) {
            return err({ kind: 'infrastructure', message: 'batch failed' });
        }

        const result = this.results.get(command.batchIndex) ?? emptyBatchResult();
        if (this.operation !== null) {
            const completedBatch = {
                batchIndex: command.batchIndex,
                payloadHash: command.payloadHash,
                result: this.authoritativeResults.get(command.batchIndex) ?? result,
            };
            this.operation = {
                ...this.operation,
                completedBatches: [
                    ...this.operation.completedBatches.filter(
                        (batch) => batch.batchIndex !== command.batchIndex,
                    ),
                    completedBatch,
                ],
                status:
                    this.doesCompleteAfterAllBatches
                    && this.operation.completedBatches.length + 1 === command.totalBatches
                        ? 'completed'
                        : 'running',
            };
        }

        return ok(result);
    }

    async cancelOperation(operationId: string): Promise<Result<void>> {
        this.events.push(`gateway:cancel:${operationId}`);
        return this.cancelResult;
    }
}

const setup = (batchSize = 1) => {
    const events: string[] = [];
    const gateway = new FakeWordApprovalOperationGateway(events);
    const store = new FakeWordApprovalJobStore(events);
    const service = new RunWordApprovalService(
        gateway,
        store,
        () => 'operation-1',
        batchSize,
    );
    return { events, gateway, service, store };
};

describe('RunWordApprovalService', () => {
    it('로컬 job을 먼저 저장한 뒤 operation을 시작하고 배치를 순서대로 실행한다', async () => {
        const { events, gateway, service } = setup(2);
        const progress: ApprovalProgress[] = [];
        gateway.results.set(0, batchResult(2, [10, 20]));
        gateway.results.set(1, batchResult(1, [20, 30]));

        const result = await service.start(rawEntries, (value) => progress.push(value));

        expect(result).toEqual(ok({
            operationId: 'operation-1',
            approvedWordCount: 3,
            addedThemeCount: 5,
            removedThemeCount: 7,
            processedRequestCount: 9,
            affectedDocsIds: [10, 20, 30],
        }));
        expect(events).toEqual([
            'store:save',
            'gateway:start',
            'gateway:batch:0',
            'gateway:batch:1',
            'gateway:get',
            'store:remove',
        ]);
        expect(progress).toEqual([
            { stage: 'validating', completedEntries: 0, totalEntries: 3, completedBatches: 0, totalBatches: 2 },
            { stage: 'applying', completedEntries: 0, totalEntries: 3, completedBatches: 0, totalBatches: 2 },
            { stage: 'applying', completedEntries: 2, totalEntries: 3, completedBatches: 1, totalBatches: 2 },
            { stage: 'applying', completedEntries: 3, totalEntries: 3, completedBatches: 2, totalBatches: 2 },
            { stage: 'finalizing', completedEntries: 3, totalEntries: 3, completedBatches: 2, totalBatches: 2 },
            { stage: 'completed', completedEntries: 3, totalEntries: 3, completedBatches: 2, totalBatches: 2 },
        ]);
    });

    it('두 번째 배치가 실패하면 이후 배치를 호출하지 않고 job을 보존한다', async () => {
        const { gateway, service, store } = setup();
        gateway.failBatchIndex = 1;

        const result = await service.start(rawEntries);

        expect(result).toMatchObject({ ok: false, error: { kind: 'infrastructure' } });
        expect(gateway.approvedIndexes).toEqual([0, 1]);
        expect(await store.get('operation-1')).not.toBeNull();
    });

    it('재개할 때 DB hash가 일치하는 완료 batch를 건너뛰고 완료분부터 progress와 결과를 합산한다', async () => {
        const { gateway, service, store } = setup();
        const completedBatches = [
            { batchIndex: 0, payloadHash: SINGLE_BATCH_HASHES[0], result: batchResult(1, [10, 20]) },
            { batchIndex: 1, payloadHash: SINGLE_BATCH_HASHES[1], result: batchResult(2, [20, 30]) },
        ];
        gateway.operation = runningOperation(completedBatches);
        gateway.results.set(2, batchResult(3, [30, 40]));
        await store.save(storedJob());
        const progress: ApprovalProgress[] = [];

        const result = await service.resume('operation-1', (value) => progress.push(value));

        expect(gateway.approvedIndexes).toEqual([2]);
        expect(result).toEqual(ok({
            operationId: 'operation-1',
            approvedWordCount: 6,
            addedThemeCount: 9,
            removedThemeCount: 12,
            processedRequestCount: 15,
            affectedDocsIds: [10, 20, 30, 40],
        }));
        expect(progress[1]).toEqual({
            stage: 'applying',
            completedEntries: 2,
            totalEntries: 3,
            completedBatches: 2,
            totalBatches: 3,
        });
        expect(progress.at(-1)).toEqual({
            stage: 'completed',
            completedEntries: 3,
            totalEntries: 3,
            completedBatches: 3,
            totalBatches: 3,
        });
    });

    it('DB input hash와 로컬 payload hash가 다르면 mutation을 호출하지 않는다', async () => {
        const { gateway, service, store } = setup();
        gateway.operation = { ...runningOperation(), inputHash: 'different' };
        await store.save(storedJob());

        const result = await service.resume('operation-1');

        expect(result).toMatchObject({ ok: false, error: { kind: 'conflict' } });
        expect(gateway.approvedIndexes).toEqual([]);
    });

    it.each([
        ['operation ID', { operationId: 'different' }],
        ['total entries', { totalEntries: 4 }],
        ['total batches', { totalBatches: 4 }],
        ['completed batch hash', {
            completedBatches: [{
                batchIndex: 0,
                payloadHash: 'different',
                result: emptyBatchResult(),
            }],
        }],
        ['duplicate completed batch index', {
            completedBatches: [
                { batchIndex: 0, payloadHash: SINGLE_BATCH_HASHES[0], result: emptyBatchResult() },
                { batchIndex: 0, payloadHash: SINGLE_BATCH_HASHES[0], result: emptyBatchResult() },
            ],
        }],
    ])('DB %s metadata가 로컬 payload와 다르면 어떤 batch도 실행하지 않는다', async (_name, patch) => {
        const { gateway, service, store } = setup();
        gateway.operation = { ...runningOperation(), ...patch };
        await store.save(storedJob());

        const result = await service.resume('operation-1');

        expect(result).toMatchObject({ ok: false, error: { kind: 'conflict' } });
        expect(gateway.approvedIndexes).toEqual([]);
    });

    it('같은 입력의 기존 operation ID를 받으면 candidate job을 교체한 뒤 기존 operation을 재개한다', async () => {
        const { events, gateway, service, store } = setup();
        gateway.operation = {
            ...runningOperation(),
            operationId: 'operation-existing',
        };

        const result = await service.start(rawEntries);

        expect(result).toMatchObject({ ok: true, value: { operationId: 'operation-existing' } });
        expect(store.savedOperationIds).toEqual(['operation-1', 'operation-existing']);
        expect(store.removedOperationIds).toEqual(['operation-1', 'operation-existing']);
        expect(events.slice(0, 4)).toEqual([
            'store:save',
            'gateway:start',
            'store:save',
            'store:remove',
        ]);
        expect(gateway.approvedCommands.every(
            (command) => command.operationId === 'operation-existing',
        )).toBe(true);
    });

    it('기존 operation ID job 저장이 실패하면 candidate job을 보존한다', async () => {
        const { gateway, service, store } = setup();
        gateway.operation = {
            ...runningOperation(),
            operationId: 'operation-existing',
        };
        store.failSaveOperationId = 'operation-existing';

        await expect(service.start(rawEntries)).rejects.toThrow('save failed');

        expect(store.removedOperationIds).toEqual([]);
        await expect(store.get('operation-1')).resolves.not.toBeNull();
        expect(gateway.approvedIndexes).toEqual([]);
    });

    it('최종 DB operation 결과를 authoritative aggregate로 반환한다', async () => {
        const { gateway, service } = setup(2);
        gateway.results.set(0, batchResult(100, [999]));
        gateway.results.set(1, batchResult(100, [999]));
        gateway.authoritativeResults.set(0, batchResult(2, [10, 20]));
        gateway.authoritativeResults.set(1, batchResult(1, [20, 30]));

        const result = await service.start(rawEntries);

        expect(result).toEqual(ok({
            operationId: 'operation-1',
            approvedWordCount: 3,
            addedThemeCount: 5,
            removedThemeCount: 7,
            processedRequestCount: 9,
            affectedDocsIds: [10, 20, 30],
        }));
    });

    it('최종 DB operation이 completed가 아니면 conflict를 반환하고 job을 보존한다', async () => {
        const { gateway, service, store } = setup();
        gateway.doesCompleteAfterAllBatches = false;
        const progress: ApprovalProgress[] = [];

        const result = await service.start(rawEntries, (value) => progress.push(value));

        expect(result).toMatchObject({ ok: false, error: { kind: 'conflict' } });
        await expect(store.get('operation-1')).resolves.not.toBeNull();
        expect(progress.map(({ stage }) => stage)).not.toContain('finalizing');
    });

    it('최종 DB operation 조회가 실패하면 error를 반환하고 job을 보존한다', async () => {
        const { gateway, service, store } = setup();
        gateway.getOperationResults.push(
            err({ kind: 'infrastructure', message: 'final read failed' }),
        );

        const result = await service.start(rawEntries);

        expect(result).toEqual(err({ kind: 'infrastructure', message: 'final read failed' }));
        await expect(store.get('operation-1')).resolves.not.toBeNull();
    });

    it('로컬 job이 없으면 totals progress를 만들지 않고 not-found를 반환한다', async () => {
        const { gateway, service } = setup();
        gateway.operation = runningOperation();
        const progress: ApprovalProgress[] = [];

        const result = await service.resume('operation-1', (value) => progress.push(value));

        expect(result).toMatchObject({ ok: false, error: { kind: 'not-found' } });
        expect(progress).toEqual([]);
        expect(gateway.approvedIndexes).toEqual([]);
    });

    it('pending job 목록을 store에 위임한다', async () => {
        const { service, store } = setup();
        await store.save(storedJob());

        await expect(service.listPending()).resolves.toEqual([storedJob()]);
        expect(store.listPendingCalls).toBe(1);
    });

    it('cancel은 gateway 성공 후에만 로컬 job을 제거한다', async () => {
        const { events, service, store } = setup();
        await store.save(storedJob());
        events.length = 0;

        await expect(service.cancel('operation-1')).resolves.toEqual(ok(undefined));

        expect(events).toEqual(['gateway:cancel:operation-1', 'store:remove']);
        await expect(store.get('operation-1')).resolves.toBeNull();
    });

    it('cancel gateway 실패 시 로컬 job을 보존한다', async () => {
        const { events, gateway, service, store } = setup();
        await store.save(storedJob());
        gateway.cancelResult = err({ kind: 'infrastructure', message: 'cancel failed' });
        events.length = 0;

        const result = await service.cancel('operation-1');

        expect(result).toEqual(gateway.cancelResult);
        expect(events).toEqual(['gateway:cancel:operation-1']);
        await expect(store.get('operation-1')).resolves.not.toBeNull();
    });
});

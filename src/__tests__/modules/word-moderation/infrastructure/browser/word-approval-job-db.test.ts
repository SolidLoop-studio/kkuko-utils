import { openDB } from 'idb';

import type { StoredWordApprovalJob } from '@/src/modules/word-moderation/application/word-approval-types';
import { IndexedDbWordApprovalJobStore } from '@/src/modules/word-moderation/infrastructure/browser/word-approval-job-db';

jest.mock('idb');

const job = (operationId: string, createdAt: string): StoredWordApprovalJob => ({
    operationId,
    inputHash: `input-${operationId}`,
    entries: [],
    batchSize: 10,
    createdAt,
});

describe('IndexedDbWordApprovalJobStore', () => {
    const objectStore = {
        put: jest.fn(),
        createIndex: jest.fn(),
    };
    const database = {
        transaction: jest.fn(),
        get: jest.fn(),
        getAll: jest.fn(),
        delete: jest.fn(),
        objectStoreNames: {
            contains: jest.fn(),
        },
        createObjectStore: jest.fn(),
    };
    const transaction = {
        objectStore: jest.fn(),
        done: Promise.resolve(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        database.objectStoreNames.contains.mockReturnValue(false);
        database.createObjectStore.mockReturnValue(objectStore);
        database.transaction.mockReturnValue(transaction);
        transaction.objectStore.mockReturnValue(objectStore);
        (openDB as jest.Mock).mockResolvedValue(database);
    });

    it('operationId를 key로 job을 저장하고 조회한다', async () => {
        const store = new IndexedDbWordApprovalJobStore();
        const storedJob = job('operation-1', '2026-08-20T10:00:00.000Z');
        database.get.mockResolvedValue(storedJob);

        await store.save(storedJob);

        expect(database.transaction).toHaveBeenCalledWith('word-approval-jobs', 'readwrite');
        expect(transaction.objectStore).toHaveBeenCalledWith('word-approval-jobs');
        expect(objectStore.put).toHaveBeenCalledWith(storedJob);
        await expect(store.get(storedJob.operationId)).resolves.toEqual(storedJob);
        expect(database.get).toHaveBeenCalledWith('word-approval-jobs', storedJob.operationId);
    });

    it('생성 시각 순서로 pending job을 반환한다', async () => {
        const store = new IndexedDbWordApprovalJobStore();
        const newerJob = job('newer', '2026-08-20T11:00:00.000Z');
        const olderJob = job('older', '2026-08-20T10:00:00.000Z');
        database.getAll.mockResolvedValue([newerJob, olderJob]);

        await expect(store.listPending()).resolves.toEqual([olderJob, newerJob]);
        expect(database.getAll).toHaveBeenCalledWith('word-approval-jobs');
    });

    it('완료한 operation payload를 삭제한다', async () => {
        const store = new IndexedDbWordApprovalJobStore();
        const storedJob = job('operation-1', '2026-08-20T10:00:00.000Z');

        await store.remove(storedJob.operationId);

        expect(database.delete).toHaveBeenCalledWith('word-approval-jobs', storedJob.operationId);
    });

    it('생성 시 object store와 생성 시각 index를 만든다', () => {
        new IndexedDbWordApprovalJobStore();

        const upgrade = (openDB as jest.Mock).mock.calls[0][2].upgrade;
        upgrade(database);

        expect(openDB).toHaveBeenCalledWith('KkukoUtilsOperations', 1, expect.any(Object));
        expect(database.createObjectStore).toHaveBeenCalledWith('word-approval-jobs', {
            keyPath: 'operationId',
        });
        expect(objectStore.createIndex).toHaveBeenCalledWith('by-created-at', 'createdAt');
    });
});

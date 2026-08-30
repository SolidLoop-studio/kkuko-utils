import { openDB } from 'idb';

import type { StoredWordDeletionJob } from '@/src/modules/word-moderation/application/word-deletion-types';
import { IndexedDbWordDeletionJobStore } from '@/src/modules/word-moderation/infrastructure/browser/word-deletion-job-db';

jest.mock('idb');

const job = (operationId: string, createdAt: string): StoredWordDeletionJob => ({
    operationId,
    inputHash: `input-${operationId}`,
    entries: [{ word: '가방' }],
    batchSize: 50,
    createdAt,
});

describe('IndexedDbWordDeletionJobStore', () => {
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

    it('saves and gets a job by its operation id', async () => {
        const store = new IndexedDbWordDeletionJobStore();
        const storedJob = job('operation-1', '2026-08-21T10:00:00.000Z');
        database.get.mockResolvedValue(storedJob);

        await store.save(storedJob);

        expect(database.transaction).toHaveBeenCalledWith('word-deletion-jobs', 'readwrite');
        expect(transaction.objectStore).toHaveBeenCalledWith('word-deletion-jobs');
        expect(objectStore.put).toHaveBeenCalledWith(storedJob);
        await expect(store.get(storedJob.operationId)).resolves.toEqual(storedJob);
        expect(database.get).toHaveBeenCalledWith('word-deletion-jobs', storedJob.operationId);
    });

    it('returns null when the requested job does not exist', async () => {
        const store = new IndexedDbWordDeletionJobStore();
        database.get.mockResolvedValue(undefined);

        await expect(store.get('missing-operation')).resolves.toBeNull();
    });

    it('returns pending jobs in stable createdAt order', async () => {
        const store = new IndexedDbWordDeletionJobStore();
        const newerJob = job('newer', '2026-08-21T11:00:00.000Z');
        const olderJob = job('older', '2026-08-21T10:00:00.000Z');
        database.getAll.mockResolvedValue([newerJob, olderJob]);

        await expect(store.listPending()).resolves.toEqual([olderJob, newerJob]);
        expect(database.getAll).toHaveBeenCalledWith('word-deletion-jobs');
    });

    it('removes a completed operation payload', async () => {
        const store = new IndexedDbWordDeletionJobStore();

        await store.remove('operation-1');

        expect(database.delete).toHaveBeenCalledWith('word-deletion-jobs', 'operation-1');
    });

    it('lazily creates a deletion-only database, key path, and createdAt index', async () => {
        const store = new IndexedDbWordDeletionJobStore();

        expect(openDB).not.toHaveBeenCalled();

        await store.listPending();

        const upgrade = (openDB as jest.Mock).mock.calls[0][2].upgrade;
        upgrade(database);

        expect(openDB).toHaveBeenCalledWith('KkukoUtilsWordDeletionOperations', 1, expect.any(Object));
        expect(database.createObjectStore).toHaveBeenCalledWith('word-deletion-jobs', {
            keyPath: 'operationId',
        });
        expect(objectStore.createIndex).toHaveBeenCalledWith('by-created-at', 'createdAt');
    });
});

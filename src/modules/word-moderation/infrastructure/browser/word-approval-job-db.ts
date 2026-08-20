import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { WordApprovalJobStore } from '@/src/modules/word-moderation/application/ports';
import type { StoredWordApprovalJob } from '@/src/modules/word-moderation/application/word-approval-types';

interface WordApprovalDatabaseSchema extends DBSchema {
    'word-approval-jobs': {
        key: string;
        value: StoredWordApprovalJob;
        indexes: {
            'by-created-at': string;
        };
    };
}

const DATABASE_NAME = 'KkukoUtilsOperations';
const DATABASE_VERSION = 1;
const STORE_NAME = 'word-approval-jobs';
const CREATED_AT_INDEX = 'by-created-at';

export class IndexedDbWordApprovalJobStore implements WordApprovalJobStore {
    private readonly database: Promise<IDBPDatabase<WordApprovalDatabaseSchema>>;

    constructor() {
        this.database = openDB<WordApprovalDatabaseSchema>(DATABASE_NAME, DATABASE_VERSION, {
            upgrade(database) {
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    const objectStore = database.createObjectStore(STORE_NAME, {
                        keyPath: 'operationId',
                    });
                    objectStore.createIndex(CREATED_AT_INDEX, 'createdAt');
                }
            },
        });
    }

    async save(job: StoredWordApprovalJob): Promise<void> {
        const database = await this.database;
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        await transaction.objectStore(STORE_NAME).put(job);
        await transaction.done;
    }

    async get(operationId: string): Promise<StoredWordApprovalJob | null> {
        const database = await this.database;
        const job = await database.get(STORE_NAME, operationId);
        return job ?? null;
    }

    async listPending(): Promise<StoredWordApprovalJob[]> {
        const database = await this.database;
        const jobs = await database.getAll(STORE_NAME);
        return jobs.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }

    async remove(operationId: string): Promise<void> {
        const database = await this.database;
        await database.delete(STORE_NAME, operationId);
    }
}

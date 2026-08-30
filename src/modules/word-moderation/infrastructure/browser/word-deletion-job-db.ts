import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { WordDeletionJobStore } from '@/src/modules/word-moderation/application/word-deletion-ports';
import type { StoredWordDeletionJob } from '@/src/modules/word-moderation/application/word-deletion-types';

interface WordDeletionDatabaseSchema extends DBSchema {
    'word-deletion-jobs': {
        key: string;
        value: StoredWordDeletionJob;
        indexes: {
            'by-created-at': string;
        };
    };
}

const DATABASE_NAME = 'KkukoUtilsWordDeletionOperations';
const DATABASE_VERSION = 1;
const STORE_NAME = 'word-deletion-jobs';
const CREATED_AT_INDEX = 'by-created-at';

/** 브라우저에 재개 가능한 단어 삭제 작업을 저장한다. */
export class IndexedDbWordDeletionJobStore implements WordDeletionJobStore {
    private database?: Promise<IDBPDatabase<WordDeletionDatabaseSchema>>;

    private async getDatabase(): Promise<IDBPDatabase<WordDeletionDatabaseSchema>> {
        this.database ??= openDB<WordDeletionDatabaseSchema>(DATABASE_NAME, DATABASE_VERSION, {
            upgrade(database) {
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    const objectStore = database.createObjectStore(STORE_NAME, {
                        keyPath: 'operationId',
                    });
                    objectStore.createIndex(CREATED_AT_INDEX, 'createdAt');
                }
            },
        });

        return this.database;
    }

    async save(job: StoredWordDeletionJob): Promise<void> {
        const database = await this.getDatabase();
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        await transaction.objectStore(STORE_NAME).put(job);
        await transaction.done;
    }

    async get(operationId: string): Promise<StoredWordDeletionJob | null> {
        const database = await this.getDatabase();
        const job = await database.get(STORE_NAME, operationId);
        return job ?? null;
    }

    async listPending(): Promise<StoredWordDeletionJob[]> {
        const database = await this.getDatabase();
        const jobs = await database.getAll(STORE_NAME);
        return jobs.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }

    async remove(operationId: string): Promise<void> {
        const database = await this.getDatabase();
        await database.delete(STORE_NAME, operationId);
    }
}

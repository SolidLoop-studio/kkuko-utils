import type { Result } from '@/src/shared/application/result';
import type { DeleteWordBatchCommand, DeleteWordBatchResult, StartWordDeletionOperationInput, StoredWordDeletionJob, WordDeletionOperation } from './word-deletion-types';

export interface WordDeletionOperationGateway { startOperation(input: StartWordDeletionOperationInput): Promise<Result<WordDeletionOperation>>; getOperation(operationId: string): Promise<Result<WordDeletionOperation>>; deleteBatch(command: DeleteWordBatchCommand): Promise<Result<DeleteWordBatchResult>>; cancelOperation(operationId: string): Promise<Result<void>>; }
export interface WordDeletionJobStore { save(job: StoredWordDeletionJob): Promise<void>; get(operationId: string): Promise<StoredWordDeletionJob | null>; listPending(): Promise<StoredWordDeletionJob[]>; remove(operationId: string): Promise<void>; }

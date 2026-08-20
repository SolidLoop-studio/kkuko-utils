import type { NormalizedWordDeletionEntry } from '@/src/modules/word-moderation/domain/word-deletion';

export type WordDeletionOperationStatus = 'running' | 'completed' | 'cancelled';
export interface DeleteWordBatchResult { deletedWordCount: number; protectedWordCount: number; missingWordCount: number; processedRequestCount: number; affectedDocsIds: number[]; }
export interface WordDeletionOperation { operationId: string; inputHash: string; totalEntries: number; totalBatches: number; completedBatches: Array<{ batchIndex: number; payloadHash: string; result: DeleteWordBatchResult }>; status: WordDeletionOperationStatus; }
export interface StoredWordDeletionJob { operationId: string; inputHash: string; entries: NormalizedWordDeletionEntry[]; batchSize: number; createdAt: string; }
export interface WordDeletionPayloadBatch { batchIndex: number; payloadHash: string; entries: NormalizedWordDeletionEntry[]; }
export interface WordDeletionPayload { inputHash: string; batches: WordDeletionPayloadBatch[]; }
export interface StartWordDeletionOperationInput { operationId: string; inputHash: string; totalEntries: number; totalBatches: number; }
export interface DeleteWordBatchCommand { operationId: string; batchIndex: number; totalBatches: number; payloadHash: string; entries: NormalizedWordDeletionEntry[]; }
export interface WordDeletionRunResult extends DeleteWordBatchResult { operationId: string; }
export interface DeletionProgress { completedEntries: number; totalEntries: number; completedBatches: number; totalBatches: number; stage: 'validating' | 'applying' | 'finalizing' | 'completed'; }

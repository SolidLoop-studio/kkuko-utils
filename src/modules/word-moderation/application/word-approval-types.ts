import type { NormalizedWordApprovalEntry } from '@/src/modules/word-moderation/domain/word-approval';

export type WordApprovalOperationStatus = 'running' | 'completed' | 'cancelled';

export interface WordApprovalOperation {
    operationId: string;
    inputHash: string;
    totalEntries: number;
    totalBatches: number;
    completedBatches: Array<{
        batchIndex: number;
        payloadHash: string;
        result: ApproveWordBatchResult;
    }>;
    status: WordApprovalOperationStatus;
}

export interface ApproveWordBatchResult {
    approvedWordCount: number;
    addedThemeCount: number;
    removedThemeCount: number;
    processedRequestCount: number;
    affectedDocsIds: number[];
}

export interface StoredWordApprovalJob {
    operationId: string;
    inputHash: string;
    entries: NormalizedWordApprovalEntry[];
    batchSize: number;
    createdAt: string;
}

export interface ApprovalBatch {
    batchIndex: number;
    payloadHash: string;
    entries: NormalizedWordApprovalEntry[];
}

export interface WordApprovalPayload {
    inputHash: string;
    batches: ApprovalBatch[];
}

export interface StartWordApprovalOperationInput {
    operationId: string;
    inputHash: string;
    totalEntries: number;
    totalBatches: number;
}

export interface WordApprovalRunResult extends ApproveWordBatchResult {
    operationId: string;
}

export interface ApprovalProgress {
    completedEntries: number;
    totalEntries: number;
    completedBatches: number;
    totalBatches: number;
    stage: 'validating' | 'applying' | 'finalizing' | 'completed';
}

export interface ApproveWordBatchCommand {
    operationId: string;
    batchIndex: number;
    totalBatches: number;
    payloadHash: string;
    entries: NormalizedWordApprovalEntry[];
}

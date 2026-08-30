import type { Result } from '@/src/shared/application/result';
import type {
    ApproveWordBatchCommand,
    ApproveWordBatchResult,
    StartWordApprovalOperationInput,
    StoredWordApprovalJob,
    WordApprovalOperation,
} from './word-approval-types';
import type {
    ModerateWordRequestsCommand,
    WordRequestModerationResult,
} from './word-request-moderation-types';

export interface WordApprovalOperationGateway {
    startOperation(input: StartWordApprovalOperationInput): Promise<Result<WordApprovalOperation>>;
    getOperation(operationId: string): Promise<Result<WordApprovalOperation>>;
    approveBatch(command: ApproveWordBatchCommand): Promise<Result<ApproveWordBatchResult>>;
    cancelOperation(operationId: string): Promise<Result<void>>;
}

export interface WordApprovalJobStore {
    save(job: StoredWordApprovalJob): Promise<void>;
    get(operationId: string): Promise<StoredWordApprovalJob | null>;
    listPending(): Promise<StoredWordApprovalJob[]>;
    remove(operationId: string): Promise<void>;
}

export interface WordRequestModerationGateway {
    approve(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>>;
    reject(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>>;
}

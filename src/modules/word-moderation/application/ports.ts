import type { Result } from '@/src/shared/application/result';
import type {
    ApproveWordBatchCommand,
    ApproveWordBatchResult,
    StartWordApprovalOperationInput,
    StoredWordApprovalJob,
    WordApprovalOperation,
} from './word-approval-types';

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

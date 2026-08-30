import type { Result } from '@/src/shared/application/result';
import type {
    RequestWordAdditionCommand,
    RequestWordAdditionResult,
    RequestWordAdditionsCommand,
    RequestWordAdditionsProgressListener,
    RequestWordAdditionsResult,
    UserWordRequestCommand,
    UserWordRequestResult,
} from './user-word-request-types';

export interface UserWordRequestGateway {
    requestAddition(command: RequestWordAdditionCommand): Promise<Result<RequestWordAdditionResult>>;
    requestAdditions(
        command: RequestWordAdditionsCommand,
        onProgress?: RequestWordAdditionsProgressListener,
    ): Promise<Result<RequestWordAdditionsResult>>;
    requestDeletion(command: UserWordRequestCommand): Promise<Result<UserWordRequestResult>>;
    cancel(command: UserWordRequestCommand): Promise<Result<UserWordRequestResult>>;
}

import type { Result } from '@/src/shared/application/result';
import type {
    UserWordRequestCommand,
    UserWordRequestResult,
} from './user-word-request-types';

export interface UserWordRequestGateway {
    requestDeletion(command: UserWordRequestCommand): Promise<Result<UserWordRequestResult>>;
    cancel(command: UserWordRequestCommand): Promise<Result<UserWordRequestResult>>;
}

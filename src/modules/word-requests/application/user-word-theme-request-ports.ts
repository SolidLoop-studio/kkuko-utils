import type { Result } from '@/src/shared/application/result';
import type {
    RequestWordThemeChangesCommand,
    RequestWordThemeChangesResult,
} from './user-word-theme-request-types';

export interface UserWordThemeRequestGateway {
    requestThemeChanges(
        command: RequestWordThemeChangesCommand,
    ): Promise<Result<RequestWordThemeChangesResult>>;
}

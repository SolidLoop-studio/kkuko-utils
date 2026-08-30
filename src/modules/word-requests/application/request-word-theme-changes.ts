import { normalizeUserWordThemeChangesCommand } from '../domain/user-word-theme-request';
import type { UserWordThemeRequestGateway } from './user-word-theme-request-ports';
import type {
    RequestWordThemeChangesCommand,
    RequestWordThemeChangesResult,
} from './user-word-theme-request-types';
import type { Result } from '@/src/shared/application/result';

export class RequestWordThemeChangesService {
    constructor(private readonly gateway: UserWordThemeRequestGateway) {}

    async execute(
        command: RequestWordThemeChangesCommand,
    ): Promise<Result<RequestWordThemeChangesResult>> {
        const normalized = normalizeUserWordThemeChangesCommand(command);
        return normalized.ok
            ? this.gateway.requestThemeChanges(normalized.value)
            : normalized;
    }
}

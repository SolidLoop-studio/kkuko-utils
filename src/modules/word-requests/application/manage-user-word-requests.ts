import {
    normalizeRequestWordAdditionCommand,
    normalizeRequestWordAdditionsCommand,
    normalizeUserWordRequestCommand,
} from '@/src/modules/word-requests/domain/user-word-request';
import type { UserWordRequestGateway } from './user-word-request-ports';
import type {
    RequestWordAdditionCommand,
    RequestWordAdditionsCommand,
    RequestWordAdditionsProgressListener,
    UserWordRequestCommand,
} from './user-word-request-types';

export class ManageUserWordRequestsService {
    constructor(private readonly gateway: UserWordRequestGateway) {}

    async requestAddition(command: RequestWordAdditionCommand) {
        const normalized = normalizeRequestWordAdditionCommand(command);
        return normalized.ok ? this.gateway.requestAddition(normalized.value) : normalized;
    }

    async requestAdditions(
        command: RequestWordAdditionsCommand,
        onProgress?: RequestWordAdditionsProgressListener,
    ) {
        const normalized = normalizeRequestWordAdditionsCommand(command);
        return normalized.ok
            ? this.gateway.requestAdditions(normalized.value, onProgress)
            : normalized;
    }

    async requestDeletion(command: UserWordRequestCommand) {
        const normalized = normalizeUserWordRequestCommand(command);
        return normalized.ok ? this.gateway.requestDeletion(normalized.value) : normalized;
    }

    async cancel(command: UserWordRequestCommand) {
        const normalized = normalizeUserWordRequestCommand(command);
        return normalized.ok ? this.gateway.cancel(normalized.value) : normalized;
    }
}

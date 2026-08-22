import { normalizeUserWordRequestCommand } from '@/src/modules/word-requests/domain/user-word-request';
import type { UserWordRequestGateway } from './user-word-request-ports';
import type { UserWordRequestCommand } from './user-word-request-types';

export class ManageUserWordRequestsService {
    constructor(private readonly gateway: UserWordRequestGateway) {}

    async requestDeletion(command: UserWordRequestCommand) {
        const normalized = normalizeUserWordRequestCommand(command);
        return normalized.ok ? this.gateway.requestDeletion(normalized.value) : normalized;
    }

    async cancel(command: UserWordRequestCommand) {
        const normalized = normalizeUserWordRequestCommand(command);
        return normalized.ok ? this.gateway.cancel(normalized.value) : normalized;
    }
}

import type { Result } from '@/src/shared/application/result';
import type { DocsCreationRequestCommand } from './docs-creation-request-types';

export interface DocsCreationRequestGateway {
    request(command: DocsCreationRequestCommand): Promise<Result<void>>;
}

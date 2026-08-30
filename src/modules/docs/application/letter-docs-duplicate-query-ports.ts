import type { Result } from '@/src/shared/application/result';

export interface LetterDocsDuplicateQueryGateway {
    existsByName(docsName: string): Promise<Result<boolean>>;
}

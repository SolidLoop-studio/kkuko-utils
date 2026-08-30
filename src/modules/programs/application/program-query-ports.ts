import type { Result } from '@/src/shared/application/result';
import type { ProgramCategory, ProgramQuery, ProgramRelease, ReleasePagination } from './program-query-types';

export interface ProgramQueryGateway {
    list(category: ProgramCategory): Promise<Result<ProgramQuery[]>>;
    findById(id: number): Promise<Result<ProgramQuery | null>>;
}

export interface ProgramReleaseGateway {
    latest(repository: string): Promise<Result<ProgramRelease>>;
    list(repository: string, pagination: ReleasePagination): Promise<Result<ProgramRelease[]>>;
}

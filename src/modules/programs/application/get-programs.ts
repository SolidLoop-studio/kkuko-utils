import { err, ok, type Result } from '@/src/shared/application/result';
import type { ProgramQueryGateway, ProgramReleaseGateway } from './program-query-ports';
import type { ProgramCategory, ProgramRelease, ProgramWithUpdatedAt, ReleasePagination } from './program-query-types';

const infrastructureError = () => ({
    kind: 'infrastructure' as const,
    message: '프로그램 정보를 불러오는 중 오류가 발생했습니다.',
});

const isCategory = (value: string): value is ProgramCategory => (
    value === 'all' || value === 'tool' || value === 'util' || value === 'other'
);

/** 프로그램과 GitHub 릴리즈 조회를 조합하는 애플리케이션 서비스입니다. */
export class GetProgramsService {
    constructor(
        private readonly programGateway: ProgramQueryGateway,
        private readonly releaseGateway: ProgramReleaseGateway,
    ) {}

    async list(category: string): Promise<Result<ProgramWithUpdatedAt[]>> {
        try {
            const programs = await this.programGateway.list(isCategory(category) ? category : 'all');
            if (!programs.ok) return err(infrastructureError());
            if (programs.value.length === 0) return ok([]);

            const enriched = await Promise.all(programs.value.map(async (program) => {
                const release = await this.releaseGateway.latest(program.githubRepo);
                return release.ok ? { ...program, updatedAt: release.value.publishedAt } : null;
            }));
            const successful = enriched.filter((program): program is ProgramWithUpdatedAt => program !== null);
            return successful.length === 0 ? err(infrastructureError()) : ok(successful);
        } catch {
            return err(infrastructureError());
        }
    }

    async byId(id: number): Promise<Result<ProgramWithUpdatedAt | null>> {
        try {
            const program = await this.programGateway.findById(id);
            if (!program.ok) return err(infrastructureError());
            if (program.value === null) return ok(null);
            const release = await this.releaseGateway.latest(program.value.githubRepo);
            return release.ok
                ? ok({ ...program.value, updatedAt: release.value.updatedAt })
                : err(infrastructureError());
        } catch {
            return err(infrastructureError());
        }
    }

    async releases(repository: string, pagination: ReleasePagination): Promise<Result<ProgramRelease[]>> {
        try {
            const releases = await this.releaseGateway.list(repository, pagination);
            return releases.ok ? releases : err(infrastructureError());
        } catch {
            return err(infrastructureError());
        }
    }

    async latestRelease(repository: string): Promise<Result<ProgramRelease>> {
        try {
            const release = await this.releaseGateway.latest(repository);
            return release.ok ? release : err(infrastructureError());
        } catch {
            return err(infrastructureError());
        }
    }
}

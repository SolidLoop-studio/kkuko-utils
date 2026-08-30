import { err, type Result } from '@/src/shared/application/result';
import type { GithubReleaseQueryGateway } from './release-note-query-ports';
import type { GithubReleaseNote } from './release-note-query-types';

const infrastructureError = () => ({
    kind: 'infrastructure' as const,
    message: 'GitHub 릴리즈를 불러오는 중 오류가 발생했습니다.',
});

/** GitHub 릴리즈를 공개 오류 계약으로 조회합니다. */
export class GetGithubReleasesService {
    constructor(private readonly gateway: GithubReleaseQueryGateway) {}

    async get(): Promise<Result<GithubReleaseNote[]>> {
        try {
            const result = await this.gateway.load();
            return result.ok ? result : err(infrastructureError());
        } catch {
            return err(infrastructureError());
        }
    }
}

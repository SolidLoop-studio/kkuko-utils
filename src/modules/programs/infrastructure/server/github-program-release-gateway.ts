import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { ProgramReleaseGateway } from '../../application/program-query-ports';
import type { ProgramRelease, ProgramReleaseAsset, ReleasePagination } from '../../application/program-query-types';

interface GithubResponse { ok: boolean; json(): Promise<unknown>; }
export type GithubProgramFetch = (input: string, init: {
    headers: Record<string, string>;
    next: { revalidate: number };
}) => Promise<GithubResponse>;

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: 'GitHub 릴리즈를 불러오는 중 오류가 발생했습니다.',
});
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isPositiveSafeInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const isNonNegativeSafeInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isString = (value: unknown): value is string => typeof value === 'string';
const isNonBlankString = (value: unknown): value is string => isString(value) && value.trim().length > 0;
const isNullableString = (value: unknown): value is string | null => isString(value) || value === null;

const parseAsset = (value: unknown): ProgramReleaseAsset | null => {
    if (!isRecord(value) || !isPositiveSafeInteger(value.id) || !isNonBlankString(value.name)
        || !isNonNegativeSafeInteger(value.download_count) || !isNonNegativeSafeInteger(value.size)
        || !isNonBlankString(value.browser_download_url) || !isNonBlankString(value.content_type)) return null;
    return { id: value.id, name: value.name, downloadCount: value.download_count, size: value.size, browserDownloadUrl: value.browser_download_url, contentType: value.content_type };
};

const parseRelease = (value: unknown): ProgramRelease | null => {
    if (!isRecord(value) || !isPositiveSafeInteger(value.id) || !isNonBlankString(value.tag_name)
        || !isNullableString(value.name) || !isNullableString(value.body) || !isNonBlankString(value.published_at)
        || !Array.isArray(value.assets) || !isNonBlankString(value.html_url)
        || typeof value.prerelease !== 'boolean' || typeof value.draft !== 'boolean' || !isNonBlankString(value.updated_at)) return null;
    const assets = value.assets.map(parseAsset);
    if (assets.some((asset) => asset === null)) return null;
    return { id: value.id, tagName: value.tag_name, name: value.name ?? '', body: value.body ?? '', publishedAt: value.published_at, assets: assets as ProgramReleaseAsset[], htmlUrl: value.html_url, prerelease: value.prerelease, draft: value.draft, updatedAt: value.updated_at };
};

/** GitHub JSON을 검증하여 공개 릴리즈 projection으로 변환합니다. */
export class GithubProgramReleaseGateway implements ProgramReleaseGateway {
    constructor(private readonly fetcher: GithubProgramFetch = (input, init) => fetch(input, init)) {}

    async latest(repository: string): Promise<Result<ProgramRelease>> {
        return this.loadOne(`https://api.github.com/repos/${repository}/releases/latest`);
    }

    async list(repository: string, pagination: ReleasePagination): Promise<Result<ProgramRelease[]>> {
        try {
            const response = await this.fetcher(
                `https://api.github.com/repos/${repository}/releases?page=${pagination.page}&per_page=${pagination.perPage}`,
                this.options(),
            );
            if (!response.ok) return err(infrastructureError());
            const payload = await response.json();
            if (!Array.isArray(payload)) return err(infrastructureError());
            const releases = payload.map(parseRelease);
            return releases.some((release) => release === null)
                ? err(infrastructureError())
                : ok(releases as ProgramRelease[]);
        } catch {
            return err(infrastructureError());
        }
    }

    private async loadOne(url: string): Promise<Result<ProgramRelease>> {
        try {
            const response = await this.fetcher(url, this.options());
            if (!response.ok) return err(infrastructureError());
            const release = parseRelease(await response.json());
            return release === null ? err(infrastructureError()) : ok(release);
        } catch {
            return err(infrastructureError());
        }
    }

    private options(): { headers: Record<string, string>; next: { revalidate: number } } {
        return {
            headers: {
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'kkuko-utils',
                ...(process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : {}),
            },
            next: { revalidate: 300 },
        };
    }
}

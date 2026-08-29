import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { GithubReleaseQueryGateway as GithubReleaseQueryGatewayPort } from '../../application/release-note-query-ports';
import type { GithubReleaseNote } from '../../application/release-note-query-types';

const GITHUB_RELEASES_URL = 'https://api.github.com/repos/SolidLoop-studio/kkuko-utils/releases';

interface GithubResponse {
    ok: boolean;
    json(): Promise<unknown>;
}

type GithubFetch = (
    input: string,
    init: { headers: { Accept: 'application/vnd.github+json' } },
) => Promise<GithubResponse>;

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: 'GitHub 릴리즈를 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

const isValidDateString = (value: unknown): value is string => (
    typeof value === 'string' && !Number.isNaN(Date.parse(value))
);

const isNullableString = (value: unknown): value is string | null => (
    typeof value === 'string' || value === null
);

const parseRow = (value: unknown): GithubReleaseNote | null => {
    if (!isRecord(value)
        || !isPositiveSafeInteger(value.id)
        || !isNullableString(value.name)
        || !isNullableString(value.body)
        || !isValidDateString(value.published_at)
        || typeof value.html_url !== 'string'
        || typeof value.tag_name !== 'string') {
        return null;
    }

    return {
        id: value.id,
        name: value.name ?? '',
        body: value.body ?? '',
        publishedAt: value.published_at,
        htmlUrl: value.html_url,
        tagName: value.tag_name,
    };
};

/** GitHub API의 알 수 없는 JSON을 안전한 릴리즈 projection으로 변환합니다. */
export class GithubReleaseQueryGateway implements GithubReleaseQueryGatewayPort {
    constructor(
        private readonly fetcher: GithubFetch = (input, init) => fetch(input, init),
    ) {}

    async load(): Promise<Result<GithubReleaseNote[]>> {
        try {
            const response = await this.fetcher(GITHUB_RELEASES_URL, {
                headers: { Accept: 'application/vnd.github+json' },
            });
            if (!response.ok) return err(infrastructureError());

            const payload = await response.json();
            if (!Array.isArray(payload)) return err(infrastructureError());

            const releases: GithubReleaseNote[] = [];
            for (const value of payload) {
                const release = parseRow(value);
                if (release === null) return err(infrastructureError());
                releases.push(release);
            }
            return ok(releases);
        } catch {
            return err(infrastructureError());
        }
    }
}

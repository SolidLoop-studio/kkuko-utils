import { GithubReleaseQueryGateway } from '@/src/modules/release-notes/infrastructure/browser/github-release-query-gateway';
import { err, ok } from '@/src/shared/application/result';

const githubRow = {
    id: 11,
    name: null,
    body: null,
    published_at: '2026-08-30T06:30:00.456-04:30',
    html_url: 'https://github.com/SolidLoop-studio/kkuko-utils/releases/tag/v2',
    tag_name: 'v2',
};

const expectedError = err({
    kind: 'infrastructure' as const,
    message: 'GitHub 릴리즈를 불러오는 중 오류가 발생했습니다.',
});

describe('GithubReleaseQueryGateway', () => {
    test('uses the required GitHub URL/header and maps nullable text to a safe projection', async () => {
        // Break caught: calling the wrong repository/media type or exposing GitHub snake_case/nulls.
        const fetcher = jest.fn(async () => ({
            ok: true,
            json: async () => [githubRow],
        }));
        const gateway = new GithubReleaseQueryGateway(fetcher as never);

        await expect(gateway.load()).resolves.toEqual(ok([{
            id: 11,
            name: '',
            body: '',
            publishedAt: '2026-08-30T06:30:00.456-04:30',
            htmlUrl: 'https://github.com/SolidLoop-studio/kkuko-utils/releases/tag/v2',
            tagName: 'v2',
        }]));
        expect(fetcher).toHaveBeenCalledWith(
            'https://api.github.com/repos/SolidLoop-studio/kkuko-utils/releases',
            { headers: { Accept: 'application/vnd.github+json' } },
        );
    });

    test.each([
        ['non-array JSON', githubRow],
        ['malformed row', [{ ...githubRow, html_url: 42 }]],
        ['invalid publication date', [{ ...githubRow, published_at: 'not-a-date' }]],
        ['a parseable non-timestamp', [{ ...githubRow, published_at: '0' }]],
        ['an impossible calendar date', [{ ...githubRow, published_at: '2026-02-30T01:00:00Z' }]],
        ['an impossible time', [{ ...githubRow, published_at: '2026-08-30T24:01:00Z' }]],
    ])('rejects %s without exposing the unknown JSON', async (_label, payload) => {
        // Break caught: casting unknown GitHub JSON directly into the UI model.
        const fetcher = jest.fn(async () => ({ ok: true, json: async () => payload }));
        const gateway = new GithubReleaseQueryGateway(fetcher as never);

        await expect(gateway.load()).resolves.toEqual(expectedError);
    });

    test.each([
        ['HTTP non-OK', async () => ({ ok: false, status: 503, json: async () => ({ private: 'body' }) })],
        ['JSON rejection', async () => ({ ok: true, json: async () => { throw new Error('private body'); } })],
        ['fetch rejection', async () => { throw new Error('private network detail'); }],
    ])('maps %s to one stable public error', async (_label, implementation) => {
        // Break caught: leaking status/body/network diagnostics or a rejected fetch.
        const fetcher = jest.fn(implementation as () => Promise<unknown>);
        const gateway = new GithubReleaseQueryGateway(fetcher as never);

        await expect(gateway.load()).resolves.toEqual(expectedError);
    });
});

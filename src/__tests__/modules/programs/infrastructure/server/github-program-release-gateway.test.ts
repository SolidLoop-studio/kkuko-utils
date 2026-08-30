import { GithubProgramReleaseGateway } from '@/src/modules/programs/infrastructure/server/github-program-release-gateway';

describe('GithubProgramReleaseGateway', () => {
    it('maps validated releases and uses the GitHub cache and headers', async () => {
        const fetcher = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => [{
                id: 3, tag_name: 'v1.0.0', name: null, body: null,
                published_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
                html_url: 'https://github.com/owner/repo/releases/tag/v1.0.0', prerelease: false, draft: false,
                assets: [{ id: 8, name: 'setup.exe', download_count: 4, size: 9, browser_download_url: 'https://example.com/setup.exe', content_type: 'application/octet-stream' }],
            }],
        });

        const result = await new GithubProgramReleaseGateway(fetcher).list('owner/repo', { page: 2, perPage: 10 });

        expect(result).toEqual({ ok: true, value: [expect.objectContaining({ tagName: 'v1.0.0', name: '', body: '', publishedAt: '2026-01-01T00:00:00Z', assets: [expect.objectContaining({ downloadCount: 4 })] })] });
        expect(fetcher).toHaveBeenCalledWith(
            'https://api.github.com/repos/owner/repo/releases?page=2&per_page=10',
            expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/vnd.github.v3+json', 'User-Agent': 'kkuko-utils' }), next: { revalidate: 300 } }),
        );
    });

    it.each([
        ['non-2xx', async () => ({ ok: false, json: async () => ({ message: 'secret' }) })],
        ['thrown fetch', async () => { throw new Error('secret'); }],
        ['invalid JSON', async () => ({ ok: true, json: async () => ({ nope: true }) })],
        ['invalid asset', async () => ({ ok: true, json: async () => [{ id: 1, tag_name: 'v', name: '', body: '', published_at: 'a', updated_at: 'b', html_url: 'url', prerelease: false, draft: false, assets: [{ id: 1 }] }] })],
    ])('returns a safe infrastructure result for %s', async (_, response) => {
        const result = await new GithubProgramReleaseGateway(jest.fn().mockImplementation(response)).list('owner/repo', { page: 1, perPage: 10 });
        expect(result).toEqual({ ok: false, error: expect.objectContaining({ kind: 'infrastructure' }) });
        if (!result.ok) expect(result.error.message).not.toContain('secret');
    });
});

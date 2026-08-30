import { err, ok } from '../../../shared/application/result';
import type { NextRequest } from 'next/server';

const mockCreateServerProgramsServices = jest.fn();
jest.mock('@/modules/programs/infrastructure/server/server-program-services', () => ({
    createServerProgramsServices: mockCreateServerProgramsServices,
}));
jest.mock('next/server', () => ({
    NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, json: async () => body }) },
}));

const program = { id: 7, name: 'Tool', description: 'desc', githubRepo: 'owner/repo', category: 'tool' as const, tags: ['tag'], isActive: true, createdAt: '2026-01-01', readmePath: 'README.md', updatedAt: '2026-01-02' };
const release = { id: 1, tagName: 'v1', name: 'v1', body: '', publishedAt: '2026-01-01', updatedAt: '2026-01-02', assets: [], htmlUrl: 'https://example.com', prerelease: false, draft: false };
/** Route tests only exercise URL parsing; this is the minimal NextRequest surface. */
const request = (url: string): NextRequest => ({ nextUrl: new URL(url) } as unknown as NextRequest);

describe('program routes', () => {
    beforeEach(() => {
        mockCreateServerProgramsServices.mockClear();
        mockCreateServerProgramsServices.mockReturnValue({
            programsService: {
                list: jest.fn().mockResolvedValue(ok([program])),
                byId: jest.fn().mockResolvedValue(ok(program)),
                releases: jest.fn().mockResolvedValue(ok([release])),
                latestRelease: jest.fn().mockResolvedValue(ok(release)),
            },
        });
    });

    it('rejects non-canonical program IDs without exposing diagnostics', async () => {
        const { GET } = await import('../../../app/api/programs/info/route');
        const response = await GET(request('http://localhost/api/programs/info?id=%201'));

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: 'Invalid program ID' });
    });

    it.each(['0', '-1', '+1', '01', '1.0', '1e2', '0x1', '9007199254740992'])('rejects non-canonical ID %s', async (id) => {
        const { GET } = await import('../../../app/api/programs/info/route');
        const response = await GET(request(`http://localhost/api/programs/info?id=${id}`));
        expect(response.status).toBe(400);
    });

    it('accepts encoded repository identifiers and preserves release envelopes', async () => {
        const { GET } = await import('../../../app/api/programs/releases/[repo]/route');
        const response = await GET(request('http://localhost/api/programs/releases/owner%2Frepo?page=1&per_page=10'), { params: Promise.resolve({ repo: 'owner%2Frepo' }) });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ releases: [expect.objectContaining({ tag_name: 'v1' })], has_more: false });
    });

    it.each(['owner%2F..', 'owner%2Frepo%2Fextra', 'owner%2Fre%20po', '%', 'owner%2Frepo%3Fq'])('rejects invalid repository %s', async (repo) => {
        const { GET } = await import('../../../app/api/programs/releases/[repo]/latest/route');
        const response = await GET(request('http://localhost/api/programs/releases/x/latest'), { params: Promise.resolve({ repo }) });
        expect(response.status).toBe(400);
    });

    it('rejects malformed repositories and invalid pagination before calling a service', async () => {
        const { GET } = await import('../../../app/api/programs/releases/[repo]/route');
        const response = await GET(request('http://localhost/api/programs/releases/owner%2Frepo?page=01&per_page=101'), { params: Promise.resolve({ repo: 'owner%2Frepo' }) });

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: 'Invalid release pagination' });
        expect(mockCreateServerProgramsServices).not.toHaveBeenCalled();
    });

    it('keeps all public success envelopes and presenter timestamps', async () => {
        const listRoute = await import('../../../app/api/programs/route');
        const infoRoute = await import('../../../app/api/programs/info/route');
        const releasesRoute = await import('../../../app/api/programs/releases/[repo]/route');
        const latestRoute = await import('../../../app/api/programs/releases/[repo]/latest/route');

        const [listResponse, infoResponse, releasesResponse, latestResponse] = await Promise.all([
            listRoute.GET(request('http://localhost/api/programs?category=tool')),
            infoRoute.GET(request('http://localhost/api/programs/info?id=7')),
            releasesRoute.GET(request('http://localhost/api/programs/releases/owner%2Frepo?page=1&per_page=1'), { params: Promise.resolve({ repo: 'owner%2Frepo' }) }),
            latestRoute.GET(request('http://localhost/api/programs/releases/owner%2Frepo/latest'), { params: Promise.resolve({ repo: 'owner%2Frepo' }) }),
        ]);

        await expect(listResponse.json()).resolves.toEqual({ programs: [expect.objectContaining({ github_repo: 'owner/repo', updated_at: '2026-01-02' })] });
        await expect(infoResponse.json()).resolves.toEqual({ data: expect.objectContaining({ readme_path: 'README.md', updated_at: '2026-01-02' }) });
        await expect(releasesResponse.json()).resolves.toEqual({ releases: [expect.objectContaining({ tag_name: 'v1', published_at: '2026-01-01', updated_at: '2026-01-02' })], has_more: true });
        await expect(latestResponse.json()).resolves.toEqual({ release: expect.objectContaining({ html_url: 'https://example.com', updated_at: '2026-01-02' }) });
    });

    it('returns the stable not-found response for missing program info', async () => {
        mockCreateServerProgramsServices.mockReturnValue({
            programsService: { list: jest.fn(), byId: jest.fn().mockResolvedValue(ok(null)), releases: jest.fn(), latestRelease: jest.fn() },
        });
        const { GET } = await import('../../../app/api/programs/info/route');

        const response = await GET(request('http://localhost/api/programs/info?id=7'));

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({ error: 'Program not found' });
    });

    it('preserves 500 responses and suppresses diagnostics for all Result failures', async () => {
        mockCreateServerProgramsServices.mockReturnValue({
            programsService: {
                list: jest.fn().mockResolvedValue(err({ kind: 'infrastructure', message: 'GitHub database secret' })),
                byId: jest.fn().mockResolvedValue(err({ kind: 'infrastructure', message: 'GitHub database secret' })),
                releases: jest.fn().mockResolvedValue(err({ kind: 'infrastructure', message: 'GitHub database secret' })),
                latestRelease: jest.fn().mockResolvedValue(err({ kind: 'infrastructure', message: 'GitHub database secret' })),
            },
        });
        const listRoute = await import('../../../app/api/programs/route');
        const infoRoute = await import('../../../app/api/programs/info/route');
        const releasesRoute = await import('../../../app/api/programs/releases/[repo]/route');
        const latestRoute = await import('../../../app/api/programs/releases/[repo]/latest/route');
        const [listResponse, infoResponse, releasesResponse, latestResponse] = await Promise.all([
            listRoute.GET(request('http://localhost/api/programs')),
            infoRoute.GET(request('http://localhost/api/programs/info?id=7')),
            releasesRoute.GET(request('http://localhost/api/programs/releases/owner%2Frepo'), { params: Promise.resolve({ repo: 'owner%2Frepo' }) }),
            latestRoute.GET(request('http://localhost/api/programs/releases/owner%2Frepo/latest'), { params: Promise.resolve({ repo: 'owner%2Frepo' }) }),
        ]);

        expect(listResponse.status).toBe(500);
        await expect(listResponse.json()).resolves.toEqual({ error: 'Failed to fetch programs' });
        expect(infoResponse.status).toBe(500);
        await expect(infoResponse.json()).resolves.toEqual({ error: 'Failed to fetch program info' });
        expect(releasesResponse.status).toBe(500);
        await expect(releasesResponse.json()).resolves.toEqual({ error: 'Failed to fetch releases' });
        expect(latestResponse.status).toBe(500);
        await expect(latestResponse.json()).resolves.toEqual({ error: 'Failed to fetch latest release' });
    });

    it('suppresses thrown diagnostics in all 500 route responses', async () => {
        const throwsSecret = () => { throw new Error('GitHub database secret'); };
        mockCreateServerProgramsServices.mockReturnValue({
            programsService: { list: throwsSecret, byId: throwsSecret, releases: throwsSecret, latestRelease: throwsSecret },
        });
        const listRoute = await import('../../../app/api/programs/route');
        const infoRoute = await import('../../../app/api/programs/info/route');
        const releasesRoute = await import('../../../app/api/programs/releases/[repo]/route');
        const latestRoute = await import('../../../app/api/programs/releases/[repo]/latest/route');
        const responses = await Promise.all([
            listRoute.GET(request('http://localhost/api/programs')),
            infoRoute.GET(request('http://localhost/api/programs/info?id=7')),
            releasesRoute.GET(request('http://localhost/api/programs/releases/owner%2Frepo'), { params: Promise.resolve({ repo: 'owner%2Frepo' }) }),
            latestRoute.GET(request('http://localhost/api/programs/releases/owner%2Frepo/latest'), { params: Promise.resolve({ repo: 'owner%2Frepo' }) }),
        ]);

        await Promise.all(responses.map(async (response) => {
            expect(response.status).toBe(500);
            expect(JSON.stringify(await response.json())).not.toContain('secret');
        }));
    });
});

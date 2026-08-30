import { ok } from '../../../shared/application/result';

const mockCreateServerProgramsServices = jest.fn();
jest.mock('@/modules/programs/infrastructure/server/server-program-services', () => ({
    createServerProgramsServices: mockCreateServerProgramsServices,
}));
jest.mock('next/server', () => ({
    NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, json: async () => body }) },
}));

const program = { id: 7, name: 'Tool', description: 'desc', githubRepo: 'owner/repo', category: 'tool' as const, tags: ['tag'], isActive: true, createdAt: '2026-01-01', readmePath: 'README.md', updatedAt: '2026-01-02' };
const release = { id: 1, tagName: 'v1', name: 'v1', body: '', publishedAt: '2026-01-01', updatedAt: '2026-01-02', assets: [], htmlUrl: 'https://example.com', prerelease: false, draft: false };
const request = (url: string) => ({ nextUrl: new URL(url) });

describe('program routes', () => {
    beforeEach(() => {
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
});

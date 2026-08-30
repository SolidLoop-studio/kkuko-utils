import { err, ok } from '@/src/shared/application/result';
import { GetProgramsService } from '@/src/modules/programs/application/get-programs';

describe('GetProgramsService', () => {
    it('falls back to all and retains database order while omitting only failed release enrichments', async () => {
        const programGateway = {
            list: jest.fn().mockResolvedValue(ok([
                { id: 9, name: 'First', description: 'first', githubRepo: 'owner/first', category: 'tool' as const, tags: [], isActive: true, createdAt: '2026-01-01', readmePath: 'README.md' },
                { id: 3, name: 'Second', description: 'second', githubRepo: 'owner/second', category: 'util' as const, tags: [], isActive: true, createdAt: '2026-01-02', readmePath: 'README.md' },
                { id: 5, name: 'Third', description: 'third', githubRepo: 'owner/third', category: 'other' as const, tags: [], isActive: true, createdAt: '2026-01-03', readmePath: 'README.md' },
            ])),
            findById: jest.fn(),
        };
        const releaseGateway = {
            latest: jest.fn()
                .mockResolvedValueOnce(ok({ id: 1, tagName: 'v1', name: 'v1', body: '', publishedAt: '2026-02-01', assets: [], htmlUrl: 'https://example.com/1', prerelease: false, draft: false, updatedAt: '2026-02-02' }))
                .mockResolvedValueOnce(err({ kind: 'infrastructure', message: 'safe' }))
                .mockResolvedValueOnce(ok({ id: 3, tagName: 'v3', name: 'v3', body: '', publishedAt: '2026-03-01', assets: [], htmlUrl: 'https://example.com/3', prerelease: false, draft: false, updatedAt: '2026-03-02' })),
            list: jest.fn(),
        };

        const result = await new GetProgramsService(programGateway, releaseGateway).list('unsupported');

        expect(programGateway.list).toHaveBeenCalledWith('all');
        expect(result).toEqual(ok([
            expect.objectContaining({ id: 9, updatedAt: '2026-02-01' }),
            expect.objectContaining({ id: 5, updatedAt: '2026-03-01' }),
        ]));
    });

    it('returns an empty database list successfully and reports all failed enrichments', async () => {
        const service = new GetProgramsService(
            { list: jest.fn().mockResolvedValue(ok([])), findById: jest.fn() },
            { latest: jest.fn(), list: jest.fn() },
        );
        await expect(service.list('all')).resolves.toEqual(ok([]));
    });

    it('returns a safe infrastructure error when every latest-release enrichment fails', async () => {
        const service = new GetProgramsService(
            { list: jest.fn().mockResolvedValue(ok([program('owner/one'), program('owner/two')])), findById: jest.fn() },
            { latest: jest.fn().mockResolvedValue(err({ kind: 'infrastructure', message: 'GitHub secret' })), list: jest.fn() },
        );

        await expect(service.list('all')).resolves.toEqual(err(expect.objectContaining({ kind: 'infrastructure' })));
    });

    it('returns not found without loading a release when the program is absent', async () => {
        const releaseGateway = { latest: jest.fn(), list: jest.fn() };
        const service = new GetProgramsService(
            { list: jest.fn(), findById: jest.fn().mockResolvedValue(ok(null)) },
            releaseGateway,
        );

        await expect(service.byId(7)).resolves.toEqual(ok(null));
        expect(releaseGateway.latest).not.toHaveBeenCalled();
    });

    it('uses the latest release updatedAt for a program detail', async () => {
        const service = new GetProgramsService(
            { list: jest.fn(), findById: jest.fn().mockResolvedValue(ok(program('owner/repo'))) },
            { latest: jest.fn().mockResolvedValue(ok(release({ publishedAt: 'published', updatedAt: 'updated' }))), list: jest.fn() },
        );

        await expect(service.byId(7)).resolves.toEqual(ok(expect.objectContaining({ updatedAt: 'updated' })));
    });

    it.each([
        ['releases', (service: GetProgramsService) => service.releases('owner/repo', { page: 1, perPage: 10 })],
        ['latest release', (service: GetProgramsService) => service.latestRelease('owner/repo')],
    ])('returns successful %s gateway results', async (_, invoke) => {
        const releaseValue = release({});
        const service = new GetProgramsService(
            { list: jest.fn(), findById: jest.fn() },
            { latest: jest.fn().mockResolvedValue(ok(releaseValue)), list: jest.fn().mockResolvedValue(ok([releaseValue])) },
        );

        await expect(invoke(service)).resolves.toMatchObject({ ok: true });
    });

    it.each([
        ['releases failure', (service: GetProgramsService) => service.releases('owner/repo', { page: 1, perPage: 10 }), { list: jest.fn().mockResolvedValue(err({ kind: 'infrastructure', message: 'secret' })), latest: jest.fn() }],
        ['latest release failure', (service: GetProgramsService) => service.latestRelease('owner/repo'), { list: jest.fn(), latest: jest.fn().mockResolvedValue(err({ kind: 'infrastructure', message: 'secret' })) }],
        ['releases throw', (service: GetProgramsService) => service.releases('owner/repo', { page: 1, perPage: 10 }), { list: jest.fn().mockRejectedValue(new Error('secret')), latest: jest.fn() }],
        ['latest release throw', (service: GetProgramsService) => service.latestRelease('owner/repo'), { list: jest.fn(), latest: jest.fn().mockRejectedValue(new Error('secret')) }],
    ])('returns a safe infrastructure error for %s', async (_, invoke, releaseGateway) => {
        const service = new GetProgramsService({ list: jest.fn(), findById: jest.fn() }, releaseGateway);

        const result = await invoke(service);
        expect(result).toEqual(err(expect.objectContaining({ kind: 'infrastructure' })));
        if (!result.ok) expect(result.error.message).not.toContain('secret');
    });
});

const program = (githubRepo: string) => ({
    id: 7, name: 'Tool', description: 'description', githubRepo, category: 'tool' as const,
    tags: [], isActive: true, createdAt: '2026-01-01', readmePath: 'README.md',
});

const release = ({ publishedAt = '2026-01-01', updatedAt = '2026-01-02' }: { publishedAt?: string; updatedAt?: string }) => ({
    id: 1, tagName: 'v1', name: 'v1', body: '', publishedAt, updatedAt, assets: [],
    htmlUrl: 'https://example.com', prerelease: false, draft: false,
});

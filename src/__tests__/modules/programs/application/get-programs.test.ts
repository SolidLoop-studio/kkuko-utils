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
});

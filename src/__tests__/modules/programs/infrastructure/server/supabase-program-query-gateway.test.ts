import { SupabaseProgramQueryGateway } from '@/src/modules/programs/infrastructure/server/supabase-program-query-gateway';

describe('SupabaseProgramQueryGateway', () => {
    it('selects only the program client fields, filters categories, and maps rows', async () => {
        const eq = jest.fn().mockResolvedValue({ data: [{ id: 1, name: 'Tool', description: 'desc', github_repo: 'owner/repo', category: 'tool', tags: ['tag'], is_active: true, created_at: '2026-01-01', readme_path: 'README.md' }], error: null });
        const select = jest.fn().mockReturnValue({ eq });
        const from = jest.fn().mockReturnValue({ select });

        const result = await new SupabaseProgramQueryGateway({ from } as never).list('tool');

        expect(result).toEqual({ ok: true, value: [expect.objectContaining({ githubRepo: 'owner/repo', isActive: true })] });
        expect(from).toHaveBeenCalledWith('programs');
        expect(select).toHaveBeenCalledWith('id, name, description, github_repo, category, tags, is_active, created_at, readme_path');
        expect(eq).toHaveBeenCalledWith('category', 'tool');
    });

    it.each([
        ['returned error', () => ({ data: null, error: { message: 'secret' } })],
        ['thrown error', () => { throw new Error('secret'); }],
        ['invalid row', () => ({ data: [{ id: 'bad' }], error: null })],
    ])('does not leak diagnostics for %s', async (_, response) => {
        const select = jest.fn().mockImplementation(response);
        const result = await new SupabaseProgramQueryGateway({ from: () => ({ select }) } as never).list('all');
        expect(result).toEqual({ ok: false, error: expect.objectContaining({ kind: 'infrastructure' }) });
    });

    it('returns null for a PostgREST not-found response', async () => {
        const single = jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'row secret' } });
        const eq = jest.fn().mockReturnValue({ single });
        const gateway = new SupabaseProgramQueryGateway({ from: () => ({ select: () => ({ eq }) }) } as never);

        await expect(gateway.findById(7)).resolves.toEqual({ ok: true, value: null });
        expect(eq).toHaveBeenCalledWith('id', 7);
    });

    it.each([
        ['returned error', () => ({ data: null, error: { code: 'PGRST999', message: 'database secret' } })],
        ['thrown error', () => { throw new Error('database secret'); }],
        ['invalid row', () => ({ data: { id: 'wrong' }, error: null })],
    ])('returns a safe infrastructure error when findById has a %s', async (_, response) => {
        const single = jest.fn().mockImplementation(response);
        const eq = jest.fn().mockReturnValue({ single });
        const gateway = new SupabaseProgramQueryGateway({ from: () => ({ select: () => ({ eq }) }) } as never);

        const result = await gateway.findById(7);
        expect(result).toEqual({ ok: false, error: expect.objectContaining({ kind: 'infrastructure' }) });
        if (!result.ok) expect(result.error.message).not.toContain('secret');
    });
});

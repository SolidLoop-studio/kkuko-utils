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
});

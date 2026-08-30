import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const mockCreateServiceSupabaseClient = jest.fn(() => ({ from: jest.fn() }));
jest.mock('../../../../../shared/infrastructure/supabase/service-client', () => ({
    createServiceSupabaseClient: mockCreateServiceSupabaseClient,
}));
jest.mock('next/server', () => ({
    NextRequest: class NextRequest {},
    NextResponse: { json: jest.fn() },
}));

describe('server programs composition', () => {
    beforeEach(() => {
        mockCreateServiceSupabaseClient.mockClear();
    });

    it('does not create a service client when imported, and creates one per request composition', async () => {
        const { createServerProgramsServices } = await import('../../../../../modules/programs/infrastructure/server/server-program-services');
        await Promise.all([
            import('../../../../../app/api/programs/route'),
            import('../../../../../app/api/programs/info/route'),
            import('../../../../../app/api/programs/releases/[repo]/route'),
            import('../../../../../app/api/programs/releases/[repo]/latest/route'),
        ]);

        expect(mockCreateServiceSupabaseClient).not.toHaveBeenCalled();
        const first = createServerProgramsServices();
        const second = createServerProgramsServices();

        expect(mockCreateServiceSupabaseClient).toHaveBeenCalledTimes(2);
        expect(first.programsService).not.toBe(second.programsService);
    });

    it('keeps the Programs source boundary free of the deleted manager, SSM, and forbidden application imports', () => {
        const root = process.cwd();
        const moduleRoot = join(root, 'src', 'modules', 'programs');
        const applicationFiles = [
            join(moduleRoot, 'application', 'program-query-types.ts'),
            join(moduleRoot, 'application', 'program-query-ports.ts'),
            join(moduleRoot, 'application', 'get-programs.ts'),
        ];
        const source = applicationFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
        const programsSource = [
            ...applicationFiles,
            join(moduleRoot, 'infrastructure', 'server', 'server-program-services.ts'),
            join(root, 'src', 'app', 'api', 'programs', 'route.ts'),
        ].map((file) => readFileSync(file, 'utf8')).join('\n');

        expect(existsSync(join(root, 'src', 'app', 'lib', 'supabase', 'supabaseServerManager.ts'))).toBe(false);
        expect(programsSource).not.toMatch(/supabaseServerManager|\bSSM\b/i);
        expect(source).not.toMatch(/from ['"][^'"]*(?:react|next|supabase|database)[^'"]*['"]/i);
        expect(source).not.toMatch(/\b(?:Response|fetch)\b/);
    });
});

import { readFileSync } from 'fs';
import { join } from 'path';

const screenPaths = [
    'src/app/admin/api-server/crawler/CrawlerManager.tsx',
    'src/app/admin/api-server/items/ItemsMangeHome.tsx',
    'src/app/admin/api-server/users/UsersManageHome.tsx',
    'src/app/admin/api-server/logs/LogsViewer.tsx',
] as const;

describe('admin API-server presentation boundary', () => {
    test.each(screenPaths)('%s uses only the admin-api-server feature for external API access', (path) => {
        // Break caught: reintroducing an API client, SDK/session, token, or legacy DTO dependency into a screen.
        const source = readFileSync(join(process.cwd(), path), 'utf8');
        const imports = [...source.matchAll(/(?:import|from)\s*(?:[^'\"]*?\s+from\s+)?['\"]([^'\"]+)['\"]/g)]
            .map((match) => match[1]);

        expect(source).toContain("@/src/modules/admin-api-server");
        expect(source).not.toMatch(/from\s+['\"][^'\"]*(?:\.\.\/api|api-server\/api|api-server\/types)[^'\"]*['\"]/);
        expect(source).not.toMatch(/\b(?:axios|AxiosError|SCM|supabaseClient|browserSupabaseClient|getSession|access_token)\b/);
        expect(source).not.toContain('@supabase');
        expect(imports).not.toContain('@/src/shared/infrastructure/supabase/browser-client');
        expect(imports).not.toContain('@/src/app/lib/supabaseClient');
        expect(imports.some((specifier) => /(?:^|\/)(?:supabase|session|token)(?:\/|$)/i.test(specifier))).toBe(false);
    });
});

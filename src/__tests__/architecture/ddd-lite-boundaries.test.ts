import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { analyzeRepository, analyzeSources } from '../../../scripts/verify-ddd-lite-architecture.mjs';

describe('DDD-lite architecture boundaries', () => {
    it('reports a legacy manager declaration from executable syntax', () => {
        const diagnostics = analyzeSources({
            'src/app/example.ts': 'const SCM = createClient();',
        });

        expect(diagnostics).toEqual([
            {
                filePath: 'src/app/example.ts',
                line: 1,
                rule: 'no-legacy-manager',
                message: 'Legacy manager identifier "SCM" is not allowed in production code.',
            },
        ]);
    });

    it('reports a legacy manager file that was not deleted', () => {
        const temporaryRoot = join(tmpdir(), `kkuko-ddd-lite-${Date.now()}`);
        const managerDirectory = join(temporaryRoot, 'src', 'app', 'lib', 'supabase');

        mkdirSync(managerDirectory, { recursive: true });
        writeFileSync(join(managerDirectory, 'SupabaseClientManager.ts'), 'export {};');

        try {
            expect(analyzeRepository(temporaryRoot)).toEqual([
                {
                    filePath: 'src/app/lib/supabase/SupabaseClientManager.ts',
                    line: 1,
                    rule: 'no-legacy-manager',
                    message: 'Deleted legacy manager path must not exist.',
                },
            ]);
        } finally {
            rmSync(temporaryRoot, { force: true, recursive: true });
        }
    });

    it('reports transitional alias, domain/application, and presentation imports at their import lines', () => {
        const diagnostics = analyzeSources({
            'src/app/example.tsx': "import { supabase } from '@/src/app/lib/supabaseClient';",
            'src/modules/catalog/domain/rule.ts': "import { createClient } from '@supabase/supabase-js';",
            'src/modules/catalog/application/query.ts': "import { gateway } from '../infrastructure/browser/gateway';",
            'src/modules/catalog/presentation/use-catalog.ts': "import type { Database } from '@/src/app/types/database.types';",
        });

        expect(diagnostics).toEqual([
            {
                filePath: 'src/app/example.tsx',
                line: 1,
                rule: 'no-transitional-supabase-alias',
                message: 'Production code must not import the transitional supabaseClient alias.',
            },
            {
                filePath: 'src/app/example.tsx',
                line: 1,
                rule: 'presentation-import',
                message: 'Presentation code must not import Supabase clients, generated database types, or Infrastructure modules.',
            },
            {
                filePath: 'src/modules/catalog/application/query.ts',
                line: 1,
                rule: 'domain-application-import',
                message: 'Domain and Application layers may not import framework or Infrastructure dependencies.',
            },
            {
                filePath: 'src/modules/catalog/domain/rule.ts',
                line: 1,
                rule: 'domain-application-import',
                message: 'Domain and Application layers may not import framework or Infrastructure dependencies.',
            },
            {
                filePath: 'src/modules/catalog/presentation/use-catalog.ts',
                line: 1,
                rule: 'presentation-import',
                message: 'Presentation code must not import Supabase clients, generated database types, or Infrastructure modules.',
            },
        ]);
    });

    it('allows Supabase infrastructure and only the three approved auth Route Handlers', () => {
        const diagnostics = analyzeSources({
            'src/modules/catalog/infrastructure/browser/gateway.ts': "import { createBrowserClient } from '@supabase/ssr';",
            'src/app/api/auth/callback/route.ts': "import type { Database } from '@/src/app/types/database.types';",
            'src/app/api/auth/set_nickname/route.ts': "import type { Database } from '@/src/app/types/database.types';",
            'src/app/api/auth/update_nickname/route.ts': "import type { Database } from '@/src/app/types/database.types';",
        });

        expect(diagnostics).toEqual([]);
    });

    it('rejects an unapproved auth Route Handler exception', () => {
        const diagnostics = analyzeSources({
            'src/app/api/auth/unapproved/route.ts': "import type { Database } from '@/src/app/types/database.types';",
        });

        expect(diagnostics).toEqual([
            {
                filePath: 'src/app/api/auth/unapproved/route.ts',
                line: 1,
                rule: 'presentation-import',
                message: 'Presentation code must not import Supabase clients, generated database types, or Infrastructure modules.',
            },
        ]);
    });

    it('canonicalizes extension and index import spellings before applying layer restrictions', () => {
        const diagnostics = analyzeSources({
            'src/app/alias.ts': "import '@/src/app/lib/supabaseClient/index.ts';",
            'src/app/generated.ts': "import type { Database } from '@/src/app/types/database.types/index.ts';",
            'src/app/shared.ts': "import '@/src/shared/infrastructure/supabase/index.ts';",
            'src/modules/catalog/application/legacy.ts': "import '@/src/app/lib/supabase/SupabaseClientManager/index.ts';",
        });

        expect(diagnostics).toEqual([
            {
                filePath: 'src/app/alias.ts',
                line: 1,
                rule: 'no-transitional-supabase-alias',
                message: 'Production code must not import the transitional supabaseClient alias.',
            },
            {
                filePath: 'src/app/alias.ts',
                line: 1,
                rule: 'presentation-import',
                message: 'Presentation code must not import Supabase clients, generated database types, or Infrastructure modules.',
            },
            {
                filePath: 'src/app/generated.ts',
                line: 1,
                rule: 'presentation-import',
                message: 'Presentation code must not import Supabase clients, generated database types, or Infrastructure modules.',
            },
            {
                filePath: 'src/app/shared.ts',
                line: 1,
                rule: 'presentation-import',
                message: 'Presentation code must not import Supabase clients, generated database types, or Infrastructure modules.',
            },
            {
                filePath: 'src/modules/catalog/application/legacy.ts',
                line: 1,
                rule: 'domain-application-import',
                message: 'Domain and Application layers may not import framework or Infrastructure dependencies.',
            },
        ]);
    });

    it('applies import restrictions to dynamic imports without mistaking ordinary calls for imports', () => {
        const diagnostics = analyzeSources({
            'src/app/dynamic.ts': [
                "import('@/src/app/lib/supabaseClient.ts');",
                "import('@/src/app/types/database.types.ts');",
                "import('@/src/shared/infrastructure/supabase');",
                "loader.import('@supabase/supabase-js');",
            ].join('\n'),
            'src/modules/catalog/application/dynamic.ts': "import('@supabase/supabase-js');",
        });

        expect(diagnostics).toEqual([
            {
                filePath: 'src/app/dynamic.ts',
                line: 1,
                rule: 'no-transitional-supabase-alias',
                message: 'Production code must not import the transitional supabaseClient alias.',
            },
            {
                filePath: 'src/app/dynamic.ts',
                line: 1,
                rule: 'presentation-import',
                message: 'Presentation code must not import Supabase clients, generated database types, or Infrastructure modules.',
            },
            {
                filePath: 'src/app/dynamic.ts',
                line: 2,
                rule: 'presentation-import',
                message: 'Presentation code must not import Supabase clients, generated database types, or Infrastructure modules.',
            },
            {
                filePath: 'src/app/dynamic.ts',
                line: 3,
                rule: 'presentation-import',
                message: 'Presentation code must not import Supabase clients, generated database types, or Infrastructure modules.',
            },
            {
                filePath: 'src/modules/catalog/application/dynamic.ts',
                line: 1,
                rule: 'domain-application-import',
                message: 'Domain and Application layers may not import framework or Infrastructure dependencies.',
            },
        ]);
    });

    it('reports direct query and RPC calls only in real Client Components', () => {
        const diagnostics = analyzeSources({
            'src/app/catalog/page.tsx': "'use client';\nclient.from('words');\nclient.rpc('search_words');",
            'src/app/catalog/server.ts': "client.from('words');",
        });

        expect(diagnostics).toEqual([
            {
                filePath: 'src/app/catalog/page.tsx',
                line: 2,
                rule: 'no-client-direct-query',
                message: 'Client Components must not call .from(...) directly.',
            },
            {
                filePath: 'src/app/catalog/page.tsx',
                line: 3,
                rule: 'no-client-direct-query',
                message: 'Client Components must not call .rpc(...) directly.',
            },
        ]);
    });

    it('ignores comments, string literals, and longer identifier names', () => {
        const diagnostics = analyzeSources({
            'src/app/example.ts': "// SCM.from('words')\nconst description = 'SSM.rpc(\\\"example\\\")';\nconst SSMDescription = description;",
        });

        expect(diagnostics).toEqual([]);
    });

    it('sorts diagnostics by path, line, and rule', () => {
        const diagnostics = analyzeSources({
            'src/app/z.tsx': "'use client';\nclient.rpc('x');",
            'src/app/a.ts': 'const SCM = client;',
        });

        expect(diagnostics.map((diagnostic) => `${diagnostic.filePath}:${diagnostic.line}:${diagnostic.rule}`)).toEqual([
            'src/app/a.ts:1:no-legacy-manager',
            'src/app/z.tsx:2:no-client-direct-query',
        ]);
    });

    it('reports no architecture violations in the real repository after legacy cleanup', () => {
        expect(analyzeRepository(resolve(process.cwd()))).toEqual([]);
    });
});

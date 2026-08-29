describe('LogsHome source boundary', () => {
    test('depends only on the word-logs presentation boundary for server state', () => {
        // Break caught: coupling the public screen back to Supabase, PostgREST, or legacy SCM.
        const source = require('fs').readFileSync(
            require('path').resolve(process.cwd(), 'src/app/word/logs/LogsHome.tsx'),
            'utf8',
        );
        const forbiddenCoupling = [
            /@supabase\/supabase-js/,
            /\bbrowserSupabaseClient\b/,
            /\bPostgrestError\b/,
            /\bSCM\b/,
            /\blogsByFilter\b/,
            /(?<!\bArray)\.from\s*\(/,
            /\.rpc\s*\(/,
        ];

        for (const forbidden of forbiddenCoupling) expect(source).not.toMatch(forbidden);
    });
});

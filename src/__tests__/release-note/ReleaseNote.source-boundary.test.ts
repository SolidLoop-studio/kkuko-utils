describe('ReleaseNote source boundary', () => {
    test('depends only on the release-notes presentation boundary for server state', () => {
        // Break caught: moving fetch, Supabase, raw response parsing, or legacy SCM back into the component.
        const source = require('fs').readFileSync(
            require('path').resolve(process.cwd(), 'src/app/release-note/ReleaseNote.tsx'),
            'utf8',
        );
        const forbiddenCoupling = [
            /@supabase\/supabase-js/,
            /\bbrowserSupabaseClient\b/,
            /\bPostgrestError\b/,
            /\bSCM\b/,
            /\breleaseNote\s*\(/,
            /\bfetch\s*\(/,
            /api\.github\.com/,
            /\.json\s*\(/,
        ];

        for (const forbidden of forbiddenCoupling) expect(source).not.toMatch(forbidden);
    });
});

import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { DocsLogQueryGateway } from '../../application/docs-log-query-ports';
import type { DocsLogEntry, DocsLogProjection } from '../../application/docs-log-query-types';

type QueryResponse = {
    data: unknown;
    error: unknown;
};

interface DocsLogQueryBuilder extends PromiseLike<QueryResponse> {
    select(columns: string): DocsLogQueryBuilder;
    eq(column: string, value: number): DocsLogQueryBuilder;
    maybeSingle(): DocsLogQueryBuilder;
    order(column: string, options: { ascending: boolean }): DocsLogQueryBuilder;
}

interface DocsLogQueryClient {
    from(table: 'docs' | 'docs_logs'): DocsLogQueryBuilder;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '문서 로그를 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

const isNullableString = (value: unknown): value is string | null => (
    typeof value === 'string' || value === null
);

const isDocsLogType = (value: unknown): value is DocsLogEntry['type'] => (
    value === 'add' || value === 'delete'
);

const parseDocsMetadata = (row: unknown, docsId: number): { id: number; name: string } | null => {
    if (!isRecord(row)
        || !isPositiveSafeInteger(row.id)
        || row.id !== docsId
        || typeof row.name !== 'string') {
        return null;
    }

    return { id: row.id, name: row.name };
};

const parseDocsLogEntry = (row: unknown): DocsLogEntry | null => {
    if (!isRecord(row)
        || !isPositiveSafeInteger(row.id)
        || typeof row.word !== 'string'
        || typeof row.date !== 'string'
        || !isDocsLogType(row.type)) {
        return null;
    }

    const user = row.users;
    if (user !== null && !isRecord(user)) return null;
    const userNickname = user === null ? null : user.nickname;
    if (!isNullableString(userNickname)) return null;

    return {
        id: row.id,
        word: row.word,
        userNickname,
        occurredAt: row.date,
        type: row.type,
    };
};

/** Supabase 문서와 로그 행을 로그 화면용 projection으로 투영합니다. */
export class SupabaseDocsLogQueryGateway implements DocsLogQueryGateway {
    constructor(
        private readonly client: DocsLogQueryClient = browserSupabaseClient as unknown as DocsLogQueryClient,
    ) {}

    async loadByDocsId(docsId: number): Promise<Result<DocsLogProjection | null>> {
        try {
            const docsResponse = await this.client
                .from('docs')
                .select('id, name')
                .eq('id', docsId)
                .maybeSingle();
            if (!isRecord(docsResponse) || docsResponse.error !== null) {
                return err(infrastructureError());
            }
            if (docsResponse.data === null) return ok(null);

            const docs = parseDocsMetadata(docsResponse.data, docsId);
            if (docs === null) return err(infrastructureError());

            const logsResponse = await this.client
                .from('docs_logs')
                .select('id, word, date, type, users(nickname)')
                .eq('docs_id', docsId)
                .order('date', { ascending: false });
            if (!isRecord(logsResponse) || logsResponse.error !== null || !Array.isArray(logsResponse.data)) {
                return err(infrastructureError());
            }

            const entries: DocsLogEntry[] = [];
            for (const row of logsResponse.data) {
                const entry = parseDocsLogEntry(row);
                if (entry === null) return err(infrastructureError());
                entries.push(entry);
            }
            return ok({
                docsId: docs.id,
                docsName: docs.name,
                entries,
            });
        } catch {
            return err(infrastructureError());
        }
    }
}

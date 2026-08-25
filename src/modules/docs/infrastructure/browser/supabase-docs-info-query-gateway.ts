import { reverDuemLaw } from '@/src/app/lib/hangulUtils';
import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { DocsInfoQueryGateway } from '../../application/docs-info-query-ports';
import type { DocsInfoProjection, DocsInfoType } from '../../application/docs-info-query-types';

type QueryResponse = {
    data?: unknown;
    count?: unknown;
    error: unknown;
};

interface DocsInfoQueryBuilder extends PromiseLike<QueryResponse> {
    select(columns: string, options?: { count?: 'exact'; head?: boolean }): DocsInfoQueryBuilder;
    eq(column: string, value: boolean | number | string): DocsInfoQueryBuilder;
    in(column: string, values: string[]): DocsInfoQueryBuilder;
    gt(column: string, value: number): DocsInfoQueryBuilder;
    maybeSingle(): DocsInfoQueryBuilder;
}

interface DocsInfoQueryClient {
    from(table: 'docs' | 'user_star_docs' | 'word_last_letter_counts' | 'themes' | 'word_themes' | 'words'): DocsInfoQueryBuilder;
    rpc(functionName: 'get_doc_rank', parameters: { doc_id: number }): PromiseLike<QueryResponse>;
}

type DocsMetadata = DocsInfoProjection['metadata'] & { duem: boolean };

/** 기존 특수 문서 ID 기반 동작을 Phase 0B 이전까지 격리합니다. */
const SUPPORTED_ECT_DOCS_IDS = new Set<number>([201, 202]);

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '문서 정보를 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

const isNonNegativeSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
);

const isNullableString = (value: unknown): value is string | null => (
    typeof value === 'string' || value === null
);

const isDocsInfoType = (value: unknown): value is DocsInfoType => (
    value === 'letter' || value === 'theme' || value === 'ect'
);

const parseDocsMetadata = (row: unknown, docsId: number): DocsMetadata | null => {
    if (!isRecord(row)
        || !isPositiveSafeInteger(row.id)
        || row.id !== docsId
        || typeof row.created_at !== 'string'
        || typeof row.name !== 'string'
        || !isDocsInfoType(row.typez)
        || typeof row.last_update !== 'string'
        || !isNonNegativeSafeInteger(row.views)
        || typeof row.duem !== 'boolean') {
        return null;
    }

    const user = row.users;
    if (user !== null && !isRecord(user)) return null;
    const makerNickname = user === null ? null : user.nickname;
    if (!isNullableString(makerNickname)) return null;

    return {
        id: row.id,
        createdAt: row.created_at,
        name: row.name,
        makerNickname,
        type: row.typez,
        lastUpdatedAt: row.last_update,
        views: row.views,
        duem: row.duem,
    };
};

const parseCount = (value: unknown): number | null | undefined => {
    if (value === null) return null;
    return isNonNegativeSafeInteger(value) ? value : undefined;
};

const parseSingleCount = (response: QueryResponse): number | null | undefined => {
    if (response.error !== null || !('data' in response)) return undefined;
    if (response.data === null) return null;
    if (!isRecord(response.data)) return undefined;
    return parseCount(response.data.count);
};

const parseMultipleCounts = (response: QueryResponse): number | null | undefined => {
    if (response.error !== null || !Array.isArray(response.data)) return undefined;
    let total = 0;
    for (const row of response.data) {
        if (!isRecord(row)) return undefined;
        const count = parseCount(row.count);
        if (count === undefined) return undefined;
        if (count === null) return null;
        total += count;
    }
    return Number.isSafeInteger(total) ? total : undefined;
};

const parseHeadCount = (response: QueryResponse): number | null | undefined => {
    if (response.error !== null || !('count' in response)) return undefined;
    if (response.count === null) return -1;
    return parseCount(response.count);
};

const parseThemeId = (response: QueryResponse): number | null | undefined => {
    if (response.error !== null || !('data' in response)) return undefined;
    if (response.data === null) return null;
    if (!isRecord(response.data) || !isPositiveSafeInteger(response.data.id) || typeof response.data.name !== 'string') {
        return undefined;
    }
    return response.data.id;
};

const parseStarCount = (response: QueryResponse): number | undefined => {
    if (response.error !== null || !Array.isArray(response.data)) return undefined;
    return response.data.length;
};

const parseViewRank = (response: QueryResponse): number | undefined => (
    response.error === null && isNonNegativeSafeInteger(response.data) ? response.data : undefined
);

/** Supabase 문서 행과 집계 값을 문서 정보 화면용 projection으로 투영합니다. */
export class SupabaseDocsInfoQueryGateway implements DocsInfoQueryGateway {
    constructor(
        private readonly client: DocsInfoQueryClient = browserSupabaseClient as unknown as DocsInfoQueryClient,
    ) {}

    async loadByDocsId(docsId: number): Promise<Result<DocsInfoProjection | null>> {
        try {
            const docsResponse = await this.client
                .from('docs')
                .select('id, created_at, name, typez, last_update, views, duem, users(nickname)')
                .eq('id', docsId)
                .maybeSingle();
            if (!isRecord(docsResponse) || docsResponse.error !== null) return err(infrastructureError());
            if (docsResponse.data === null) return ok(null);

            const metadata = parseDocsMetadata(docsResponse.data, docsId);
            if (metadata === null) return err(infrastructureError());

            const starsResponse = await this.client
                .from('user_star_docs')
                .select('id')
                .eq('docs_id', docsId);
            if (!isRecord(starsResponse)) return err(infrastructureError());
            const starCount = parseStarCount(starsResponse);
            if (starCount === undefined) return err(infrastructureError());

            const wordCount = await this.loadWordCount(metadata);
            if (wordCount === undefined) return err(infrastructureError());
            if (wordCount === null) return ok(null);

            const rankResponse = await this.client.rpc('get_doc_rank', { doc_id: docsId });
            if (!isRecord(rankResponse)) return err(infrastructureError());
            const viewRank = parseViewRank(rankResponse);
            if (viewRank === undefined) return err(infrastructureError());

            const { duem: _duem, ...projectionMetadata } = metadata;
            return ok({
                metadata: projectionMetadata,
                wordCount,
                starCount,
                viewRank,
            });
        } catch {
            return err(infrastructureError());
        }
    }

    private async loadWordCount(metadata: DocsMetadata): Promise<number | null | undefined> {
        if (metadata.type === 'letter') {
            const response = metadata.duem
                ? await this.client
                    .from('word_last_letter_counts')
                    .select('count')
                    .in('last_letter', reverDuemLaw(metadata.name[0]))
                : await this.client
                    .from('word_last_letter_counts')
                    .select('count')
                    .eq('last_letter', metadata.name[0])
                    .maybeSingle();
            return metadata.duem ? parseMultipleCounts(response) : parseSingleCount(response);
        }

        if (metadata.type === 'theme') {
            const themeResponse = await this.client
                .from('themes')
                .select('id, name')
                .eq('name', metadata.name)
                .maybeSingle();
            const themeId = parseThemeId(themeResponse);
            if (themeId === undefined) return undefined;
            if (themeId === null) return null;

            const response = await this.client
                .from('word_themes')
                .select('*', { count: 'exact', head: true })
                .eq('theme_id', themeId);
            return parseHeadCount(response);
        }

        if (!SUPPORTED_ECT_DOCS_IDS.has(metadata.id)) return null;
        const response = await this.client
            .from('words')
            .select('*', { count: 'exact', head: true })
            .eq('k_canuse', true)
            .gt('length', 8);
        return parseHeadCount(response);
    }
}

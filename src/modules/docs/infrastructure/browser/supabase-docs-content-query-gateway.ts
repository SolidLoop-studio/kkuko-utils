import { duemLaw, reverDuemLaw } from '@/src/app/lib/hangulUtils';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { ApplicationError } from '@/src/shared/application/application-error';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { DocsContentQueryGateway } from '../../application/docs-content-query-ports';
import type { DocsContentProjection, DocsContentType, DocsContentWord } from '../../application/docs-content-query-types';

type QueryResponse = { data: unknown; error: unknown };

interface DocsContentQueryBuilder extends PromiseLike<QueryResponse> {
    select(columns: string): DocsContentQueryBuilder;
    eq(column: string, value: boolean | number | string): DocsContentQueryBuilder;
    in(column: string, values: string[]): DocsContentQueryBuilder;
    ilike(column: string, value: string): DocsContentQueryBuilder;
    neq(column: string, value: number): DocsContentQueryBuilder;
    gt(column: string, value: number): DocsContentQueryBuilder;
    maybeSingle(): DocsContentQueryBuilder;
}

interface DocsContentQueryClient {
    from(table: 'docs' | 'user_star_docs' | 'words' | 'wait_words' | 'themes' | 'word_themes_wait' | 'wait_word_themes'): DocsContentQueryBuilder;
    rpc(functionName: string, parameters?: Record<string, unknown>): PromiseLike<QueryResponse>;
}

type DocsMetadata = DocsContentProjection['metadata'] & { duem: boolean };
type PendingWord = { word: string; status: 'add' | 'delete'; requesterNickname?: string };

/** 기존 미션글자 선택 화면을 표시만 하는 marker 문서입니다. */
const MARKER_DOCS_IDS = new Set<number>([208, 223, 238]);
const MISSION_CHARS = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];

/** 기존 숫자 ID 기반 미션 문서 범위를 Phase 0B 이전까지 Infrastructure에 격리합니다. */
const isSpecialMissionDocsId = (docsId: number): boolean => (
    (209 <= docsId && docsId <= 222)
    || (224 <= docsId && docsId <= 237)
    || (239 <= docsId && docsId <= 252)
);

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '문서 단어를 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);
const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);
const isDocsContentType = (value: unknown): value is DocsContentType => (
    value === 'letter' || value === 'theme' || value === 'ect'
);
const isWordStatus = (value: unknown): value is DocsContentWord['status'] => (
    value === 'add' || value === 'delete' || value === 'ok'
);
const isNullableString = (value: unknown): value is string | null => typeof value === 'string' || value === null;

const parseMetadata = (row: unknown, docsId: number): DocsMetadata | null => {
    if (!isRecord(row)
        || !isPositiveSafeInteger(row.id)
        || row.id !== docsId
        || typeof row.name !== 'string'
        || typeof row.last_update !== 'string'
        || !isDocsContentType(row.typez)
        || typeof row.duem !== 'boolean') return null;
    return { id: row.id, title: row.name, lastUpdatedAt: row.last_update, type: row.typez, duem: row.duem };
};

const parseStarredUserIds = (response: QueryResponse): string[] | null => {
    if (response.error !== null || !Array.isArray(response.data)) return null;
    const ids: string[] = [];
    for (const row of response.data) {
        if (!isRecord(row) || typeof row.user_id !== 'string') return null;
        ids.push(row.user_id);
    }
    return ids;
};

const parseWords = (response: QueryResponse): string[] | null => {
    if (response.error !== null || !Array.isArray(response.data)) return null;
    const words: string[] = [];
    for (const row of response.data) {
        if (!isRecord(row) || typeof row.word !== 'string') return null;
        words.push(row.word);
    }
    return words;
};

const parsePendingWords = (response: QueryResponse): PendingWord[] | null => {
    if (response.error !== null || !Array.isArray(response.data)) return null;
    const words: PendingWord[] = [];
    for (const row of response.data) {
        if (!isRecord(row)
            || typeof row.word !== 'string'
            || !isNullableString(row.requested_by)
            || !isWordStatus(row.request_type)
            || row.request_type === 'ok') return null;
        words.push({
            word: row.word,
            status: row.request_type,
            ...(row.requested_by === null ? {} : { requesterNickname: row.requested_by }),
        });
    }
    return words;
};

const parseThemeId = (response: QueryResponse): number | null | undefined => {
    if (response.error !== null) return undefined;
    if (response.data === null) return null;
    if (!isRecord(response.data) || !isPositiveSafeInteger(response.data.id) || typeof response.data.name !== 'string') return undefined;
    return response.data.id;
};

const parseThemeChangeRows = (response: QueryResponse): PendingWord[] | null => {
    if (response.error !== null || !Array.isArray(response.data)) return null;
    const rows: PendingWord[] = [];
    for (const row of response.data) {
        if (!isRecord(row) || !isRecord(row.words) || typeof row.words.word !== 'string'
            || !isNullableString(row.req_by) || !isWordStatus(row.typez) || row.typez === 'ok') return null;
        rows.push({
            word: row.words.word,
            status: row.typez,
            ...(row.req_by === null ? {} : { requesterNickname: row.req_by }),
        });
    }
    return rows;
};

const parseWaitWordThemeRows = (response: QueryResponse): PendingWord[] | null => {
    if (response.error !== null || !Array.isArray(response.data)) return null;
    const rows: PendingWord[] = [];
    for (const row of response.data) {
        if (!isRecord(row) || !isRecord(row.wait_words)) return null;
        const pending = parsePendingWords({ data: [row.wait_words], error: null });
        if (pending === null) return null;
        rows.push(...pending.filter(({ status }) => status === 'add'));
    }
    return rows;
};

const toContentWords = (approvedWords: string[], pendingWords: PendingWord[]): DocsContentWord[] => {
    const pendingWordNames = new Set(pendingWords.map(({ word }) => word));
    return [
        ...approvedWords.filter((word) => !pendingWordNames.has(word)).map((word) => ({ word, status: 'ok' as const })),
        ...pendingWords,
    ];
};

const selectMissionWords = (words: string[], targetChar: string, useLastChar: boolean): string[] => {
    const grouped = new Map<string, string[]>();
    for (const word of words) {
        const key = useLastChar ? word[word.length - 1] : word[0];
        const values = grouped.get(key) ?? [];
        values.push(word);
        grouped.set(key, values);
    }

    return [...grouped.values()].flatMap((group) => {
        const multi = group.filter((word) => word.split(targetChar).length - 1 >= 2);
        const single = group.filter((word) => word.split(targetChar).length - 1 === 1)
            .sort((left, right) => right.length - left.length || left.localeCompare(right));
        return [...multi, ...single.slice(0, Math.max(0, 10 - multi.length))];
    });
};

/** Supabase 원시 행을 docs 본문 화면용 projection으로 조립합니다. */
export class SupabaseDocsContentQueryGateway implements DocsContentQueryGateway {
    constructor(
        private readonly client: DocsContentQueryClient = browserSupabaseClient as unknown as DocsContentQueryClient,
    ) {}

    async loadByDocsId(docsId: number): Promise<Result<DocsContentProjection | null>> {
        try {
            const docsResponse = await this.client.from('docs')
                .select('id, name, last_update, typez, duem').eq('id', docsId).maybeSingle();
            if (!isRecord(docsResponse) || docsResponse.error !== null) return err(infrastructureError());
            if (docsResponse.data === null) return ok(null);
            const metadata = parseMetadata(docsResponse.data, docsId);
            if (metadata === null) return err(infrastructureError());

            const starsResponse = await this.client.from('user_star_docs').select('user_id').eq('docs_id', docsId);
            if (!isRecord(starsResponse)) return err(infrastructureError());
            const starredUserIds = parseStarredUserIds(starsResponse);
            if (starredUserIds === null) return err(infrastructureError());

            const words = MARKER_DOCS_IDS.has(docsId)
                ? []
                : await this.loadWords(metadata);
            if (words === undefined) return err(infrastructureError());
            if (words === null) return ok(null);

            const { duem: _duem, ...projectionMetadata } = metadata;
            return ok({
                metadata: projectionMetadata,
                starredUserIds,
                words,
                isSpecial: isSpecialMissionDocsId(docsId),
            });
        } catch {
            return err(infrastructureError());
        }
    }

    private async loadWords(metadata: DocsMetadata): Promise<DocsContentWord[] | null | undefined> {
        if (metadata.type === 'letter') return this.loadLetterWords(metadata);
        if (metadata.type === 'theme') return this.loadThemeWords(metadata);
        return this.loadEctWords(metadata);
    }

    private async loadLetterWords(metadata: DocsMetadata): Promise<DocsContentWord[] | undefined> {
        const letter = metadata.title.trim()[0];
        const wordsResponse = metadata.duem
            ? await this.client.from('words').select('word')
                .in('last_letter', [...new Set([...reverDuemLaw(letter), ...duemLaw(letter)])])
                .eq('k_canuse', true).neq('length', 1)
            : await this.client.from('words').select('word')
                .eq('last_letter', letter).eq('k_canuse', true).neq('length', 1);
        const approvedWords = parseWords(wordsResponse);
        if (approvedWords === null) return undefined;

        let pendingQuery = this.client.from('wait_words').select('word, requested_by, request_type');
        if (metadata.duem) {
            for (const candidate of reverDuemLaw(letter)) pendingQuery = pendingQuery.ilike('word', `%${candidate}`);
        } else {
            pendingQuery = pendingQuery.ilike('word', letter);
        }
        const pendingWords = parsePendingWords(await pendingQuery);
        if (pendingWords === null) return undefined;
        return toContentWords(approvedWords, pendingWords.filter(({ word }) => word.length > 1));
    }

    private async loadThemeWords(metadata: DocsMetadata): Promise<DocsContentWord[] | null | undefined> {
        const themeResponse = await this.client.from('themes').select('id, name').eq('name', metadata.title).maybeSingle();
        const themeId = parseThemeId(themeResponse);
        if (themeId === undefined) return undefined;
        if (themeId === null) return null;

        const [wordsResponse, themeChangesResponse, additionsResponse, deletionsResponse] = await Promise.all([
            this.client.rpc('get_words_by_theme', { theme_name: metadata.title }),
            this.client.from('word_themes_wait').select('words(word), typez, req_by').eq('theme_id', themeId),
            this.client.from('wait_word_themes').select('wait_words(word, requested_by, request_type)').eq('theme_id', themeId),
            this.client.rpc('get_delete_requests_by_themeid', { input_theme_id: themeId }),
        ]);
        const approvedWords = parseWords(wordsResponse);
        const themeChanges = parseThemeChangeRows(themeChangesResponse);
        const additions = parseWaitWordThemeRows(additionsResponse);
        const deletions = parsePendingWords(deletionsResponse);
        if (approvedWords === null || themeChanges === null || additions === null || deletions === null) return undefined;

        const pendingWords = [...additions, ...deletions];
        const pendingNames = new Set(pendingWords.map(({ word }) => word));
        for (const change of themeChanges) {
            if (!pendingNames.has(change.word)) {
                pendingWords.push(change);
                pendingNames.add(change.word);
            }
        }
        return toContentWords(approvedWords, pendingWords);
    }

    private async loadEctWords(metadata: DocsMetadata): Promise<DocsContentWord[] | null | undefined> {
        if (metadata.id === 201 || metadata.id === 202) {
            const [wordsResponse, pendingResponse] = await Promise.all([
                this.client.from('words').select('word').eq('k_canuse', true).gt('length', 8),
                this.client.rpc('get_long_wait_words_data'),
            ]);
            const approvedWords = parseWords(wordsResponse);
            const pendingWords = parsePendingWords(pendingResponse);
            return approvedWords === null || pendingWords === null ? undefined : toContentWords(approvedWords, pendingWords);
        }

        const ranges: Array<{ start: number; end: number; rpc: string; useLastChar: boolean }> = [
            { start: 209, end: 222, rpc: 'get_mission_words', useLastChar: false },
            { start: 224, end: 237, rpc: 'get_mission_words', useLastChar: true },
            { start: 239, end: 252, rpc: 'get_mission_len3_words', useLastChar: false },
        ];
        const range = ranges.find(({ start, end }) => start <= metadata.id && metadata.id <= end);
        if (range === undefined) return null;
        const targetChar = MISSION_CHARS[metadata.id - range.start];
        const response = await this.client.rpc(range.rpc, { target_mask: 1 << MISSION_CHARS.indexOf(targetChar) });
        const words = parseWords(response);
        return words === null ? undefined : selectMissionWords(words, targetChar, range.useLastChar)
            .map((word) => ({ word, status: 'ok' }));
    }
}

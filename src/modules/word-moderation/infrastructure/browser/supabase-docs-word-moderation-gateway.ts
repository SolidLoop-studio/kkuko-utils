import type { DocsWordMutationTargetGateway } from '../../application/docs-word-moderation-ports';
import type {
    DocsWordMutationTarget,
    GetDocsWordMutationTargetsQuery,
    GetDocsWordMutationTargetsResult,
} from '../../application/docs-word-moderation-types';
import { err, ok, type Result } from '../../../../shared/application/result';
import { browserSupabaseClient } from '../../../../shared/infrastructure/supabase/browser-client';

type QueryResponse = {
    data: unknown;
    error: unknown | null;
};

interface SupabaseFilterBuilder {
    eq(column: string, value: unknown): SupabaseFilterBuilder;
    in(column: string, values: readonly unknown[]): Promise<QueryResponse>;
    maybeSingle(): Promise<QueryResponse>;
}

interface SupabaseSelectBuilder {
    select(columns: string): SupabaseFilterBuilder;
}

interface DocsWordModerationQueryClient {
    from(table: string): SupabaseSelectBuilder;
}

type DocsRow = {
    name: string;
    typez: 'letter' | 'theme' | 'ect';
};

type WaitWordRow = {
    id: number;
    word: string;
    requestType: 'add' | 'delete';
    selectedThemeIds: number[];
};

type WordRow = {
    id: number;
    word: string;
};

type ThemeChangeRow = {
    wordId: number;
    themeId: number;
    type: 'add' | 'delete';
    word: string;
};

const WORD_QUERY_CHUNK_SIZE = 100;

const infrastructureError = () => ({
    kind: 'infrastructure' as const,
    message: '문서 단어 작업 정보를 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

const isMutationType = (value: unknown): value is 'add' | 'delete' => (
    value === 'add' || value === 'delete'
);

const readResponseData = (value: unknown): { isValid: true; data: unknown } | { isValid: false } => {
    if (!isRecord(value) || !('data' in value) || !('error' in value) || value.error !== null) {
        return { isValid: false };
    }
    return { isValid: true, data: value.data };
};

const parseDocsRow = (value: unknown): DocsRow | null | undefined => {
    if (value === null) {
        return null;
    }
    if (!isRecord(value)
        || typeof value.name !== 'string'
        || (value.typez !== 'letter' && value.typez !== 'theme' && value.typez !== 'ect')) {
        return undefined;
    }
    return { name: value.name, typez: value.typez };
};

const parseThemeId = (value: unknown): number | null | undefined => {
    if (value === null) {
        return null;
    }
    if (!isRecord(value) || !isPositiveSafeInteger(value.id)) {
        return undefined;
    }
    return value.id;
};

const parseWaitWordRows = (value: unknown): WaitWordRow[] | null => {
    if (!Array.isArray(value)) {
        return null;
    }

    const rows: WaitWordRow[] = [];
    for (const rawRow of value) {
        if (!isRecord(rawRow)
            || !isPositiveSafeInteger(rawRow.id)
            || typeof rawRow.word !== 'string'
            || !isMutationType(rawRow.request_type)
            || !Array.isArray(rawRow.wait_word_themes)) {
            return null;
        }

        const selectedThemeIds: number[] = [];
        for (const rawTheme of rawRow.wait_word_themes) {
            if (!isRecord(rawTheme) || !isPositiveSafeInteger(rawTheme.theme_id)) {
                return null;
            }
            selectedThemeIds.push(rawTheme.theme_id);
        }

        rows.push({
            id: rawRow.id,
            word: rawRow.word,
            requestType: rawRow.request_type,
            selectedThemeIds: Array.from(new Set(selectedThemeIds)).sort(
                (left, right) => left - right,
            ),
        });
    }
    return rows;
};

const parseWordRows = (value: unknown): WordRow[] | null => {
    if (!Array.isArray(value)) {
        return null;
    }

    const rows: WordRow[] = [];
    for (const rawRow of value) {
        if (!isRecord(rawRow)
            || !isPositiveSafeInteger(rawRow.id)
            || typeof rawRow.word !== 'string') {
            return null;
        }
        rows.push({ id: rawRow.id, word: rawRow.word });
    }
    return rows;
};

const parseThemeChangeRows = (value: unknown): ThemeChangeRow[] | null => {
    if (!Array.isArray(value)) {
        return null;
    }

    const rows: ThemeChangeRow[] = [];
    for (const rawRow of value) {
        if (!isRecord(rawRow)
            || !isPositiveSafeInteger(rawRow.word_id)
            || !isPositiveSafeInteger(rawRow.theme_id)
            || !isMutationType(rawRow.typez)
            || !isRecord(rawRow.words)
            || typeof rawRow.words.word !== 'string') {
            return null;
        }
        rows.push({
            wordId: rawRow.word_id,
            themeId: rawRow.theme_id,
            type: rawRow.typez,
            word: rawRow.words.word,
        });
    }
    return rows;
};

const groupByWord = <T extends { word: string }>(rows: T[]): Map<string, T[]> => {
    const grouped = new Map<string, T[]>();
    for (const row of rows) {
        const existing = grouped.get(row.word);
        if (existing) {
            existing.push(row);
        } else {
            grouped.set(row.word, [row]);
        }
    }
    return grouped;
};

/** 문서 행을 현재 DB 식별자 기반의 관리자 작업 대상으로 조회합니다. */
export class SupabaseDocsWordModerationGateway implements DocsWordMutationTargetGateway {
    constructor(
        private readonly queryClient: DocsWordModerationQueryClient = browserSupabaseClient as unknown as DocsWordModerationQueryClient,
    ) {}

    async getTargets(
        query: GetDocsWordMutationTargetsQuery,
    ): Promise<Result<GetDocsWordMutationTargetsResult>> {
        if (query.rows.length === 0) {
            return ok({ targets: [] });
        }

        try {
            const rawDocsResponse = await this.queryClient
                .from('docs')
                .select('name, typez')
                .eq('id', query.docsId)
                .maybeSingle();
            const docsResponse = readResponseData(rawDocsResponse);
            if (!docsResponse.isValid) {
                return err(infrastructureError());
            }

            const docs = parseDocsRow(docsResponse.data);
            if (docs === undefined) {
                return err(infrastructureError());
            }
            if (docs === null) {
                return ok({ targets: query.rows.map(() => null) });
            }

            let themeId: number | null = null;
            if (docs.typez === 'theme') {
                const rawThemeResponse = await this.queryClient
                    .from('themes')
                    .select('id')
                    .eq('name', docs.name)
                    .maybeSingle();
                const themeResponse = readResponseData(rawThemeResponse);
                if (!themeResponse.isValid) {
                    return err(infrastructureError());
                }

                const parsedThemeId = parseThemeId(themeResponse.data);
                if (parsedThemeId === undefined) {
                    return err(infrastructureError());
                }
                themeId = parsedThemeId;
            }

            const waitWords: WaitWordRow[] = [];
            const words: WordRow[] = [];
            const themeChanges: ThemeChangeRow[] = [];
            const queryWords = Array.from(new Set(query.rows.map(({ word }) => word)));

            for (let start = 0; start < queryWords.length; start += WORD_QUERY_CHUNK_SIZE) {
                const chunkWords = queryWords.slice(start, start + WORD_QUERY_CHUNK_SIZE);
                const waitWordsPromise = this.queryClient
                    .from('wait_words')
                    .select('id, word, request_type, wait_word_themes(theme_id)')
                    .in('word', chunkWords);
                const wordsPromise = this.queryClient
                    .from('words')
                    .select('id, word')
                    .in('word', chunkWords);
                const themeChangesPromise = themeId === null
                    ? null
                    : this.queryClient
                        .from('word_themes_wait')
                        .select('word_id, theme_id, typez, words!inner(word)')
                        .eq('theme_id', themeId)
                        .in('words.word', chunkWords);

                const [rawWaitWordsResponse, rawWordsResponse, rawThemeChangesResponse] = await Promise.all([
                    waitWordsPromise,
                    wordsPromise,
                    themeChangesPromise,
                ]);
                const waitWordsResponse = readResponseData(rawWaitWordsResponse);
                const wordsResponse = readResponseData(rawWordsResponse);
                const themeChangesResponse = rawThemeChangesResponse === null
                    ? null
                    : readResponseData(rawThemeChangesResponse);
                if (!waitWordsResponse.isValid
                    || !wordsResponse.isValid
                    || (themeChangesResponse !== null && !themeChangesResponse.isValid)) {
                    return err(infrastructureError());
                }

                const parsedWaitWords = parseWaitWordRows(waitWordsResponse.data);
                const parsedWords = parseWordRows(wordsResponse.data);
                const parsedThemeChanges = themeChangesResponse === null
                    ? []
                    : parseThemeChangeRows(themeChangesResponse.data);
                if (parsedWaitWords === null
                    || parsedWords === null
                    || parsedThemeChanges === null) {
                    return err(infrastructureError());
                }

                waitWords.push(...parsedWaitWords);
                words.push(...parsedWords);
                themeChanges.push(...parsedThemeChanges);
            }

            const waitWordsByWord = groupByWord(waitWords);
            const wordsByWord = groupByWord(words);
            const themeChangesByWord = groupByWord(themeChanges);
            const targets = query.rows.map<DocsWordMutationTarget | null>(({ word, status }) => {
                if (status === 'ok') {
                    const registeredCandidates = wordsByWord.get(word) ?? [];
                    return registeredCandidates.length === 1
                        ? { kind: 'registered-word', wordId: registeredCandidates[0].id }
                        : null;
                }

                const wholeWordCandidates = waitWordsByWord.get(word) ?? [];
                const matchingWholeWordCandidates = wholeWordCandidates.filter(
                    ({ requestType }) => requestType === status,
                );
                if (matchingWholeWordCandidates.length === 1) {
                    const candidate = matchingWholeWordCandidates[0];
                    return {
                        kind: 'word-request',
                        requestId: candidate.id,
                        requestType: candidate.requestType,
                        selectedThemeIds: candidate.selectedThemeIds,
                    };
                }
                if (matchingWholeWordCandidates.length > 1 || wholeWordCandidates.length > 0) {
                    return null;
                }

                if (themeId === null) {
                    return null;
                }
                const matchingThemeChanges = (themeChangesByWord.get(word) ?? []).filter(
                    (candidate) => candidate.themeId === themeId && candidate.type === status,
                );
                return matchingThemeChanges.length === 1
                    ? {
                        kind: 'theme-change',
                        wordId: matchingThemeChanges[0].wordId,
                        themeId: matchingThemeChanges[0].themeId,
                        type: matchingThemeChanges[0].type,
                    }
                    : null;
            });

            return ok({ targets });
        } catch {
            return err(infrastructureError());
        }
    }
}

import type { ApplicationError } from '../../../../shared/application/application-error';
import { err, ok, type Result } from '../../../../shared/application/result';
import type { WordCatalogQueryGateway } from '../../application/word-search-ports';
import type {
    AdvancedWordSearchQuery,
    WordSearchResult,
    WordThemeSummary,
} from '../../application/word-search-types';

type SupabaseResponse = {
    data: unknown;
    error: unknown;
};

export interface SupabaseWordCatalogQueryClient {
    from(table: string): {
        select(columns: string): PromiseLike<SupabaseResponse> & {
            ilike(column: string, pattern: string): Promise<SupabaseResponse>;
        };
    };
    rpc(functionName: string, args: Record<string, unknown>): Promise<SupabaseResponse>;
}

type FirstLetterCount = {
    firstLetter: string;
    kCount: number;
    nCount: number;
    len3KCount: number;
    len3NCount: number;
};

type LastLetterCount = {
    lastLetter: string;
    kCount: number;
    nCount: number;
};

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '데이터를 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isNonBlankString = (value: unknown): value is string => (
    typeof value === 'string' && value.trim().length > 0
);

const isNonNegativeSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

const parseResponseRows = (response: unknown): unknown[] | null => {
    if (!isRecord(response) || !('data' in response) || !('error' in response)
        || response.error !== null || !Array.isArray(response.data)) {
        return null;
    }
    return response.data;
};

const parseWordRows = (rows: unknown[]): string[] | null => {
    const words: string[] = [];
    for (const row of rows) {
        if (!isRecord(row) || !isNonBlankString(row.word)) {
            return null;
        }
        words.push(row.word);
    }
    return words;
};

const parseFirstLetterCounts = (rows: unknown[]): Map<string, FirstLetterCount> | null => {
    const counts = new Map<string, FirstLetterCount>();
    for (const row of rows) {
        if (!isRecord(row)
            || !isNonBlankString(row.first_letter)
            || !isNonNegativeSafeInteger(row.count)
            || !isNonNegativeSafeInteger(row.k_count)
            || !isNonNegativeSafeInteger(row.n_count)
            || !isNonNegativeSafeInteger(row.len3_k_count)
            || !isNonNegativeSafeInteger(row.len3_n_count)) {
            return null;
        }
        counts.set(row.first_letter, {
            firstLetter: row.first_letter,
            kCount: row.k_count,
            nCount: row.n_count,
            len3KCount: row.len3_k_count,
            len3NCount: row.len3_n_count,
        });
    }
    return counts;
};

const parseLastLetterCounts = (rows: unknown[]): Map<string, LastLetterCount> | null => {
    const counts = new Map<string, LastLetterCount>();
    for (const row of rows) {
        if (!isRecord(row)
            || !isNonBlankString(row.last_letter)
            || !isNonNegativeSafeInteger(row.count)
            || !isNonNegativeSafeInteger(row.k_count)
            || !isNonNegativeSafeInteger(row.n_count)) {
            return null;
        }
        counts.set(row.last_letter, {
            lastLetter: row.last_letter,
            kCount: row.k_count,
            nCount: row.n_count,
        });
    }
    return counts;
};

const parseThemes = (rows: unknown[]): WordThemeSummary[] | null => {
    const themes: WordThemeSummary[] = [];
    for (const row of rows) {
        if (!isRecord(row)
            || !isPositiveSafeInteger(row.id)
            || !isNonBlankString(row.code)
            || !isNonBlankString(row.name)) {
            return null;
        }
        themes.push({ id: row.id, code: row.code, name: row.name });
    }
    return themes;
};

/** Supabase 조회 결과를 word-catalog DTO로 변환한다. */
export class SupabaseWordCatalogQueryGateway implements WordCatalogQueryGateway {
    constructor(
        private readonly client: SupabaseWordCatalogQueryClient,
    ) {}

    async suggestWords(query: string): Promise<Result<string[]>> {
        try {
            const approvedRows = parseResponseRows(await this.client
                .from('words')
                .select('word')
                .ilike('word', `${query}%`));
            if (approvedRows === null) {
                return err(infrastructureError());
            }
            const pendingRows = parseResponseRows(await this.client
                .from('wait_words')
                .select('word')
                .ilike('word', `${query}%`));
            if (pendingRows === null) {
                return err(infrastructureError());
            }

            const approvedWords = parseWordRows(approvedRows);
            const pendingWords = parseWordRows(pendingRows);
            if (approvedWords === null || pendingWords === null) {
                return err(infrastructureError());
            }

            return ok([...new Set([...approvedWords, ...pendingWords])]
                .sort((left, right) => left.length - right.length));
        } catch {
            return err(infrastructureError());
        }
    }

    async searchAdvanced(query: AdvancedWordSearchQuery): Promise<Result<WordSearchResult[]>> {
        try {
            const letterCounts = await this.loadLetterCounts();
            if (!letterCounts.ok) {
                return letterCounts;
            }

            const response = await this.client.rpc(
                this.advancedRpcName(query),
                this.advancedRpcArgs(query),
            );
            const rows = parseResponseRows(response);
            if (rows === null) {
                return err(infrastructureError());
            }
            const words = parseWordRows(rows);
            if (words === null) {
                return err(infrastructureError());
            }

            return ok(this.mapAdvancedWords(query, words, letterCounts.value));
        } catch {
            return err(infrastructureError());
        }
    }

    async listThemes(): Promise<Result<WordThemeSummary[]>> {
        try {
            const rows = parseResponseRows(await this.client.from('themes').select('id, code, name'));
            if (rows === null) {
                return err(infrastructureError());
            }
            const themes = parseThemes(rows);
            return themes === null ? err(infrastructureError()) : ok(themes);
        } catch {
            return err(infrastructureError());
        }
    }

    private async loadLetterCounts(): Promise<Result<{
        first: Map<string, FirstLetterCount>;
        last: Map<string, LastLetterCount>;
    }>> {
        const firstRows = parseResponseRows(await this.client
            .from('word_first_letter_counts')
            .select('*'));
        if (firstRows === null) {
            return err(infrastructureError());
        }
        const lastRows = parseResponseRows(await this.client
            .from('word_last_letter_counts')
            .select('*'));
        if (lastRows === null) {
            return err(infrastructureError());
        }

        const first = parseFirstLetterCounts(firstRows);
        const last = parseLastLetterCounts(lastRows);
        return first === null || last === null
            ? err(infrastructureError())
            : ok({ first, last });
    }

    private advancedRpcName(query: AdvancedWordSearchQuery): string {
        switch (query.mode) {
            case 'kor-start': return 'get_korean_words_advanced_s';
            case 'kor-end': return 'get_korean_words_advanced_e';
            case 'kung': return 'get_korean_words_advanced_kung';
            case 'hunmin': return 'get_korean_words_advanced_hunmin';
            case 'jaqi': return 'get_korean_words_advanced_jaqi';
        }
    }

    private advancedRpcArgs(query: AdvancedWordSearchQuery): Record<string, unknown> {
        switch (query.mode) {
            case 'kor-start':
            case 'kor-end':
                return {
                    p_start: query.start,
                    p_end: query.end,
                    p_length_max: query.maximumLength,
                    p_length_min: query.minimumLength,
                    p_man: query.isManner,
                    p_eti: query.isEtiquette,
                    p_jen: query.isJen,
                    p_ingjung: query.isAcceptedOnly,
                    p_limit: query.limit,
                    p_mission: query.mission,
                    p_sort_by: query.sortOrder,
                    p_duem: query.isDuemApplied,
                };
            case 'kung':
                return {
                    p_start: query.start,
                    p_end: query.end,
                    p_man: query.isManner,
                    p_eti: query.isEtiquette,
                    p_jen: query.isJen,
                    p_ingjung: query.isAcceptedOnly,
                    p_limit: query.limit,
                    p_mission: query.mission,
                    p_sort_by: query.sortOrder,
                };
            case 'hunmin':
                return {
                    p_chosungs: query.query,
                    p_limit: query.limit,
                    p_mission: query.mission === '' ? undefined : query.mission,
                };
            case 'jaqi':
                return { p_chosungs: query.query, p_theme_id: query.themeId };
        }
    }

    private mapAdvancedWords(
        query: AdvancedWordSearchQuery,
        words: string[],
        letterCounts: { first: Map<string, FirstLetterCount>; last: Map<string, LastLetterCount> },
    ): WordSearchResult[] {
        switch (query.mode) {
            case 'kor-start':
                return words.map((word) => ({
                    word,
                    nextWordCount: letterCounts.first.get(word[word.length - 1])?.[
                        query.isAcceptedOnly ? 'kCount' : 'nCount'
                    ] ?? 0,
                }));
            case 'kor-end':
                return words.map((word) => ({
                    word,
                    nextWordCount: letterCounts.last.get(word[0])?.[
                        query.isAcceptedOnly ? 'kCount' : 'nCount'
                    ] ?? 0,
                }));
            case 'kung':
                return words.map((word) => ({
                    word,
                    nextWordCount: letterCounts.first.get(word[word.length - 1])?.[
                        query.isAcceptedOnly ? 'len3KCount' : 'len3NCount'
                    ] ?? 0,
                }));
            case 'hunmin':
                return words.map((word) => ({ word, nextWordCount: -1 }));
            case 'jaqi':
                return [...words]
                    .sort((left, right) => right.length - left.length)
                    .map((word) => ({ word, nextWordCount: -1 }));
        }
    }
}

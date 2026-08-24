import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { WordStatisticsQueryGateway } from '../../application/word-statistics-ports';
import type { WordStatisticEntry, WordStatistics } from '../../application/word-statistics-types';

type QueryResponse = { data: unknown; error: unknown };

interface WordStatisticsQueryBuilder extends PromiseLike<QueryResponse> {
    select(columns: string): WordStatisticsQueryBuilder;
}

export interface SupabaseWordStatisticsQueryClient {
    from(table: 'word_first_letter_counts' | 'word_last_letter_counts'): WordStatisticsQueryBuilder;
}

const infrastructureError = () => ({
    kind: 'infrastructure' as const,
    message: '데이터를 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isNonBlankString = (value: unknown): value is string => (
    typeof value === 'string' && value.trim().length > 0
);

const isTimestamp = (value: unknown): value is string | null => (
    typeof value === 'string' || value === null
);

const isCount = (value: unknown): value is number => (
    typeof value === 'number' && Number.isFinite(value)
);

const parseRows = (response: unknown): unknown[] | null => (
    isRecord(response) && response.error === null && Array.isArray(response.data)
        ? response.data
        : null
);

const parseStatisticEntry = (
    row: unknown,
    letterColumn: string,
    acknowledgedCountColumn: string,
    notAcknowledgedCountColumn: string,
    acknowledgedUpdatedAtColumn: string,
    notAcknowledgedUpdatedAtColumn: string,
): WordStatisticEntry | null => {
    if (!isRecord(row)
        || !isNonBlankString(row[letterColumn])
        || !isCount(row[acknowledgedCountColumn])
        || !isCount(row[notAcknowledgedCountColumn])
        || !isTimestamp(row[acknowledgedUpdatedAtColumn])
        || !isTimestamp(row[notAcknowledgedUpdatedAtColumn])) {
        return null;
    }

    return {
        letter: row[letterColumn],
        acknowledgedCount: row[acknowledgedCountColumn],
        notAcknowledgedCount: row[notAcknowledgedCountColumn],
        acknowledgedUpdatedAt: row[acknowledgedUpdatedAtColumn],
        notAcknowledgedUpdatedAt: row[notAcknowledgedUpdatedAtColumn],
    };
};

const parseFirstLetterRows = (rows: unknown[]): Pick<WordStatistics, 'firstLetter' | 'threeLetter'> | null => {
    const firstLetter: WordStatisticEntry[] = [];
    const threeLetter: WordStatisticEntry[] = [];

    for (const row of rows) {
        const firstLetterEntry = parseStatisticEntry(
            row,
            'first_letter',
            'k_count',
            'n_count',
            'k_count_updated_at',
            'n_count_updated_at',
        );
        const threeLetterEntry = parseStatisticEntry(
            row,
            'first_letter',
            'len3_k_count',
            'len3_n_count',
            'len3_k_count_updated_at',
            'len3_n_count_updated_at',
        );
        if (firstLetterEntry === null || threeLetterEntry === null) return null;

        firstLetter.push(firstLetterEntry);
        threeLetter.push(threeLetterEntry);
    }

    return { firstLetter, threeLetter };
};

const parseLastLetterRows = (rows: unknown[]): WordStatisticEntry[] | null => {
    const lastLetter: WordStatisticEntry[] = [];
    for (const row of rows) {
        const entry = parseStatisticEntry(
            row,
            'last_letter',
            'k_count',
            'n_count',
            'k_count_updated_at',
            'n_count_updated_at',
        );
        if (entry === null) return null;
        lastLetter.push(entry);
    }
    return lastLetter;
};

/** Supabase 문자별 단어 통계 데이터를 단어 통계 DTO로 투영한다. */
export class SupabaseWordStatisticsQueryGateway implements WordStatisticsQueryGateway {
    constructor(
        private readonly client: SupabaseWordStatisticsQueryClient = (
            browserSupabaseClient as unknown as SupabaseWordStatisticsQueryClient
        ),
    ) {}

    async load(): Promise<Result<WordStatistics>> {
        try {
            const [firstLetterResponse, lastLetterResponse] = await Promise.all([
                this.client.from('word_first_letter_counts').select(
                    'first_letter, k_count, n_count, k_count_updated_at, n_count_updated_at, len3_k_count, len3_n_count, len3_k_count_updated_at, len3_n_count_updated_at',
                ),
                this.client.from('word_last_letter_counts').select(
                    'last_letter, k_count, n_count, k_count_updated_at, n_count_updated_at',
                ),
            ]);
            const firstLetterRows = parseRows(firstLetterResponse);
            const lastLetterRows = parseRows(lastLetterResponse);
            if (firstLetterRows === null || lastLetterRows === null) return err(infrastructureError());

            const firstLetterStatistics = parseFirstLetterRows(firstLetterRows);
            const lastLetter = parseLastLetterRows(lastLetterRows);
            if (firstLetterStatistics === null || lastLetter === null) return err(infrastructureError());

            return ok({ ...firstLetterStatistics, lastLetter });
        } catch {
            return err(infrastructureError());
        }
    }
}

import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { WordCombinerCandidateQueryGateway } from '../../application/word-combiner-candidate-ports';
import type { WordCombinerCandidate } from '../../application/word-combiner-candidate-types';

type QueryResponse = { data: unknown; error: unknown };
type DownloadResponse = {
    data: { text(): Promise<string> } | null;
    error: unknown;
};

interface WordCombinerCandidateQueryBuilder extends PromiseLike<QueryResponse> {
    select(columns: string): WordCombinerCandidateQueryBuilder;
    in(column: string, values: readonly unknown[]): WordCombinerCandidateQueryBuilder;
}

interface WordCombinerCandidateStorageBucket {
    download(path: string): Promise<DownloadResponse>;
}

export interface SupabaseWordCombinerCandidateQueryClient {
    from(table: 'words'): WordCombinerCandidateQueryBuilder;
    storage: {
        from(bucket: 'public_img'): WordCombinerCandidateStorageBucket;
    };
}

const infrastructureError = () => ({
    kind: 'infrastructure' as const,
    message: '단어 조합기 데이터를 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const hasCombinerLength = (word: string): boolean => word.length === 5 || word.length === 6;

const parseAcceptedWords = (response: unknown): string[] | null => {
    if (!isRecord(response) || response.error !== null || !Array.isArray(response.data)) return null;

    const words: string[] = [];
    for (const row of response.data) {
        if (!isRecord(row) || typeof row.word !== 'string' || !hasCombinerLength(row.word)) return null;
        words.push(row.word);
    }
    return words;
};

const parseEnglishWords = (text: string): string[] => text
    .split(/\r?\n/)
    .map((word) => word.trim())
    .filter(hasCombinerLength);

const compareWords = (left: string, right: string): number => {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
};

/** Supabase 단어와 공개 영문 목록을 조합기 후보 DTO로 투영한다. */
export class SupabaseWordCombinerCandidateQueryGateway implements WordCombinerCandidateQueryGateway {
    constructor(
        private readonly client: SupabaseWordCombinerCandidateQueryClient = (
            browserSupabaseClient as unknown as SupabaseWordCombinerCandidateQueryClient
        ),
    ) {}

    async load(): Promise<Result<WordCombinerCandidate[]>> {
        try {
            const acceptedResponse = await this.client
                .from('words')
                .select('word')
                .in('length', [5, 6]);
            const acceptedWords = parseAcceptedWords(acceptedResponse);
            if (acceptedWords === null) return err(infrastructureError());

            const englishResponse = await this.client.storage
                .from('public_img')
                .download('txt/eng_len_6_words.txt');
            if (englishResponse.error !== null || englishResponse.data === null) {
                return err(infrastructureError());
            }
            const englishWords = parseEnglishWords(await englishResponse.data.text());

            const uniqueWords = new Set<string>(acceptedWords);
            for (const word of englishWords) uniqueWords.add(word);

            return ok([...uniqueWords]
                .sort(compareWords)
                .map((word) => ({ word })));
        } catch {
            return err(infrastructureError());
        }
    }
}

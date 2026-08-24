import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { WordDownloadQueryGateway } from '../../application/word-download-ports';
import type {
    WordDownloadFilter,
    WordDownloadPendingRequest,
    WordDownloadRegisteredWord,
    WordDownloadSource,
} from '../../application/word-download-types';

type QueryResponse = { data: unknown; error: unknown };

interface WordDownloadQueryBuilder extends PromiseLike<QueryResponse> {
    select(columns: string): WordDownloadQueryBuilder;
    eq(column: string, value: unknown): WordDownloadQueryBuilder;
}

export interface SupabaseWordDownloadQueryClient {
    from(table: 'words' | 'wait_words'): WordDownloadQueryBuilder;
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

const parseRows = (response: unknown): unknown[] | null => (
    isRecord(response) && response.error === null && Array.isArray(response.data)
        ? response.data
        : null
);

const parseRegisteredWord = (row: unknown): WordDownloadRegisteredWord | null => {
    if (!isRecord(row) || !isNonBlankString(row.word)
        || typeof row.noin_canuse !== 'boolean' || typeof row.k_canuse !== 'boolean') {
        return null;
    }
    return {
        word: row.word,
        isNoInjung: row.noin_canuse,
        canUseInWordChain: row.k_canuse,
    };
};

const parsePendingRequest = (row: unknown): WordDownloadPendingRequest | null => {
    if (!isRecord(row) || !isNonBlankString(row.word)
        || (row.request_type !== 'add' && row.request_type !== 'delete')) {
        return null;
    }
    return { word: row.word, type: row.request_type };
};

const parseSource = (wordRows: unknown[], pendingRows: unknown[]): WordDownloadSource | null => {
    const registeredWords: WordDownloadRegisteredWord[] = [];
    for (const row of wordRows) {
        const word = parseRegisteredWord(row);
        if (word === null) return null;
        registeredWords.push(word);
    }

    const pendingRequests: WordDownloadPendingRequest[] = [];
    for (const row of pendingRows) {
        const request = parsePendingRequest(row);
        if (request === null) return null;
        pendingRequests.push(request);
    }
    return { registeredWords, pendingRequests };
};

/** Supabase 단어와 대기 요청 데이터를 다운로드용 DTO로 투영한다. */
export class SupabaseWordDownloadQueryGateway implements WordDownloadQueryGateway {
    constructor(
        private readonly client: SupabaseWordDownloadQueryClient = (
            browserSupabaseClient as unknown as SupabaseWordDownloadQueryClient
        ),
    ) {}

    async load(filter: Pick<WordDownloadFilter,
        'includeAcknowledged' | 'includeNotAcknowledged' | 'onlyWordChain'
    >): Promise<Result<WordDownloadSource>> {
        try {
            let wordsQuery = this.client.from('words').select('word, noin_canuse, k_canuse');
            if (filter.includeAcknowledged !== filter.includeNotAcknowledged) {
                wordsQuery = wordsQuery.eq('noin_canuse', filter.includeNotAcknowledged);
            }
            if (filter.onlyWordChain) {
                wordsQuery = wordsQuery.eq('k_canuse', true);
            }

            const [wordRows, pendingRows] = await Promise.all([
                wordsQuery,
                this.client.from('wait_words').select('word, request_type'),
            ]);
            const parsedWords = parseRows(wordRows);
            const parsedPending = parseRows(pendingRows);
            if (parsedWords === null || parsedPending === null) return err(infrastructureError());

            const source = parseSource(parsedWords, parsedPending);
            return source === null ? err(infrastructureError()) : ok(source);
        } catch {
            return err(infrastructureError());
        }
    }
}

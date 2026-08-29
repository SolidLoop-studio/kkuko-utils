import { err, ok } from '@/src/shared/application/result';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn(), storage: { from: jest.fn() } },
}));

import { SupabaseWordCombinerCandidateQueryGateway } from '@/src/modules/word-catalog/infrastructure/browser/supabase-word-combiner-candidate-query-gateway';

type QueryResponse = { data: unknown; error: unknown };
type DownloadResponse = { data: { text(): Promise<string> } | null; error: unknown };
type Operation = { method: 'from' | 'select' | 'in' | 'storage.from' | 'download'; args: unknown[] };

class FakeWordsQuery implements PromiseLike<QueryResponse> {
    constructor(
        private readonly result: QueryResponse | Error,
        private readonly operations: Operation[],
    ) {}

    select(columns: string): this {
        this.operations.push({ method: 'select', args: [columns] });
        return this;
    }

    in(column: string, values: readonly unknown[]): this {
        this.operations.push({ method: 'in', args: [column, values] });
        return this;
    }

    then<TResult1 = QueryResponse, TResult2 = never>(
        onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
        return (this.result instanceof Error ? Promise.reject(this.result) : Promise.resolve(this.result))
            .then(onfulfilled, onrejected);
    }
}

const queryResponse = (data: unknown, error: unknown = null): QueryResponse => ({ data, error });

const createClient = ({
    words = queryResponse([]),
    englishText = '',
    downloadError = null,
    textError = null,
}: {
    words?: QueryResponse | Error;
    englishText?: string;
    downloadError?: unknown;
    textError?: Error | null;
} = {}) => {
    const operations: Operation[] = [];
    const downloadResponse: DownloadResponse = {
        data: downloadError === null ? {
            text: () => textError === null ? Promise.resolve(englishText) : Promise.reject(textError),
        } : null,
        error: downloadError,
    };
    const client = {
        from(table: string) {
            operations.push({ method: 'from', args: [table] });
            if (table !== 'words') throw new Error(`unexpected table: ${table}`);
            return new FakeWordsQuery(words, operations);
        },
        storage: {
            from(bucket: string) {
                operations.push({ method: 'storage.from', args: [bucket] });
                return {
                    download(path: string) {
                        operations.push({ method: 'download', args: [path] });
                        return Promise.resolve(downloadResponse);
                    },
                };
            },
        },
    };
    return { client, operations };
};

const infrastructureFailure = err({
    kind: 'infrastructure',
    message: '단어 조합기 데이터를 불러오는 중 오류가 발생했습니다.',
});

describe('SupabaseWordCombinerCandidateQueryGateway', () => {
    test('loads accepted 5/6-character words and the public English list without pending add/delete rows', async () => {
        const { client, operations } = createClient({
            words: queryResponse([
                { word: '바사아자차카', noin_canuse: false, k_canuse: false },
                { word: '가나다라마', noin_canuse: true, k_canuse: true },
            ]),
            englishText: '타파하가나다\r\n네글자어\r\n',
        });

        await expect(new SupabaseWordCombinerCandidateQueryGateway(client).load()).resolves.toEqual(ok([
            { word: '가나다라마' },
            { word: '바사아자차카' },
            { word: '타파하가나다' },
        ]));
        expect(operations).toEqual([
            { method: 'from', args: ['words'] },
            { method: 'select', args: ['word'] },
            { method: 'in', args: ['length', [5, 6]] },
            { method: 'storage.from', args: ['public_img'] },
            { method: 'download', args: ['txt/eng_len_6_words.txt'] },
        ]);
    });

    test('preserves duplicate occurrences across accepted and English sources while sorting deterministically', async () => {
        const { client } = createClient({
            words: queryResponse([
                { word: '타파하가나다' },
                { word: '가나다라마' },
                { word: '가나다라마' },
            ]),
            englishText: '가나다라마\n타파하가나다\n바사아자차카\n바사아자차카',
        });

        await expect(new SupabaseWordCombinerCandidateQueryGateway(client).load()).resolves.toEqual(ok([
            { word: '가나다라마' },
            { word: '가나다라마' },
            { word: '가나다라마' },
            { word: '바사아자차카' },
            { word: '바사아자차카' },
            { word: '타파하가나다' },
            { word: '타파하가나다' },
        ]));
    });

    test('filters a valid string row individually when its JavaScript UTF-16 length is not 5 or 6', async () => {
        const { client } = createClient({
            words: queryResponse([
                { word: '😀가나다라마' },
                { word: '가나다라마' },
            ]),
            englishText: '바사아자차카',
        });

        await expect(new SupabaseWordCombinerCandidateQueryGateway(client).load()).resolves.toEqual(ok([
            { word: '가나다라마' },
            { word: '바사아자차카' },
        ]));
    });

    test.each([
        ['a returned words error', createClient({ words: queryResponse([], { message: 'private words error' }) }).client],
        ['a thrown words error', createClient({ words: new Error('private network error') }).client],
        ['a malformed accepted row', createClient({ words: queryResponse([{ word: null }]) }).client],
        ['a returned storage error', createClient({ downloadError: { message: 'private storage error' } }).client],
        ['a thrown file read error', createClient({ textError: new Error('private blob error') }).client],
    ])('returns the stable safe error for %s', async (_description, client) => {
        await expect(new SupabaseWordCombinerCandidateQueryGateway(client).load())
            .resolves.toEqual(infrastructureFailure);
    });
});

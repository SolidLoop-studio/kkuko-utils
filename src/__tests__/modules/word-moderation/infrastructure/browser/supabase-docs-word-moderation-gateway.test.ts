import type { GetDocsWordMutationTargetsQuery } from '@/src/modules/word-moderation/application/docs-word-moderation-types';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: {},
}));

import { SupabaseDocsWordModerationGateway } from '../../../../../modules/word-moderation/infrastructure/browser/supabase-docs-word-moderation-gateway';

type QueryResponse = {
    data: unknown;
    error: { message: string } | null;
};

type QueryFilter = {
    operator: 'eq' | 'in';
    column: string;
    value: unknown;
};

type QueryCall = {
    table: string;
    columns: string;
    filters: QueryFilter[];
    terminal: 'in' | 'maybeSingle';
};

type QueuedResponse = QueryResponse | Error;

class FakeQueryBuilder {
    private columns = '';
    private readonly filters: QueryFilter[] = [];

    constructor(
        private readonly client: FakeSupabaseClient,
        private readonly table: string,
    ) {}

    select(columns: string): this {
        this.columns = columns;
        return this;
    }

    eq(column: string, value: unknown): this {
        this.filters.push({ operator: 'eq', column, value });
        return this;
    }

    in(column: string, value: readonly unknown[]): Promise<QueryResponse> {
        this.filters.push({ operator: 'in', column, value: [...value] });
        return this.client.complete({
            table: this.table,
            columns: this.columns,
            filters: [...this.filters],
            terminal: 'in',
        });
    }

    maybeSingle(): Promise<QueryResponse> {
        return this.client.complete({
            table: this.table,
            columns: this.columns,
            filters: [...this.filters],
            terminal: 'maybeSingle',
        });
    }
}

class FakeSupabaseClient {
    readonly calls: QueryCall[] = [];

    constructor(private readonly responses: Record<string, QueuedResponse[]>) {}

    from(table: string): FakeQueryBuilder {
        return new FakeQueryBuilder(this, table);
    }

    async complete(call: QueryCall): Promise<QueryResponse> {
        this.calls.push(call);
        const response = this.responses[call.table]?.shift();
        if (response === undefined) {
            throw new Error(`Unexpected query for ${call.table}`);
        }
        if (response instanceof Error) {
            throw response;
        }
        return response;
    }
}

const response = (data: unknown): QueryResponse => ({ data, error: null });

const infrastructureFailure = {
    ok: false,
    error: {
        kind: 'infrastructure',
        message: '문서 단어 작업 정보를 불러오는 중 오류가 발생했습니다.',
    },
};

const query: GetDocsWordMutationTargetsQuery = {
    docsId: 44,
    rows: [
        { word: '가방', status: 'add' },
        { word: '나비', status: 'delete' },
        { word: '다람쥐', status: 'ok' },
    ],
};

describe('SupabaseDocsWordModerationGateway', () => {
    it('maps authoritative whole-word, theme-change, and registered-word targets by input index', async () => {
        const client = new FakeSupabaseClient({
            docs: [response({ name: '동물', typez: 'theme' })],
            themes: [response({ id: 13 })],
            wait_words: [response([{
                id: 7,
                word: '가방',
                request_type: 'add',
                wait_word_themes: [{ theme_id: 9 }, { theme_id: 3 }, { theme_id: 9 }],
            }])],
            words: [response([
                { id: 11, word: '나비' },
                { id: 17, word: '다람쥐' },
            ])],
            word_themes_wait: [response([{
                word_id: 11,
                theme_id: 13,
                typez: 'delete',
                words: { word: '나비' },
            }])],
        });
        const gateway = new SupabaseDocsWordModerationGateway(client);

        await expect(gateway.getTargets(query)).resolves.toEqual({
            ok: true,
            value: {
                targets: [
                    {
                        kind: 'word-request',
                        requestId: 7,
                        requestType: 'add',
                        selectedThemeIds: [3, 9],
                    },
                    {
                        kind: 'theme-change',
                        wordId: 11,
                        themeId: 13,
                        type: 'delete',
                    },
                    { kind: 'registered-word', wordId: 17 },
                ],
            },
        });
        expect(client.calls).toEqual([
            {
                table: 'docs',
                columns: 'name, typez',
                filters: [{ operator: 'eq', column: 'id', value: 44 }],
                terminal: 'maybeSingle',
            },
            {
                table: 'themes',
                columns: 'id',
                filters: [{ operator: 'eq', column: 'name', value: '동물' }],
                terminal: 'maybeSingle',
            },
            {
                table: 'wait_words',
                columns: 'id, word, request_type, wait_word_themes(theme_id)',
                filters: [{
                    operator: 'in',
                    column: 'word',
                    value: ['가방', '나비', '다람쥐'],
                }],
                terminal: 'in',
            },
            {
                table: 'words',
                columns: 'id, word',
                filters: [{
                    operator: 'in',
                    column: 'word',
                    value: ['가방', '나비', '다람쥐'],
                }],
                terminal: 'in',
            },
            {
                table: 'word_themes_wait',
                columns: 'word_id, theme_id, typez, words!inner(word)',
                filters: [
                    { operator: 'eq', column: 'theme_id', value: 13 },
                    {
                        operator: 'in',
                        column: 'words.word',
                        value: ['가방', '나비', '다람쥐'],
                    },
                ],
                terminal: 'in',
            },
        ]);
    });

    it('keeps duplicate input words aligned instead of collapsing them by word', async () => {
        const duplicateWordQuery: GetDocsWordMutationTargetsQuery = {
            docsId: 5,
            rows: [
                { word: '가방', status: 'add' },
                { word: '가방', status: 'delete' },
                { word: '가방', status: 'ok' },
            ],
        };
        const client = new FakeSupabaseClient({
            docs: [response({ name: 'ㄱ', typez: 'letter' })],
            wait_words: [response([
                {
                    id: 8,
                    word: '가방',
                    request_type: 'delete',
                    wait_word_themes: [],
                },
                {
                    id: 7,
                    word: '가방',
                    request_type: 'add',
                    wait_word_themes: [{ theme_id: 9 }],
                },
            ])],
            words: [response([{ id: 17, word: '가방' }])],
        });

        await expect(
            new SupabaseDocsWordModerationGateway(client).getTargets(duplicateWordQuery),
        ).resolves.toEqual({
            ok: true,
            value: {
                targets: [
                    {
                        kind: 'word-request',
                        requestId: 7,
                        requestType: 'add',
                        selectedThemeIds: [9],
                    },
                    {
                        kind: 'word-request',
                        requestId: 8,
                        requestType: 'delete',
                        selectedThemeIds: [],
                    },
                    { kind: 'registered-word', wordId: 17 },
                ],
            },
        });
    });

    it('returns aligned null conflicts for ambiguous, missing, and status-mismatched targets', async () => {
        const conflictQuery: GetDocsWordMutationTargetsQuery = {
            docsId: 6,
            rows: [
                { word: '중복', status: 'add' },
                { word: '없음', status: 'delete' },
                { word: '종류', status: 'add' },
                { word: '등록중복', status: 'ok' },
            ],
        };
        const client = new FakeSupabaseClient({
            docs: [response({ name: 'ㄱ', typez: 'letter' })],
            wait_words: [response([
                { id: 1, word: '중복', request_type: 'add', wait_word_themes: [] },
                { id: 2, word: '중복', request_type: 'add', wait_word_themes: [] },
                { id: 3, word: '종류', request_type: 'delete', wait_word_themes: [] },
            ])],
            words: [response([
                { id: 10, word: '등록중복' },
                { id: 11, word: '등록중복' },
            ])],
        });

        await expect(
            new SupabaseDocsWordModerationGateway(client).getTargets(conflictQuery),
        ).resolves.toEqual({
            ok: true,
            value: { targets: [null, null, null, null] },
        });
    });

    it('returns null when a theme-change candidate is ambiguous or has the wrong type', async () => {
        const themeConflictQuery: GetDocsWordMutationTargetsQuery = {
            docsId: 7,
            rows: [
                { word: '중복', status: 'add' },
                { word: '종류', status: 'delete' },
            ],
        };
        const client = new FakeSupabaseClient({
            docs: [response({ name: '동물', typez: 'theme' })],
            themes: [response({ id: 13 })],
            wait_words: [response([])],
            words: [response([
                { id: 21, word: '중복' },
                { id: 22, word: '종류' },
            ])],
            word_themes_wait: [response([
                { word_id: 21, theme_id: 13, typez: 'add', words: { word: '중복' } },
                { word_id: 21, theme_id: 13, typez: 'add', words: { word: '중복' } },
                { word_id: 22, theme_id: 13, typez: 'add', words: { word: '종류' } },
            ])],
        });

        await expect(
            new SupabaseDocsWordModerationGateway(client).getTargets(themeConflictQuery),
        ).resolves.toEqual({
            ok: true,
            value: { targets: [null, null] },
        });
    });

    it.each([
        [
            'a wait-word row without an ID',
            {
                docs: [response({ name: 'ㄱ', typez: 'letter' })],
                wait_words: [response([{
                    word: '가방',
                    request_type: 'add',
                    wait_word_themes: [],
                }])],
                words: [response([])],
            },
        ],
        [
            'a registered-word row without an ID',
            {
                docs: [response({ name: 'ㄱ', typez: 'letter' })],
                wait_words: [response([])],
                words: [response([{ word: '다람쥐' }])],
            },
        ],
        [
            'a malformed wait-word theme join',
            {
                docs: [response({ name: 'ㄱ', typez: 'letter' })],
                wait_words: [response([{
                    id: 7,
                    word: '가방',
                    request_type: 'add',
                    wait_word_themes: null,
                }])],
                words: [response([])],
            },
        ],
    ])('sanitizes malformed authoritative data for %s', async (_description, responses) => {
        const result = await new SupabaseDocsWordModerationGateway(
            new FakeSupabaseClient(responses),
        ).getTargets(query);

        expect(result).toEqual(infrastructureFailure);
    });

    it('sanitizes malformed theme-change joins', async () => {
        const client = new FakeSupabaseClient({
            docs: [response({ name: '동물', typez: 'theme' })],
            themes: [response({ id: 13 })],
            wait_words: [response([])],
            words: [response([])],
            word_themes_wait: [response([{
                word_id: 11,
                theme_id: 13,
                typez: 'delete',
                words: [{ word: '나비' }],
            }])],
        });

        await expect(
            new SupabaseDocsWordModerationGateway(client).getTargets(query),
        ).resolves.toEqual(infrastructureFailure);
    });

    it.each([
        [
            'a returned PostgREST error',
            { docs: [{ data: null, error: { message: 'private table detail' } }] },
        ],
        [
            'a rejected query',
            { docs: [new Error('private network detail')] },
        ],
    ])('sanitizes %s without exposing raw details', async (_description, responses) => {
        const result = await new SupabaseDocsWordModerationGateway(
            new FakeSupabaseClient(responses),
        ).getTargets(query);

        expect(result).toEqual(infrastructureFailure);
        expect(JSON.stringify(result)).not.toContain('private');
    });

    it('chunks authoritative word reads at 100 words while preserving target order', async () => {
        const rows = Array.from({ length: 101 }, (_, index) => ({
            word: `단어${index}`,
            status: 'ok' as const,
        }));
        const firstWords = rows.slice(0, 100).map(({ word }, index) => ({
            id: index + 1,
            word,
        }));
        const client = new FakeSupabaseClient({
            docs: [response({ name: 'ㄱ', typez: 'letter' })],
            wait_words: [response([]), response([])],
            words: [response(firstWords), response([{ id: 101, word: '단어100' }])],
        });

        const result = await new SupabaseDocsWordModerationGateway(client).getTargets({
            docsId: 8,
            rows,
        });

        expect(result).toEqual({
            ok: true,
            value: {
                targets: rows.map((_, index) => ({
                    kind: 'registered-word',
                    wordId: index + 1,
                })),
            },
        });
        const wordFilters = client.calls
            .filter(({ table }) => table === 'wait_words' || table === 'words')
            .map(({ filters }) => filters.find(({ operator }) => operator === 'in')?.value);
        expect(wordFilters).toEqual([
            rows.slice(0, 100).map(({ word }) => word),
            rows.slice(0, 100).map(({ word }) => word),
            ['단어100'],
            ['단어100'],
        ]);
    });

    it('does not turn one authoritative target into an ambiguity across chunk boundaries', async () => {
        const rows = Array.from({ length: 101 }, () => ({
            word: '반복단어',
            status: 'add' as const,
        }));
        const authoritativeWaitWord = {
            id: 7,
            word: '반복단어',
            request_type: 'add',
            wait_word_themes: [{ theme_id: 9 }],
        };
        const client = new FakeSupabaseClient({
            docs: [response({ name: 'ㄱ', typez: 'letter' })],
            wait_words: [response([authoritativeWaitWord]), response([authoritativeWaitWord])],
            words: [response([]), response([])],
        });

        const result = await new SupabaseDocsWordModerationGateway(client).getTargets({
            docsId: 9,
            rows,
        });

        expect(result).toEqual({
            ok: true,
            value: {
                targets: rows.map(() => ({
                    kind: 'word-request',
                    requestId: 7,
                    requestType: 'add',
                    selectedThemeIds: [9],
                })),
            },
        });
    });
});

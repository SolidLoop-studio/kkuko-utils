import { err, ok } from '@/src/shared/application/result';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn(), rpc: jest.fn() },
}));

import { SupabaseDocsContentQueryGateway } from '@/src/modules/docs/infrastructure/browser/supabase-docs-content-query-gateway';

type QueryResponse = { data: unknown; error: unknown };
type QueryResult = QueryResponse | Error;

class FakeQuery implements PromiseLike<QueryResponse> {
    constructor(private readonly result: QueryResult, private readonly calls: string[]) {}

    select(columns: string): this { this.calls.push(`select:${columns}`); return this; }
    eq(column: string, value: boolean | number | string): this { this.calls.push(`eq:${column}:${value}`); return this; }
    in(column: string, values: string[]): this { this.calls.push(`in:${column}:${values.join(',')}`); return this; }
    ilike(column: string, value: string): this { this.calls.push(`ilike:${column}:${value}`); return this; }
    neq(column: string, value: number): this { this.calls.push(`neq:${column}:${value}`); return this; }
    gt(column: string, value: number): this { this.calls.push(`gt:${column}:${value}`); return this; }
    maybeSingle(): this { this.calls.push('maybeSingle'); return this; }
    then<TResult1 = QueryResponse, TResult2 = never>(
        onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
        return (this.result instanceof Error ? Promise.reject(this.result) : Promise.resolve(this.result))
            .then(onfulfilled, onrejected);
    }
}

const docsRow = (overrides: Record<string, unknown> = {}) => ({
    id: 61,
    name: '라',
    last_update: '2026-08-25T04:00:00.000Z',
    typez: 'letter',
    duem: false,
    reference_code: null,
    ...overrides,
});

const createClient = (responses: Partial<Record<string, QueryResult>> = {}) => {
    const calls: string[] = [];
    const result = (name: string, fallback: QueryResponse): QueryResult => responses[name] ?? fallback;
    const queries = {
        docs: new FakeQuery(result('docs', { data: docsRow(), error: null }), calls),
        user_star_docs: new FakeQuery(result('stars', { data: [{ user_id: 'user-1' }], error: null }), calls),
        words: new FakeQuery(result('words', { data: [{ word: '라디오' }, { word: '라면' }], error: null }), calls),
        wait_words: new FakeQuery(result('waitWords', {
            data: [
                { word: '라디오', requested_by: '삭제요청자', request_type: 'delete' },
                { word: '라면', requested_by: '요청자', request_type: 'add' },
                { word: '라', requested_by: null, request_type: 'add' },
            ],
            error: null,
        }), calls),
        themes: new FakeQuery(result('themes', { data: { id: 8, name: '동물' }, error: null }), calls),
        word_themes_wait: new FakeQuery(result('themeWaitWords', { data: [], error: null }), calls),
        wait_word_themes: new FakeQuery(result('waitWordThemes', { data: [], error: null }), calls),
    };
    const client = {
        from: jest.fn((table: keyof typeof queries) => { calls.push(`from:${table}`); return queries[table]; }),
        rpc: jest.fn((name: string, _parameters?: Record<string, unknown>) => {
            calls.push(`rpc:${name}`);
            const key = name === 'get_words_by_theme' ? 'themeWords'
                : name === 'get_delete_requests_by_themeid' ? 'themeDeleteWords'
                    : name === 'get_long_wait_words_data' ? 'longWaitWords'
                        : name === 'get_mission_words' ? 'missionWords' : 'missionLen3Words';
            return new FakeQuery(result(key, { data: [], error: null }), calls);
        }),
    };
    return { client, calls };
};

const infrastructureError = {
    kind: 'infrastructure' as const,
    message: '문서 단어를 불러오는 중 오류가 발생했습니다.',
};

describe('SupabaseDocsContentQueryGateway', () => {
    it('maps a letter projection, removing pending deletes and one-character pending rows', async () => {
        const { client, calls } = createClient();

        await expect(new SupabaseDocsContentQueryGateway(client).loadByDocsId(61)).resolves.toEqual(ok({
            metadata: { id: 61, title: '라', lastUpdatedAt: '2026-08-25T04:00:00.000Z', type: 'letter' },
            starredUserIds: ['user-1'],
            words: [
                { word: '라디오', status: 'delete', requesterNickname: '삭제요청자' },
                { word: '라면', status: 'add', requesterNickname: '요청자' },
            ],
            isSpecial: false,
            isMissionParent: false,
        }));
        expect(calls).toContain('from:docs');
        expect(calls).toContain('from:user_star_docs');
        expect(calls).toContain('from:words');
        expect(calls).toContain('from:wait_words');
    });

    it('maps approved, add, and delete theme rows while giving a whole request priority', async () => {
        const { client } = createClient({
            docs: { data: docsRow({ id: 62, name: '동물', typez: 'theme' }), error: null },
            themeWords: { data: [{ word: '사자' }, { word: '호랑이' }], error: null },
            waitWordThemes: { data: [{ wait_words: { word: '기린', requested_by: null, request_type: 'add' } }], error: null },
            themeDeleteWords: { data: [{ word: '호랑이', requested_by: '삭제요청자', request_type: 'delete' }], error: null },
            themeWaitWords: { data: [{ words: { word: '사자' }, typez: 'add', req_by: '주제요청자' }], error: null },
        });

        await expect(new SupabaseDocsContentQueryGateway(client).loadByDocsId(62)).resolves.toEqual(ok(expect.objectContaining({
            words: [
                { word: '기린', status: 'add' },
                { word: '호랑이', status: 'delete', requesterNickname: '삭제요청자' },
                { word: '사자', status: 'add', requesterNickname: '주제요청자' },
            ],
        })));
    });

    it.each([
        [
            9_101,
            'ko.word-chain.mission.ga',
            'get_mission_words',
            1,
            [{ word: '가나다' }, { word: '가나가' }],
            [{ word: '가나가', status: 'ok' }, { word: '가나다', status: 'ok' }],
        ],
        [
            9_202,
            'ko.reverse-word-chain.mission.na',
            'get_mission_words',
            2,
            [{ word: '가나다' }, { word: '다라나' }, { word: '나가나' }],
            [
                { word: '가나다', status: 'ok' },
                { word: '나가나', status: 'ok' },
                { word: '다라나', status: 'ok' },
            ],
        ],
        [
            9_303,
            'ko.kkungkkungtta.mission.ha',
            'get_mission_len3_words',
            8192,
            [{ word: '하나다' }, { word: '하나하' }],
            [{ word: '하나하', status: 'ok' }, { word: '하나다', status: 'ok' }],
        ],
    ] as const)(
        'loads remapped mission child %s from %s',
        async (id, referenceCode, rpc, targetMask, missionWords, expectedWords) => {
            // Break caught: routing mission children by legacy numeric ranges instead of immutable references.
            const { client } = createClient({
                docs: { data: docsRow({ id, name: '미션', typez: 'ect', reference_code: referenceCode }), error: null },
                missionWords: { data: missionWords, error: null },
                missionLen3Words: { data: missionWords, error: null },
            });

            await expect(new SupabaseDocsContentQueryGateway(client).loadByDocsId(id)).resolves.toEqual(ok(expect.objectContaining({
                isSpecial: true,
                words: expectedWords,
            })));
            expect(client.rpc).toHaveBeenCalledWith(rpc, { target_mask: targetMask });
        },
    );

    it.each([
        ['a legacy mission-range id without a reference', null, ok(null)],
        [
            'a mission parent reference',
            'ko.word-chain.mission',
            ok(expect.objectContaining({ isMissionParent: true, isSpecial: false, words: [] })),
        ],
        ['an unknown mission child reference', 'ko.word-chain.mission.unknown', ok(null)],
    ])('does not route %s as a mission child', async (_name, referenceCode, expectedResult) => {
        // Break caught: classifying an ID range, parent, or inexact child reference as a mission child.
        const { client } = createClient({
            docs: { data: docsRow({ id: 209, name: '미션', typez: 'ect', reference_code: referenceCode }), error: null },
        });

        await expect(new SupabaseDocsContentQueryGateway(client).loadByDocsId(209)).resolves.toEqual(expectedResult);
        expect(client.rpc).not.toHaveBeenCalledWith(
            expect.stringMatching(/^get_mission(?:_len3)?_words$/),
            expect.anything(),
        );
    });

    it.each([
        [7_301, 'ko.word-chain.mission'],
        [8_802, 'ko.reverse-word-chain.mission'],
        [9_903, 'ko.kkungkkungtta.mission'],
    ])('returns remapped semantic marker parent %s for %s with no word query', async (id, referenceCode) => {
        // Break caught: recognizing mission parents by legacy numeric IDs instead of immutable reference codes.
        const { client, calls } = createClient({
            docs: {
                data: docsRow({ id, typez: 'ect', reference_code: referenceCode }),
                error: null,
            },
        });

        await expect(new SupabaseDocsContentQueryGateway(client).loadByDocsId(id)).resolves.toEqual(ok(expect.objectContaining({
            words: [],
            isSpecial: false,
            isMissionParent: true,
        })));
        expect(calls).not.toContain('from:words');
        expect(calls.some((call) => call.startsWith('rpc:'))).toBe(false);
    });

    it.each([
        'ko.word-chain.mission.ga',
        'ko.word-chain.long',
        'ko.custom.mission',
    ])('does not classify non-parent reference %s as a mission parent', async (referenceCode) => {
        // Break caught: treating suffix-like or arbitrary mission references as canonical parents.
        const { client } = createClient({
            docs: {
                data: docsRow({ id: 7_301, typez: 'letter', reference_code: referenceCode }),
                error: null,
            },
        });

        await expect(new SupabaseDocsContentQueryGateway(client).loadByDocsId(7_301))
            .resolves.toEqual(ok(expect.objectContaining({ isMissionParent: false })));
    });

    it('uses two-eum letter matching for both approved and pending letter words', async () => {
        const { client, calls } = createClient({
            docs: { data: docsRow({ name: '라', duem: true }), error: null },
        });

        await expect(new SupabaseDocsContentQueryGateway(client).loadByDocsId(61)).resolves.toEqual(ok(expect.objectContaining({
            words: expect.any(Array),
        })));
        expect(calls).toContainEqual(expect.stringMatching(/^in:last_letter:/));
        expect(calls.filter((call) => call.startsWith('ilike:word:'))).not.toHaveLength(0);
    });

    it.each([201, 202])('maps long-word ect document %s with approved and pending words', async (id) => {
        const { client, calls } = createClient({
            docs: { data: docsRow({ id, name: '장문', typez: 'ect' }), error: null },
            words: { data: [{ word: '가나다라마바사아자' }], error: null },
            longWaitWords: { data: [{ word: '라마바라마바사아자', requested_by: '요청자', request_type: 'add' }], error: null },
        });

        await expect(new SupabaseDocsContentQueryGateway(client).loadByDocsId(id)).resolves.toEqual(ok(expect.objectContaining({
            words: [
                { word: '가나다라마바사아자', status: 'ok' },
                { word: '라마바라마바사아자', status: 'add', requesterNickname: '요청자' },
            ],
            isSpecial: false,
        })));
        expect(calls).toContain('gt:length:8');
        expect(calls).toContain('rpc:get_long_wait_words_data');
    });

    it.each([203, 207, 253])('returns not-found projection data for unsupported ect docs id %s', async (id) => {
        const { client } = createClient({ docs: { data: docsRow({ id, name: '기타', typez: 'ect' }), error: null } });
        await expect(new SupabaseDocsContentQueryGateway(client).loadByDocsId(id)).resolves.toEqual(ok(null));
    });

    it.each([
        [
            'a returned mission RPC error',
            9_101,
            'ko.word-chain.mission.ga',
            { missionWords: { data: null, error: { message: 'private' } } },
        ],
        [
            'a thrown mission RPC promise',
            9_202,
            'ko.reverse-word-chain.mission.na',
            { missionWords: new Error('private') },
        ],
        [
            'a malformed mission word row',
            9_303,
            'ko.kkungkkungtta.mission.ha',
            { missionLen3Words: { data: [{ word: 1 }], error: null } },
        ],
    ] as const)('returns the stable infrastructure error for %s', async (_name, id, referenceCode, response) => {
        // Break caught: leaking or accepting malformed failures on a semantically selected mission RPC.
        const { client } = createClient({
            docs: { data: docsRow({ id, name: '미션', typez: 'ect', reference_code: referenceCode }), error: null },
            ...response,
        });

        await expect(new SupabaseDocsContentQueryGateway(client).loadByDocsId(id)).resolves.toEqual(err(infrastructureError));
    });

    it.each([
        ['malformed metadata', { docs: { data: docsRow({ duem: 'false' }), error: null } }],
        ['malformed reference code', { docs: { data: docsRow({ reference_code: 208 }), error: null } }],
        ['malformed word', { words: { data: [{ word: 1 }], error: null } }],
        ['malformed wait word', { waitWords: { data: [{ word: '라면', requested_by: null, request_type: 'edit' }], error: null } }],
        ['malformed star', { stars: { data: [{ user_id: 1 }], error: null } }],
        ['metadata error', { docs: { data: null, error: { message: 'private' } } }],
        ['stars error', { stars: { data: null, error: { message: 'private' } } }],
        ['words error', { words: { data: null, error: { message: 'private' } } }],
        ['wait words error', { waitWords: { data: null, error: { message: 'private' } } }],
        ['theme error', { docs: { data: docsRow({ typez: 'theme' }), error: null }, themes: { data: null, error: { message: 'private' } } }],
        ['thrown metadata query', { docs: new Error('private') }],
        ['thrown star query', { stars: new Error('private') }],
        ['thrown word query', { words: new Error('private') }],
        ['theme word rpc error', { docs: { data: docsRow({ typez: 'theme' }), error: null }, themeWords: { data: null, error: { message: 'private' } } }],
        ['theme pending malformed', { docs: { data: docsRow({ typez: 'theme' }), error: null }, themeWaitWords: { data: [{ words: { word: 1 }, typez: 'add', req_by: null }], error: null } }],
        ['long ect rpc error', { docs: { data: docsRow({ id: 201, typez: 'ect' }), error: null }, longWaitWords: { data: null, error: { message: 'private' } } }],
        ['mission ect malformed rpc row', { docs: { data: docsRow({ id: 239, typez: 'ect' }), error: null }, missionLen3Words: { data: [{ word: 1 }], error: null } }],
        ['thrown theme rpc', { docs: { data: docsRow({ typez: 'theme' }), error: null }, themeWords: new Error('private') }],
        ['thrown long ect rpc', { docs: { data: docsRow({ id: 201, typez: 'ect' }), error: null }, longWaitWords: new Error('private') }],
        ['thrown mission ect rpc', { docs: { data: docsRow({ id: 239, typez: 'ect' }), error: null }, missionLen3Words: new Error('private') }],
    ] as const)('returns the stable infrastructure error for %s', async (_name, responses) => {
        const { client } = createClient(responses);
        await expect(new SupabaseDocsContentQueryGateway(client).loadByDocsId(61)).resolves.toEqual(err(infrastructureError));
    });
});

import { err, ok } from '@/src/shared/application/result';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn() },
}));

import { SupabaseDocsMarkerQueryGateway } from '@/src/modules/docs/infrastructure/browser/supabase-docs-marker-query-gateway';

type QueryResponse = { data: unknown; error: unknown };

class FakeDocsMarkerQuery implements PromiseLike<QueryResponse> {
    constructor(
        private readonly response: QueryResponse,
        private readonly calls: string[],
    ) {}

    select(columns: string): this {
        this.calls.push(`select:${columns}`);
        return this;
    }

    eq(column: string, value: number): this {
        this.calls.push(`eq:${column}:${value}`);
        return this;
    }

    in(column: string, values: string[]): this {
        this.calls.push(`in:${column}:${values.join(',')}`);
        return this;
    }

    maybeSingle(): this {
        this.calls.push('maybeSingle');
        return this;
    }

    then<TResult1 = QueryResponse, TResult2 = never>(
        onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
        return Promise.resolve(this.response).then(onfulfilled, onrejected);
    }
}

const suffixes = ['ga', 'na', 'da', 'ra', 'ma', 'ba', 'sa', 'a', 'ja', 'cha', 'ka', 'ta', 'pa', 'ha'];
const characters = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];

const childRows = suffixes.map((suffix, index) => ({
    id: [711, 95, 830, 42, 506, 201, 999, 73, 618, 305, 887, 64, 452, 120][index],
    reference_code: `ko.word-chain.mission.${suffix}`,
    last_update: index === 4 ? null : `2026-08-${String(index + 1).padStart(2, '0')}T01:00:00.000Z`,
}));

const createClient = (
    parentResponse: QueryResponse,
    childrenResponse: QueryResponse,
) => {
    const calls: string[] = [];
    let queryCount = 0;
    const client = {
        from: jest.fn(() => {
            calls.push('from:docs');
            const response = queryCount === 0 ? parentResponse : childrenResponse;
            queryCount += 1;
            return new FakeDocsMarkerQuery(response, calls);
        }),
    };
    return { client, calls };
};

describe('SupabaseDocsMarkerQueryGateway', () => {
    it('resolves a semantic parent and returns remapped child PKs in canonical mission order', async () => {
        // Break caught: ordering by PK, assuming contiguous IDs, or issuing one query per child.
        const { client, calls } = createClient(
            { data: { reference_code: 'ko.word-chain.mission' }, error: null },
            { data: [...childRows].reverse(), error: null },
        );

        await expect(new SupabaseDocsMarkerQueryGateway(client).loadByParentDocsId(7_301))
            .resolves.toEqual(ok(characters.map((character, index) => ({
                character,
                docsId: childRows[index].id,
                lastUpdatedAt: childRows[index].last_update,
            }))));

        expect(calls).toEqual([
            'from:docs',
            'select:reference_code',
            'eq:id:7301',
            'maybeSingle',
            'from:docs',
            'select:id, reference_code, last_update',
            `in:reference_code:${suffixes.map((suffix) => `ko.word-chain.mission.${suffix}`).join(',')}`,
        ]);
    });

    it('returns a null slot for a missing child without inventing its docs ID', async () => {
        // Break caught: parent-ID arithmetic or dropping a character from the 14-slot result.
        const { client } = createClient(
            { data: { reference_code: 'ko.word-chain.mission' }, error: null },
            { data: childRows.filter((row) => !row.reference_code.endsWith('.na')), error: null },
        );

        const result = await new SupabaseDocsMarkerQueryGateway(client).loadByParentDocsId(7_301);

        expect(result.ok).toBe(true);
        if (!result.ok || result.value === null) throw new Error('expected markers');
        expect(result.value).toHaveLength(14);
        expect(result.value[0]).toEqual(expect.objectContaining({ character: '가', docsId: 711 }));
        expect(result.value[1]).toBeNull();
        expect(result.value[2]).toEqual(expect.objectContaining({ character: '다', docsId: 830 }));
    });

    it.each([
        [
            'duplicate child reference code',
            [...childRows, { ...childRows[0], id: 1_234 }],
        ],
        [
            'unknown child reference code',
            [...childRows, {
                id: 1_234,
                reference_code: 'ko.word-chain.mission.unknown',
                last_update: null,
            }],
        ],
    ])('returns a stable error for an invalid child query result: %s', async (_description, rows) => {
        // Break caught: accepting malformed bulk results rather than preserving stable failure behavior.
        const { client } = createClient(
            { data: { reference_code: 'ko.word-chain.mission' }, error: null },
            { data: rows, error: null },
        );

        await expect(new SupabaseDocsMarkerQueryGateway(client).loadByParentDocsId(7_301))
            .resolves.toEqual(err({
                kind: 'infrastructure',
                message: '미션 글자 업데이트 정보를 불러오는 중 오류가 발생했습니다.',
            }));
    });

    it.each([
        'ko.word-chain.long',
        'ko.word-chain.mission.ga',
        'ko.custom.mission',
    ])('rejects non-parent reference code %s without loading children', async (referenceCode) => {
        // Break caught: accepting suffix-like or arbitrary *.mission references as a parent.
        const { client } = createClient(
            { data: { reference_code: referenceCode }, error: null },
            { data: childRows, error: null },
        );

        await expect(new SupabaseDocsMarkerQueryGateway(client).loadByParentDocsId(55))
            .resolves.toEqual(err({
                kind: 'validation',
                message: '미션 글자 상위 문서가 아닙니다.',
            }));
        expect(client.from).toHaveBeenCalledTimes(1);
    });

    it('returns a stable error when the bulk child query fails', async () => {
        // Break caught: leaking a raw database error or treating a failed marker query as empty data.
        const { client } = createClient(
            { data: { reference_code: 'ko.reverse-word-chain.mission' }, error: null },
            { data: null, error: { message: 'private child query detail' } },
        );

        await expect(new SupabaseDocsMarkerQueryGateway(client).loadByParentDocsId(8_888))
            .resolves.toEqual(err({
                kind: 'infrastructure',
                message: '미션 글자 업데이트 정보를 불러오는 중 오류가 발생했습니다.',
            }));
    });
});

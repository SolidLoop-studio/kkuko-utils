import { err, ok } from '@/src/shared/application/result';
import type { ApplicationError } from '@/src/shared/application/application-error';
import type { AdvancedWordSearchQuery } from '@/src/modules/word-catalog/application/word-search-types';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn(), rpc: jest.fn() },
}));

import { SupabaseWordCatalogQueryGateway } from '@/src/modules/word-catalog/infrastructure/browser/supabase-word-catalog-query-gateway';

type QueryError = { message: string };
type QueryResponse = { data: unknown; error: QueryError | null };
type Query = PromiseLike<QueryResponse> & {
    ilike: jest.Mock<Promise<QueryResponse>, [string, string]>;
};
type QueryClient = {
    from: jest.Mock<{ select: jest.Mock<Query, [string]> }, [string]>;
    rpc: jest.Mock<Promise<QueryResponse>, [string, Record<string, unknown>]>;
};

type QueryClientFixture = {
    words?: unknown;
    waitWords?: unknown;
    themes?: unknown;
    firstLetterCounts?: unknown;
    lastLetterCounts?: unknown;
    rpcWords?: unknown;
    errors?: Partial<Record<'words' | 'waitWords' | 'themes' | 'firstLetterCounts' | 'lastLetterCounts' | 'rpc', QueryError>>;
};

const infrastructureError: ApplicationError = {
    kind: 'infrastructure',
    message: '데이터를 불러오는 중 오류가 발생했습니다.',
};

const koreanStartQuery: AdvancedWordSearchQuery = {
    mode: 'kor-start',
    start: '가',
    end: '나',
    mission: '다',
    isAcceptedOnly: true,
    isManner: false,
    isJen: true,
    isEtiquette: false,
    isDuemApplied: true,
    minimumLength: 2,
    maximumLength: 5,
    limit: 20,
    sortOrder: 'attack',
};

const koreanEndQuery: AdvancedWordSearchQuery = {
    ...koreanStartQuery,
    mode: 'kor-end',
};

const kungQuery: AdvancedWordSearchQuery = {
    mode: 'kung',
    start: '가나다',
    end: '나다라',
    mission: '다',
    isAcceptedOnly: false,
    isManner: true,
    isJen: false,
    isEtiquette: true,
    limit: -1,
    sortOrder: 'length',
};

const hunminQuery: AdvancedWordSearchQuery = {
    mode: 'hunmin',
    query: 'ㄱㄴ',
    mission: '',
    limit: 30,
};

const jaqiQuery: AdvancedWordSearchQuery = {
    mode: 'jaqi',
    query: 'ㄱㄴ',
    themeId: 12,
    limit: 10,
};

const createQueryClient = (fixture: QueryClientFixture = {}): QueryClient => {
    const responses: Record<string, QueryResponse> = {
        words: { data: fixture.words ?? [], error: fixture.errors?.words ?? null },
        wait_words: { data: fixture.waitWords ?? [], error: fixture.errors?.waitWords ?? null },
        themes: { data: fixture.themes ?? [], error: fixture.errors?.themes ?? null },
        word_first_letter_counts: {
            data: fixture.firstLetterCounts ?? [],
            error: fixture.errors?.firstLetterCounts ?? null,
        },
        word_last_letter_counts: {
            data: fixture.lastLetterCounts ?? [],
            error: fixture.errors?.lastLetterCounts ?? null,
        },
    };
    const from: QueryClient['from'] = jest.fn<{ select: jest.Mock<Query, [string]> }, [string]>((table) => {
        const response = responses[table];
        const resolvedResponse = Promise.resolve(response);
        const query: Query = {
            ilike: jest.fn<Promise<QueryResponse>, [string, string]>(() => resolvedResponse),
            then: resolvedResponse.then.bind(resolvedResponse),
        };
        return { select: jest.fn<Query, [string]>(() => query) };
    });
    const rpc = jest.fn().mockResolvedValue({
        data: fixture.rpcWords ?? [],
        error: fixture.errors?.rpc ?? null,
    });

    return { from, rpc };
};

describe('SupabaseWordCatalogQueryGateway', () => {
    it('suggestWords merges approved and pending words without duplicates and sorts by length', async () => {
        const client = createQueryClient({
            words: [{ word: '가나다' }, { word: '가나' }],
            waitWords: [{ word: '가나' }, { word: '가나다라' }],
        });
        const gateway = new SupabaseWordCatalogQueryGateway(client);

        await expect(gateway.suggestWords('가')).resolves.toEqual(
            ok(['가나', '가나다', '가나다라']),
        );
    });

    it('maps a Korean start RPC result to the matching next-word count projection', async () => {
        const client = createQueryClient({
            firstLetterCounts: [{
                first_letter: '다', count: 10, k_count: 7, n_count: 3,
                len3_k_count: 2, len3_n_count: 1,
            }],
            lastLetterCounts: [],
            rpcWords: [{ word: '가나다' }],
        });
        const gateway = new SupabaseWordCatalogQueryGateway(client);

        const result = await gateway.searchAdvanced(koreanStartQuery);

        expect(result).toEqual(ok([{ word: '가나다', nextWordCount: 7 }]));
        expect(client.rpc).toHaveBeenCalledWith('get_korean_words_advanced_s', {
            p_start: '가',
            p_end: '나',
            p_length_max: 5,
            p_length_min: 2,
            p_man: false,
            p_eti: false,
            p_jen: true,
            p_ingjung: true,
            p_limit: 20,
            p_mission: '다',
            p_sort_by: 'attack',
            p_duem: true,
        });
    });

    it('uses the Korean end RPC and last-letter count projection', async () => {
        const client = createQueryClient({
            firstLetterCounts: [],
            lastLetterCounts: [{ last_letter: '가', count: 8, k_count: 6, n_count: 2 }],
            rpcWords: [{ word: '가나다' }],
        });
        const gateway = new SupabaseWordCatalogQueryGateway(client);

        await expect(gateway.searchAdvanced({ ...koreanEndQuery, isAcceptedOnly: false }))
            .resolves.toEqual(ok([{ word: '가나다', nextWordCount: 2 }]));
        expect(client.rpc).toHaveBeenCalledWith('get_korean_words_advanced_e', {
            p_start: '가',
            p_end: '나',
            p_length_max: 5,
            p_length_min: 2,
            p_man: false,
            p_eti: false,
            p_jen: true,
            p_ingjung: false,
            p_limit: 20,
            p_mission: '다',
            p_sort_by: 'attack',
            p_duem: true,
        });
    });

    it('uses the kung RPC and three-letter next-word count projection', async () => {
        const client = createQueryClient({
            firstLetterCounts: [{
                first_letter: '다', count: 9, k_count: 7, n_count: 3,
                len3_k_count: 4, len3_n_count: 2,
            }],
            lastLetterCounts: [],
            rpcWords: [{ word: '가나다' }],
        });
        const gateway = new SupabaseWordCatalogQueryGateway(client);

        await expect(gateway.searchAdvanced(kungQuery))
            .resolves.toEqual(ok([{ word: '가나다', nextWordCount: 2 }]));
        expect(client.rpc).toHaveBeenCalledWith('get_korean_words_advanced_kung', {
            p_start: '가나다',
            p_end: '나다라',
            p_man: true,
            p_eti: true,
            p_jen: false,
            p_ingjung: false,
            p_limit: -1,
            p_mission: '다',
            p_sort_by: 'length',
        });
    });

    it('uses the hunmin RPC and omits an empty mission', async () => {
        const client = createQueryClient({ rpcWords: [{ word: '가나다' }] });
        const gateway = new SupabaseWordCatalogQueryGateway(client);

        await expect(gateway.searchAdvanced(hunminQuery))
            .resolves.toEqual(ok([{ word: '가나다', nextWordCount: -1 }]));
        expect(client.rpc).toHaveBeenCalledWith('get_korean_words_advanced_hunmin', {
            p_chosungs: 'ㄱㄴ',
            p_limit: 30,
            p_mission: undefined,
        });
    });

    it('uses the jaqi RPC and preserves the legacy descending length order', async () => {
        const client = createQueryClient({
            rpcWords: [{ word: '가나' }, { word: '가나다라' }, { word: '가나다' }],
        });
        const gateway = new SupabaseWordCatalogQueryGateway(client);

        await expect(gateway.searchAdvanced(jaqiQuery)).resolves.toEqual(ok([
            { word: '가나다라', nextWordCount: -1 },
            { word: '가나다', nextWordCount: -1 },
            { word: '가나', nextWordCount: -1 },
        ]));
        expect(client.rpc).toHaveBeenCalledWith('get_korean_words_advanced_jaqi', {
            p_chosungs: 'ㄱㄴ',
            p_theme_id: 12,
        });
    });

    it('maps theme rows to summaries', async () => {
        const client = createQueryClient({
            themes: [{ id: 3, code: 'animal', name: '동물' }],
        });
        const gateway = new SupabaseWordCatalogQueryGateway(client);

        await expect(gateway.listThemes()).resolves.toEqual(ok([
            { id: 3, code: 'animal', name: '동물' },
        ]));
    });

    it.each([
        ['a Supabase query error', () => {
            const client = createQueryClient({ errors: { waitWords: { message: 'private error' } } });
            return new SupabaseWordCatalogQueryGateway(client).suggestWords('가');
        }],
        ['a Supabase RPC error', () => {
            const client = createQueryClient({ errors: { rpc: { message: 'private error' } } });
            return new SupabaseWordCatalogQueryGateway(client).searchAdvanced(koreanStartQuery);
        }],
        ['a Supabase theme error', () => {
            const client = createQueryClient({ errors: { themes: { message: 'private error' } } });
            return new SupabaseWordCatalogQueryGateway(client).listThemes();
        }],
    ])('returns a stable infrastructure error for %s', async (_description, run) => {
        await expect(run()).resolves.toEqual(err(infrastructureError));
    });

    it('returns a stable infrastructure error when a client call throws', async () => {
        const client = createQueryClient();
        client.rpc.mockRejectedValue(new Error('private database implementation detail'));
        const gateway = new SupabaseWordCatalogQueryGateway(client);

        await expect(gateway.searchAdvanced(koreanStartQuery))
            .resolves.toEqual(err(infrastructureError));
    });

    it.each([
        ['a simple search word row', () => {
            const client = createQueryClient({ words: [{ word: 10 }] });
            return new SupabaseWordCatalogQueryGateway(client).suggestWords('가');
        }],
        ['an advanced RPC word row', () => {
            const client = createQueryClient({ rpcWords: [{ word: '' }] });
            return new SupabaseWordCatalogQueryGateway(client).searchAdvanced(koreanStartQuery);
        }],
        ['a first-letter count row', () => {
            const client = createQueryClient({
                firstLetterCounts: [{ first_letter: '다', count: 1, k_count: '7', n_count: 3, len3_k_count: 2, len3_n_count: 1 }],
            });
            return new SupabaseWordCatalogQueryGateway(client).searchAdvanced(koreanStartQuery);
        }],
        ['a theme row', () => {
            const client = createQueryClient({ themes: [{ id: 0, code: 'animal', name: '동물' }] });
            return new SupabaseWordCatalogQueryGateway(client).listThemes();
        }],
    ])('returns a stable infrastructure error for %s', async (_description, run) => {
        await expect(run()).resolves.toEqual(err(infrastructureError));
    });
});

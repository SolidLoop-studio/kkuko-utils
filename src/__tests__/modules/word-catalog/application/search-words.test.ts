import type { Result } from '@/src/shared/application/result';
import { err, ok } from '@/src/shared/application/result';
import { SearchWordsService } from '@/src/modules/word-catalog/application/search-words';
import type { WordCatalogQueryGateway } from '@/src/modules/word-catalog/application/word-search-ports';
import type {
    AdvancedWordSearchQuery,
    WordSearchResult,
    WordThemeSummary,
} from '@/src/modules/word-catalog/application/word-search-types';

const infrastructureFailure = err({
    kind: 'infrastructure' as const,
    message: '단어 검색 중 오류가 발생했습니다.',
});

const createGateway = ({
    suggestions = [],
    advancedResults = [],
    themes = [],
}: {
    suggestions?: string[];
    advancedResults?: WordSearchResult[];
    themes?: WordThemeSummary[];
} = {}): jest.Mocked<WordCatalogQueryGateway> => ({
    suggestWords: jest.fn<Promise<Result<string[]>>, [string]>()
        .mockResolvedValue(ok(suggestions)),
    searchAdvanced: jest.fn<Promise<Result<WordSearchResult[]>>, [AdvancedWordSearchQuery]>()
        .mockResolvedValue(ok(advancedResults)),
    listThemes: jest.fn<Promise<Result<WordThemeSummary[]>>, []>()
        .mockResolvedValue(ok(themes)),
});

const koreanStartQuery = (
    overrides: Partial<Extract<AdvancedWordSearchQuery, { mode: 'kor-start' }>> = {},
): Extract<AdvancedWordSearchQuery, { mode: 'kor-start' }> => ({
    mode: 'kor-start',
    start: '가',
    end: undefined,
    mission: '',
    isAcceptedOnly: true,
    isManner: true,
    isJen: false,
    isEtiquette: false,
    isDuemApplied: true,
    minimumLength: 2,
    maximumLength: 100,
    sortOrder: 'length',
    limit: 100,
    ...overrides,
});

describe('SearchWordsService', () => {
    test('simple search trims and removes unsupported characters before querying', async () => {
        const gateway = createGateway({ suggestions: ['가나', '가나다'] });
        const service = new SearchWordsService(gateway);

        const result = await service.search({ type: 'simple', query: '  가!나  ' });

        expect(result).toEqual(ok([
            { word: '가나', nextWordCount: -1 },
            { word: '가나다', nextWordCount: -1 },
        ]));
        expect(gateway.suggestWords).toHaveBeenCalledWith('가나');
    });

    test('simple search rejects a query with no supported characters', async () => {
        const gateway = createGateway();
        const service = new SearchWordsService(gateway);

        const result = await service.search({ type: 'simple', query: ' !@# ' });

        expect(result).toEqual(err({
            kind: 'validation',
            field: 'query',
            message: '검색어가 필요합니다.',
        }));
        expect(gateway.suggestWords).not.toHaveBeenCalled();
    });

    test('advanced start search trims input before querying', async () => {
        const gateway = createGateway({
            advancedResults: [{ word: '가나다', nextWordCount: 3 }],
        });
        const service = new SearchWordsService(gateway);

        const result = await service.search({
            type: 'advanced',
            query: koreanStartQuery({ start: ' 가 ', end: ' 다 ', mission: ' 나 ' }),
        });

        expect(result).toEqual(ok([{ word: '가나다', nextWordCount: 3 }]));
        expect(gateway.searchAdvanced).toHaveBeenCalledWith(
            koreanStartQuery({ start: '가', end: '다', mission: '나' }),
        );
    });

    test('advanced start search rejects a missing start letter', async () => {
        const gateway = createGateway();
        const service = new SearchWordsService(gateway);

        const result = await service.search({
            type: 'advanced',
            query: koreanStartQuery({ start: undefined }),
        });

        expect(result).toEqual(err({
            kind: 'validation',
            field: 'start',
            message: '시작 글자가 필요합니다.',
        }));
        expect(gateway.searchAdvanced).not.toHaveBeenCalled();
    });

    test('advanced end search rejects a missing end letter', async () => {
        const gateway = createGateway();
        const service = new SearchWordsService(gateway);

        const result = await service.search({
            type: 'advanced',
            query: {
                ...koreanStartQuery({ start: undefined }),
                mode: 'kor-end',
                end: ' ',
            },
        });

        expect(result).toEqual(err({
            kind: 'validation',
            field: 'end',
            message: '끝 글자가 필요합니다.',
        }));
        expect(gateway.searchAdvanced).not.toHaveBeenCalled();
    });

    test('kung search truncates start and end inputs to three characters', async () => {
        const gateway = createGateway();
        const service = new SearchWordsService(gateway);

        await service.search({
            type: 'advanced',
            query: {
                mode: 'kung',
                start: '가나다라',
                end: '마바사아',
                mission: '',
                isAcceptedOnly: true,
                isManner: true,
                isJen: false,
                isEtiquette: false,
                sortOrder: 'abc',
                limit: 100,
            },
        });

        expect(gateway.searchAdvanced).toHaveBeenCalledWith({
            mode: 'kung',
            start: '가나다',
            end: '마바사',
            mission: '',
            isAcceptedOnly: true,
            isManner: true,
            isJen: false,
            isEtiquette: false,
            sortOrder: 'abc',
            limit: 100,
        });
    });

    test('hunmin search requires exactly two characters', async () => {
        const gateway = createGateway();
        const service = new SearchWordsService(gateway);

        const result = await service.search({
            type: 'advanced',
            query: { mode: 'hunmin', query: 'ㄱ', mission: '', limit: 100 },
        });

        expect(result).toEqual(err({
            kind: 'validation',
            field: 'query',
            message: '훈민정음 검색어는 두 글자여야 합니다.',
        }));
        expect(gateway.searchAdvanced).not.toHaveBeenCalled();
    });

    test('jaqi search requires a positive theme id', async () => {
        const gateway = createGateway();
        const service = new SearchWordsService(gateway);

        const result = await service.search({
            type: 'advanced',
            query: { mode: 'jaqi', query: 'ㄱㄴ', themeId: 0, limit: 100 },
        });

        expect(result).toEqual(err({
            kind: 'validation',
            field: 'themeId',
            message: '주제를 선택해 주세요.',
        }));
        expect(gateway.searchAdvanced).not.toHaveBeenCalled();
    });

    test('invalid limits use the existing default of one hundred', async () => {
        const gateway = createGateway();
        const service = new SearchWordsService(gateway);

        await service.search({
            type: 'advanced',
            query: koreanStartQuery({ limit: Number.NaN }),
        });

        expect(gateway.searchAdvanced).toHaveBeenCalledWith(
            koreanStartQuery({ limit: 100 }),
        );
    });

    test('gateway failures are returned unchanged', async () => {
        const gateway = createGateway();
        gateway.searchAdvanced.mockResolvedValue(infrastructureFailure);
        const service = new SearchWordsService(gateway);

        const result = await service.search({
            type: 'advanced',
            query: koreanStartQuery(),
        });

        expect(result).toEqual(infrastructureFailure);
    });

    test('suggestions and themes use the same normalized query boundary', async () => {
        const themes = [{ id: 3, code: 'KOR', name: '한국어' }];
        const gateway = createGateway({ suggestions: ['가나'], themes });
        const service = new SearchWordsService(gateway);

        await expect(service.suggest(' 가! ')).resolves.toEqual(ok(['가나']));
        await expect(service.listThemes()).resolves.toEqual(ok(themes));
        expect(gateway.suggestWords).toHaveBeenCalledWith('가');
    });
});

import type { ApplicationError } from '../../../shared/application/application-error';
import { err, ok, type Result } from '../../../shared/application/result';
import type { WordCatalogQueryGateway } from './word-search-ports';
import type {
    AdvancedWordSearchQuery,
    WordSearchRequest,
    WordSearchResult,
    WordThemeSummary,
} from './word-search-types';

const DEFAULT_SEARCH_LIMIT = 100;

const validationError = (field: string, message: string): ApplicationError => ({
    kind: 'validation',
    field,
    message,
});

const sanitizeWordQuery = (query: string): string => (
    query.trim().replace(/[^ㄱ-힣a-zA-Z0-9]/g, '')
);

const trimOrUndefined = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
};

const normalizeLimit = (limit: number): number => (
    Number.isSafeInteger(limit) && limit > 0 ? limit : DEFAULT_SEARCH_LIMIT
);

const normalizeLength = (value: number, fallback: number): number => (
    Number.isSafeInteger(value) && value > 0 ? value : fallback
);

const validateAdvancedWordSearchQuery = (
    query: AdvancedWordSearchQuery,
): Result<AdvancedWordSearchQuery> => {
    switch (query.mode) {
        case 'kor-start': {
            const start = trimOrUndefined(query.start);
            if (!start) {
                return err(validationError('start', '시작 글자가 필요합니다.'));
            }
            return ok({
                ...query,
                start,
                end: trimOrUndefined(query.end),
                mission: query.mission.trim(),
                minimumLength: normalizeLength(query.minimumLength, 2),
                maximumLength: normalizeLength(query.maximumLength, 100),
                limit: normalizeLimit(query.limit),
            });
        }
        case 'kor-end': {
            const end = trimOrUndefined(query.end);
            if (!end) {
                return err(validationError('end', '끝 글자가 필요합니다.'));
            }
            return ok({
                ...query,
                start: trimOrUndefined(query.start),
                end,
                mission: query.mission.trim(),
                minimumLength: normalizeLength(query.minimumLength, 2),
                maximumLength: normalizeLength(query.maximumLength, 100),
                limit: normalizeLimit(query.limit),
            });
        }
        case 'kung': {
            const start = trimOrUndefined(query.start)?.slice(0, 3);
            if (!start) {
                return err(validationError('start', '시작 글자가 필요합니다.'));
            }
            return ok({
                ...query,
                start,
                end: trimOrUndefined(query.end)?.slice(0, 3),
                mission: query.mission.trim(),
                limit: normalizeLimit(query.limit),
            });
        }
        case 'hunmin': {
            const normalizedQuery = query.query.trim();
            if (normalizedQuery.length !== 2) {
                return err(validationError(
                    'query',
                    '훈민정음 검색어는 두 글자여야 합니다.',
                ));
            }
            return ok({
                ...query,
                query: normalizedQuery,
                mission: query.mission.trim(),
                limit: normalizeLimit(query.limit),
            });
        }
        case 'jaqi': {
            if (!Number.isSafeInteger(query.themeId) || query.themeId <= 0) {
                return err(validationError('themeId', '주제를 선택해 주세요.'));
            }
            return ok({
                ...query,
                query: query.query.trim(),
                limit: normalizeLimit(query.limit),
            });
        }
    }
};

/** 단어 검색 입력을 검증하고 word-catalog 조회 port를 호출한다. */
export class SearchWordsService {
    constructor(private readonly gateway: WordCatalogQueryGateway) {}

    async search(request: WordSearchRequest): Promise<Result<WordSearchResult[]>> {
        if (request.type === 'simple') {
            const suggestions = await this.suggest(request.query);
            return suggestions.ok
                ? ok(suggestions.value.map((word) => ({ word, nextWordCount: -1 })))
                : suggestions;
        }

        const validation = validateAdvancedWordSearchQuery(request.query);
        return validation.ok
            ? this.gateway.searchAdvanced(validation.value)
            : validation;
    }

    async suggest(query: string): Promise<Result<string[]>> {
        const normalizedQuery = sanitizeWordQuery(query);
        return normalizedQuery.length === 0
            ? err(validationError('query', '검색어가 필요합니다.'))
            : this.gateway.suggestWords(normalizedQuery);
    }

    listThemes(): Promise<Result<WordThemeSummary[]>> {
        return this.gateway.listThemes();
    }
}

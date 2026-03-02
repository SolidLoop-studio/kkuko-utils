import type { IWordRepository } from '../../domain/word/WordRepository';
import type { IWaitWordRepository } from '../../domain/word/WaitWordRepository';
import type { IThemeRepository } from '../../domain/word/ThemeRepository';
import type { CustomError } from '../../domain/result';
import type { Result } from '../../domain/result';
import type {
    WordWithUser,
    WordListItem,
    WordFilter,
    WordSearchResult,
    WordWithThemeIds,
    LetterCountInfo,
} from '../../domain/word/WordEntity';
import type { WaitWordWithUser } from '../../domain/word/WaitWordEntity';
import type { ThemeEntity, WordThemeMapping, WaitThemeInfo } from '../../domain/word/ThemeEntity';
import type { advancedQueryType } from '@/src/app/types/type';
import { success } from '../../domain/result';

/** 2초 최소 응답 시간을 보장하기 위한 유틸리티 */
async function ensureMinimumDelay<T>(startTime: number, result: T, minMs = 2000): Promise<T> {
    const elapsed = Date.now() - startTime;
    const remaining = minMs - elapsed;
    if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
    }
    return result;
}

/**
 * Word 조회 서비스 (Application Layer)
 *
 * 단어 검색, 고급 검색, 랜덤 조회, 글자별 카운트, 단어조합기 등
 * 읽기 전용 유즈케이스를 담당합니다.
 *
 * 2초 딜레이(rate limiting)는 이 레이어에서 적용합니다.
 * 캐싱은 React Query의 queryClient.ensureQueryData를 활용하여 소비자 레이어에서 처리합니다.
 */
export class WordQueryService {
    constructor(
        private readonly wordRepo: IWordRepository,
        private readonly waitWordRepo: IWaitWordRepository,
        private readonly themeRepo: IThemeRepository,
    ) {}

    /**
     * 접두사로 단어를 검색합니다.
     * words + wait_words를 합산하여 중복 제거 후 길이순 정렬합니다.
     * 최소 2초 응답 시간을 보장합니다.
     *
     * @param query - 검색 쿼리 문자열
     * @returns 정렬된 단어 문자열 배열
     */
    async searchByPrefix(query: string): Promise<Result<string[], CustomError>> {
        const startTime = Date.now();

        const wordsResult = await this.wordRepo.findByPrefix(query);
        if (!wordsResult.success) return wordsResult;

        const waitWordsResult = await this.waitWordRepo.findByPrefix(query);
        if (!waitWordsResult.success) return waitWordsResult;

        const wordsSet = new Set(wordsResult.data);
        const allWords = [...wordsResult.data];
        waitWordsResult.data.forEach((word) => {
            if (!wordsSet.has(word)) {
                allWords.push(word);
            }
        });

        const sorted = allWords.sort((a, b) => a.length - b.length);
        const result = success(sorted);

        return ensureMinimumDelay(startTime, result);
    }

    /**
     * 고급 검색 쿼리로 단어를 검색하고 nextWordCount를 계산합니다.
     * 최소 2초 응답 시간을 보장합니다.
     *
     * @param input - 고급 검색 입력 파라미터
     * @returns 단어 검색 결과 배열 (단어 + nextWordCount)
     */
    async searchAdvanced(input: advancedQueryType): Promise<Result<WordSearchResult[], CustomError>> {
        const startTime = Date.now();

        const letterResult = await this.getLetterCounts();
        if (!letterResult.success) {
            return ensureMinimumDelay(startTime, letterResult as Result<WordSearchResult[], CustomError>);
        }
        const letterData = letterResult.data;

        const wordsResult = await this.wordRepo.findAdvanced(input);
        if (!wordsResult.success) {
            return ensureMinimumDelay(startTime, wordsResult as Result<WordSearchResult[], CustomError>);
        }

        let searchResults: WordSearchResult[];

        switch (input.mode) {
            case 'kor-start':
                searchResults = wordsResult.data.map((w) => ({
                    word: w.word,
                    nextWordCount:
                        letterData.firstLetterCounts[w.word[w.word.length - 1]]?.[
                            input.ingjung ? 'kCount' : 'nCount'
                        ] ?? 0,
                }));
                break;
            case 'kor-end':
                searchResults = wordsResult.data.map((w) => ({
                    word: w.word,
                    nextWordCount:
                        letterData.lastLetterCounts[w.word[0]]?.[
                            input.ingjung ? 'kCount' : 'nCount'
                        ] ?? 0,
                }));
                break;
            case 'kung':
                searchResults = wordsResult.data.map((w) => ({
                    word: w.word,
                    nextWordCount:
                        letterData.firstLetterCounts[w.word[w.word.length - 1]]?.[
                            input.ingjung ? 'len3KCount' : 'len3NCount'
                        ] ?? 0,
                }));
                break;
            case 'hunmin':
            case 'jaqi':
                searchResults = wordsResult.data.map((w) => ({
                    word: w.word,
                    nextWordCount: -1,
                }));
                break;
            default:
                searchResults = [];
        }

        return ensureMinimumDelay(startTime, success(searchResults));
    }

    /**
     * 단어 문자열로 상세 정보를 조회합니다.
     *
     * @param word - 조회할 단어 문자열
     * @returns 단어 정보 (없으면 null)
     */
    async getWordInfo(word: string): Promise<Result<WordWithUser | null, CustomError>> {
        return this.wordRepo.findByWord(word);
    }

    /**
     * 대기 단어 문자열로 상세 정보를 조회합니다.
     *
     * @param word - 조회할 대기 단어 문자열
     * @returns 대기 단어 정보 (없으면 null)
     */
    async getWaitWordInfo(word: string): Promise<Result<WaitWordWithUser | null, CustomError>> {
        return this.waitWordRepo.findByWord(word);
    }

    /**
     * 단어 ID로 테마 정보를 조회합니다.
     *
     * @param wordId - 단어 ID
     * @returns 테마 매핑 배열
     */
    async getWordThemes(wordId: number): Promise<Result<WordThemeMapping[], CustomError>> {
        return this.themeRepo.findThemesByWordId(wordId);
    }

    /**
     * 대기 단어 ID로 테마 정보를 조회합니다.
     *
     * @param waitWordId - 대기 단어 ID
     * @returns 테마 배열
     */
    async getWaitWordThemes(waitWordId: number): Promise<Result<{ themeId: number; theme: ThemeEntity }[], CustomError>> {
        return this.themeRepo.findWaitWordThemes(waitWordId);
    }

    /**
     * 랜덤 단어를 조회합니다.
     *
     * @param criteria - 검색 기준 (첫 글자 / 마지막 글자)
     * @returns 랜덤 단어 문자열 또는 null
     */
    async getRandomWord(criteria: {
        by: 'first' | 'last';
        letters: string[];
    }): Promise<Result<string | null, CustomError>> {
        if (criteria.by === 'first') {
            return this.wordRepo.findRandomByFirstLetter(criteria.letters);
        }
        return this.wordRepo.findRandomByLastLetter(criteria.letters);
    }

    /**
     * 글자별 단어 개수 정보를 조회합니다.
     *
     * @returns 첫 글자/마지막 글자별 카운트 정보
     */
    async getLetterCounts(): Promise<Result<LetterCountInfo, CustomError>> {
        return this.wordRepo.findLetterCounts();
    }

    /**
     * 단어조합기용 전체 단어를 조회합니다.
     *
     * @returns 단어 목록 아이템 배열
     */
    async getAllForCombiner(): Promise<Result<WordListItem[], CustomError>> {
        return this.wordRepo.findAllForCombiner();
    }

    /**
     * 필터 조건에 맞는 전체 단어를 조회합니다.
     *
     * @param filter - 단어 필터 옵션
     * @returns 단어 목록 아이템 배열
     */
    async getAllForDownload(filter: WordFilter): Promise<Result<WordListItem[], CustomError>> {
        return this.wordRepo.findAll(filter);
    }

    /**
     * 여러 단어 문자열로 단어 정보(테마 포함)를 일괄 조회합니다.
     *
     * @param words - 조회할 단어 문자열 배열
     * @returns 단어+테마ID 배열
     */
    async getWordsByWords(words: string[]): Promise<Result<WordWithThemeIds[], CustomError>> {
        return this.wordRepo.findByWords(words);
    }

    /**
     * 전체 단어 수를 조회합니다.
     *
     * @returns 전체 단어 수
     */
    async getWordsCount(): Promise<Result<number, CustomError>> {
        return this.wordRepo.findWordsCount();
    }

    /**
     * 대기 단어 전체 수를 조회합니다.
     *
     * @returns 대기 단어 수
     */
    async getWaitWordsCount(): Promise<Result<number, CustomError>> {
        return this.waitWordRepo.findWaitWordsCount();
    }

    /**
     * 전체 테마 목록을 조회합니다.
     *
     * @returns 테마 엔티티 배열
     */
    async getAllThemes(): Promise<Result<ThemeEntity[], CustomError>> {
        return this.themeRepo.findAll();
    }

    /**
     * 대기 단어 전체를 조회합니다.
     *
     * @param filter - 요청 타입 필터
     * @returns 대기 단어 목록
     */
    async getAllWaitWords(filter?: 'add' | 'delete'): Promise<Result<WaitWordWithUser[], CustomError>> {
        return this.waitWordRepo.findAll(filter);
    }

    /**
     * 전체 대기 테마(word_themes_wait)를 조회합니다.
     *
     * @param filter - 요청 타입 필터
     * @returns 대기 테마 정보 배열
     */
    async getAllWaitThemes(filter?: 'add' | 'delete'): Promise<Result<WaitThemeInfo[], CustomError>> {
        return this.themeRepo.findAllWaitThemes(filter);
    }

    /**
     * 단어 ID 기준 대기 테마를 조회합니다.
     *
     * @param wordId - 단어 ID
     * @returns 대기 테마 정보 배열
     */
    async getWaitThemesByWordId(wordId: number): Promise<Result<WaitThemeInfo[], CustomError>> {
        return this.themeRepo.findWaitThemesByWordId(wordId);
    }

    /**
     * 단어 ID 배열로 테마 정보를 일괄 조회합니다.
     *
     * @param wordIds - 단어 ID 배열
     * @returns 테마 매핑 배열
     */
    async getThemesByWordIds(wordIds: number[]): Promise<Result<WordThemeMapping[], CustomError>> {
        return this.themeRepo.findThemesByWordIds(wordIds);
    }

    /**
     * 단어 통계 Raw 데이터를 조회합니다.
     *
     * @returns 첫/마지막 글자별 카운트 Raw 배열
     */
    async getWordState(): Promise<Result<{
        firstLetterCounts: { first_letter: string; count: number; k_count: number; n_count: number; len3_k_count: number; len3_n_count: number }[];
        lastLetterCounts: { last_letter: string; count: number; k_count: number; n_count: number }[];
    }, CustomError>> {
        return this.wordRepo.findWordState();
    }
}

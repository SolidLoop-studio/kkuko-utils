import type { CustomError } from '../result';
import type { Result } from '../result';
import type {
    WordEntity,
    WordWithUser,
    NewWord,
    WordListItem,
    WordFilter,
    WordWithThemeIds,
    LetterCountInfo,
} from './WordEntity';
import type { advancedQueryType } from '@/src/app/types/type';

/**
 * Word Repository 인터페이스 (Port)
 *
 * 단어 엔티티에 대한 데이터 접근 추상화 레이어입니다.
 * 인프라 구현체(Supabase 등)와 도메인을 분리합니다.
 */
export interface IWordRepository {
    /**
     * 단어 문자열로 단어 정보를 조회합니다.
     *
     * @param word - 조회할 단어 문자열
     * @returns 단어 엔티티 또는 null
     */
    findByWord(word: string): Promise<Result<WordWithUser | null, CustomError>>;

    /**
     * 여러 단어 문자열로 단어 정보(테마 포함)를 일괄 조회합니다.
     *
     * @param words - 조회할 단어 문자열 배열
     * @returns 단어+테마ID 배열
     */
    findByWords(words: string[]): Promise<Result<WordWithThemeIds[], CustomError>>;

    /**
     * 접두사(prefix)로 단어를 검색합니다.
     *
     * @param query - 검색 쿼리 문자열
     * @returns 일치하는 단어 문자열 배열
     */
    findByPrefix(query: string): Promise<Result<string[], CustomError>>;

    /**
     * 고급 검색 쿼리로 단어를 검색합니다.
     *
     * @param input - 고급 검색 입력 파라미터
     * @returns 단어 문자열 배열
     */
    findAdvanced(input: advancedQueryType): Promise<Result<{ word: string }[], CustomError>>;

    /**
     * 첫 글자 기준 랜덤 단어를 조회합니다.
     *
     * @param firstLetters - 첫 글자 배열
     * @returns 랜덤 단어 문자열 또는 null
     */
    findRandomByFirstLetter(firstLetters: string[]): Promise<Result<string | null, CustomError>>;

    /**
     * 마지막 글자 기준 랜덤 단어를 조회합니다.
     *
     * @param lastLetters - 마지막 글자 배열
     * @returns 랜덤 단어 문자열 또는 null
     */
    findRandomByLastLetter(lastLetters: string[]): Promise<Result<string | null, CustomError>>;

    /**
     * 단어조합기용 전체 단어를 조회합니다. (5, 6글자 + 영어 단어)
     *
     * @returns 단어 목록 아이템 배열
     */
    findAllForCombiner(): Promise<Result<WordListItem[], CustomError>>;

    /**
     * 필터 조건에 맞는 전체 단어를 조회합니다.
     *
     * @param filter - 단어 필터 옵션
     * @returns 단어 목록 아이템 배열
     */
    findAll(filter: WordFilter): Promise<Result<WordListItem[], CustomError>>;

    /**
     * 글자별 단어 개수 정보를 조회합니다.
     *
     * @returns 첫 글자/마지막 글자별 카운트 정보
     */
    findLetterCounts(): Promise<Result<LetterCountInfo, CustomError>>;

    /**
     * 단어 ID로 테마 정보를 조회합니다.
     *
     * @param wordId - 단어 ID
     * @returns 단어-테마 관계 배열 (word, themes 포함)
     */
    findThemesByWordId(wordId: number): Promise<Result<{ wordId: number; word: WordEntity; themes: { id: number; name: string; code: string } }[], CustomError>>;

    /**
     * 단어를 추가(insert)합니다.
     *
     * @param words - 추가할 단어 데이터 배열
     * @returns 추가된 단어 엔티티 배열
     */
    save(words: NewWord[]): Promise<Result<WordEntity[], CustomError>>;

    /**
     * 단어를 upsert(있으면 무시, 없으면 추가)합니다.
     *
     * @param words - upsert할 단어 데이터 배열
     * @returns upsert된 단어 엔티티 배열
     */
    upsert(words: NewWord[]): Promise<Result<WordEntity[], CustomError>>;

    /**
     * 단어 문자열로 삭제합니다.
     *
     * @param word - 삭제할 단어 문자열
     * @returns 삭제된 단어 엔티티 배열
     */
    deleteByWord(word: string): Promise<Result<WordEntity[], CustomError>>;

    /**
     * 단어 ID로 삭제합니다.
     *
     * @param id - 삭제할 단어 ID
     * @returns 삭제된 단어 엔티티 배열
     */
    deleteById(id: number): Promise<Result<WordEntity[], CustomError>>;

    /**
     * 여러 단어 ID로 일괄 삭제합니다.
     *
     * @param ids - 삭제할 단어 ID 배열
     * @returns 삭제된 단어 엔티티 배열
     */
    deleteByIds(ids: number[]): Promise<Result<WordEntity[], CustomError>>;

    /**
     * 단어 통계(첫 글자 / 마지막 글자 카운트) Raw 데이터를 조회합니다.
     *
     * @returns 첫/마지막 글자별 카운트 Raw 배열
     */
    findWordState(): Promise<Result<{
        firstLetterCounts: { first_letter: string; count: number; k_count: number; n_count: number; len3_k_count: number; len3_n_count: number }[];
        lastLetterCounts: { last_letter: string; count: number; k_count: number; n_count: number }[];
    }, CustomError>>;

    /**
     * 전체 단어 수를 조회합니다.
     *
     * @returns 전체 단어 수
     */
    findWordsCount(): Promise<Result<number, CustomError>>;
}

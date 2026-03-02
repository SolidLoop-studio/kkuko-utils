import type { CustomError } from '../result';
import type { Result } from '../result';
import type { WaitWordEntity, WaitWordWithUser, NewWaitWord } from './WaitWordEntity';

/**
 * WaitWord Repository 인터페이스 (Port)
 *
 * 대기 단어(추가/삭제 요청) 엔티티에 대한 데이터 접근 추상화 레이어입니다.
 */
export interface IWaitWordRepository {
    /**
     * 단어 문자열로 대기 단어를 조회합니다.
     *
     * @param word - 조회할 단어 문자열
     * @returns 대기 단어 엔티티(사용자 닉네임 포함) 또는 null
     */
    findByWord(word: string): Promise<Result<WaitWordWithUser | null, CustomError>>;

    /**
     * 대기 단어 전체를 조회합니다.
     *
     * @param filter - 요청 타입 필터 (add / delete)
     * @returns 대기 단어 목록 (원본 단어 + 사용자 정보 포함)
     */
    findAll(filter?: 'add' | 'delete'): Promise<Result<WaitWordWithUser[], CustomError>>;

    /**
     * 접두사로 대기 단어를 검색합니다.
     *
     * @param query - 접두사 쿼리
     * @returns 대기 단어 문자열 배열
     */
    findByPrefix(query: string): Promise<Result<string[], CustomError>>;

    /**
     * 대기 단어를 단건 추가합니다.
     *
     * @param data - 추가할 대기 단어 데이터
     * @returns 추가된 대기 단어 엔티티 또는 null
     */
    save(data: NewWaitWord): Promise<Result<WaitWordEntity | null, CustomError>>;

    /**
     * 대기 단어를 대량 추가합니다. (추가 요청만)
     *
     * @param data - 추가할 대기 단어 데이터 배열
     * @returns 추가된 대기 단어 엔티티 배열
     */
    saveBulk(data: { word: string; requestedBy: string | null; requestType: 'add' }[]): Promise<Result<WaitWordEntity[], CustomError>>;

    /**
     * ID로 대기 단어를 삭제합니다.
     *
     * @param id - 삭제할 대기 단어 ID
     */
    deleteById(id: number): Promise<Result<void, CustomError>>;

    /**
     * 여러 ID로 대기 단어를 일괄 삭제합니다.
     *
     * @param ids - 삭제할 대기 단어 ID 배열
     */
    deleteByIds(ids: number[]): Promise<Result<void, CustomError>>;

    /**
     * 단어 문자열로 대기 단어를 삭제합니다.
     *
     * @param word - 삭제할 단어 문자열
     */
    deleteByWord(word: string): Promise<Result<void, CustomError>>;

    /**
     * 여러 단어 문자열로 대기 단어를 일괄 삭제합니다.
     *
     * @param words - 삭제할 단어 문자열 배열
     */
    deleteByWords(words: string[]): Promise<Result<void, CustomError>>;

    /**
     * 대기 단어 전체 수를 조회합니다. (wait_words + word_themes_wait 합산)
     *
     * @returns 대기 단어 수
     */
    findWaitWordsCount(): Promise<Result<number, CustomError>>;
}

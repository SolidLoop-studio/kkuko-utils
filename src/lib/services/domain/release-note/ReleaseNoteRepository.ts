import type { Result, CustomError } from '../result';
import type { ReleaseNoteEntity } from './ReleaseNoteEntity';

/**
 * ReleaseNote Repository 인터페이스 (Port)
 *
 * 릴리즈 노트 조회를 위한 데이터 접근 추상화입니다.
 */
export interface IReleaseNoteRepository {
    /**
     * 모든 릴리즈 노트를 조회합니다.
     *
     * @returns 릴리즈 노트 배열
     */
    findAll(): Promise<Result<ReleaseNoteEntity[], CustomError>>;
}

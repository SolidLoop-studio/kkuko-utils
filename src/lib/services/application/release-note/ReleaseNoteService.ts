import type { IReleaseNoteRepository } from '../../domain/release-note/ReleaseNoteRepository';
import type { Result, CustomError } from '../../domain/result';
import type { ReleaseNoteEntity } from '../../domain/release-note/ReleaseNoteEntity';

/**
 * ReleaseNote 유즈케이스 서비스 (Application Layer)
 *
 * 릴리즈 노트 조회 유즈케이스를 담당합니다.
 */
export class ReleaseNoteService {
    constructor(private readonly repo: IReleaseNoteRepository) {}

    /**
     * 모든 릴리즈 노트를 조회합니다.
     *
     * @returns 릴리즈 노트 배열
     */
    async getAll(): Promise<Result<ReleaseNoteEntity[], CustomError>> {
        return this.repo.findAll();
    }
}

import type { IReleaseNoteRepository } from '../../domain/release-note/ReleaseNoteRepository';
import type { Result, CustomError } from '../../domain/result';
import type { ReleaseNoteEntity } from '../../domain/release-note/ReleaseNoteEntity';

export class ReleaseNoteService {
    constructor(private readonly repo: IReleaseNoteRepository) {}

    async getAll(): Promise<Result<ReleaseNoteEntity[], CustomError>> {
        return this.repo.findAll();
    }
}

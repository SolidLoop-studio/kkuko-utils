import type { Result, CustomError } from '../result';
import type { ReleaseNoteEntity } from './ReleaseNoteEntity';

export interface IReleaseNoteRepository {
    findAll(): Promise<Result<ReleaseNoteEntity[], CustomError>>;
}

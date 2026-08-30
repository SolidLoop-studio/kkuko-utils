import type { Result } from '@/src/shared/application/result';
import type { GithubReleaseNote, InternalReleaseNote } from './release-note-query-types';

export interface InternalReleaseNoteQueryGateway {
    load(): Promise<Result<InternalReleaseNote[]>>;
}

export interface GithubReleaseQueryGateway {
    load(): Promise<Result<GithubReleaseNote[]>>;
}

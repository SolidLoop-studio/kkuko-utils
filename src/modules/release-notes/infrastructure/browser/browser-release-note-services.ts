import { GetGithubReleasesService } from '../../application/get-github-releases';
import { GetInternalReleaseNotesService } from '../../application/get-internal-release-notes';
import { GithubReleaseQueryGateway } from './github-release-query-gateway';
import { SupabaseInternalReleaseNoteQueryGateway } from './supabase-internal-release-note-query-gateway';

export interface BrowserReleaseNoteServices {
    internalReleaseNoteQueryService: GetInternalReleaseNotesService;
    githubReleaseQueryService: GetGithubReleasesService;
}

/** 내부 Supabase 조회와 외부 GitHub 조회를 독립적인 Application service로 조합합니다. */
export const createBrowserReleaseNoteServices = (): BrowserReleaseNoteServices => ({
    internalReleaseNoteQueryService: new GetInternalReleaseNotesService(
        new SupabaseInternalReleaseNoteQueryGateway(),
    ),
    githubReleaseQueryService: new GetGithubReleasesService(
        new GithubReleaseQueryGateway(),
    ),
});

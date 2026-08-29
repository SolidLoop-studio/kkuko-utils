import { GetGithubReleasesService } from '@/src/modules/release-notes/application/get-github-releases';
import { GetInternalReleaseNotesService } from '@/src/modules/release-notes/application/get-internal-release-notes';
import type {
    GithubReleaseNote,
    InternalReleaseNote,
} from '@/src/modules/release-notes/application/release-note-query-types';
import { err, ok } from '@/src/shared/application/result';

const internalNotes: InternalReleaseNote[] = [{
    id: 2,
    title: '내부 업데이트',
    content: '변경 내용',
    createdAt: '2026-08-30T01:00:00.000Z',
    link: null,
}];

const githubReleases: GithubReleaseNote[] = [{
    id: 7,
    name: 'v2',
    body: 'GitHub 변경 내용',
    publishedAt: '2026-08-30T02:00:00.000Z',
    htmlUrl: 'https://github.com/SolidLoop-studio/kkuko-utils/releases/tag/v2',
    tagName: 'v2',
}];

describe('release-note query services', () => {
    test('returns each source result through its own query path', async () => {
        // Break caught: combining the two sources into one service/result again.
        const internal = new GetInternalReleaseNotesService({
            load: jest.fn(async () => ok(internalNotes)),
        });
        const github = new GetGithubReleasesService({
            load: jest.fn(async () => ok(githubReleases)),
        });

        await expect(internal.get()).resolves.toEqual(ok(internalNotes));
        await expect(github.get()).resolves.toEqual(ok(githubReleases));
    });

    test.each([
        ['internal returned failure', 'internal', async () => err({ kind: 'infrastructure', message: 'private database detail' })],
        ['internal thrown failure', 'internal', async () => { throw new Error('private database detail'); }],
        ['GitHub returned failure', 'github', async () => err({ kind: 'infrastructure', message: 'private response detail' })],
        ['GitHub thrown failure', 'github', async () => { throw new Error('private response detail'); }],
    ])('normalizes %s to its stable public error', async (_label, source, load) => {
        // Break caught: leaking gateway diagnostics or allowing a rejection to escape Application.
        const service = source === 'internal'
            ? new GetInternalReleaseNotesService({ load })
            : new GetGithubReleasesService({ load });

        await expect(service.get()).resolves.toEqual(err({
            kind: 'infrastructure',
            message: source === 'internal'
                ? '릴리즈 노트를 불러오는 중 오류가 발생했습니다.'
                : 'GitHub 릴리즈를 불러오는 중 오류가 발생했습니다.',
        }));
    });
});

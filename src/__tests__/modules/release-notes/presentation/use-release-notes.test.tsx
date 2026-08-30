import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/release-notes/infrastructure/browser/browser-release-note-services',
    () => ({ createBrowserReleaseNoteServices: jest.fn() }),
);

import type {
    GithubReleaseNote,
    InternalReleaseNote,
} from '@/src/modules/release-notes/application/release-note-query-types';
import { createBrowserReleaseNoteServices } from '@/src/modules/release-notes/infrastructure/browser/browser-release-note-services';
import {
    releaseNoteQueryKeys,
    useReleaseNotes,
} from '@/src/modules/release-notes/presentation/use-release-notes';
import { err, ok } from '@/src/shared/application/result';

const internal: InternalReleaseNote[] = [{
    id: 1,
    title: '내부',
    content: '내용',
    createdAt: '2026-08-30T01:00:00.000Z',
    link: null,
}];
const github: GithubReleaseNote[] = [{
    id: 2,
    name: '외부',
    body: '내용',
    publishedAt: '2026-08-30T02:00:00.000Z',
    htmlUrl: 'https://github.com/release',
    tagName: 'v2',
}];

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { gcTime: Infinity } },
    });
    const QueryWrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { queryClient, QueryWrapper };
};

describe('useReleaseNotes', () => {
    test('caches internal and GitHub results under the two exact independent keys', async () => {
        // Break caught: sharing one cache entry/request, which lets one source suppress the other.
        jest.mocked(createBrowserReleaseNoteServices).mockReturnValue({
            internalReleaseNoteQueryService: { get: jest.fn(async () => ok(internal)) },
            githubReleaseQueryService: { get: jest.fn(async () => ok(github)) },
        } as unknown as ReturnType<typeof createBrowserReleaseNoteServices>);
        const { queryClient, QueryWrapper } = createWrapper();
        const { result } = renderHook(() => useReleaseNotes(), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.internal.data).toEqual(internal));
        await waitFor(() => expect(result.current.github.data).toEqual(github));
        expect(releaseNoteQueryKeys.internal).toEqual(['release-notes', 'internal']);
        expect(releaseNoteQueryKeys.github).toEqual(['release-notes', 'github']);
        expect(queryClient.getQueryData(['release-notes', 'internal'])).toEqual(internal);
        expect(queryClient.getQueryData(['release-notes', 'github'])).toEqual(github);
    });

    test('keeps GitHub data when the internal source fails', async () => {
        // Break caught: Promise.all-style coupling that drops both source results after one failure.
        jest.mocked(createBrowserReleaseNoteServices).mockReturnValue({
            internalReleaseNoteQueryService: { get: jest.fn(async () => err({
                kind: 'infrastructure',
                message: '릴리즈 노트를 불러오는 중 오류가 발생했습니다.',
            })) },
            githubReleaseQueryService: { get: jest.fn(async () => ok(github)) },
        } as unknown as ReturnType<typeof createBrowserReleaseNoteServices>);
        const { QueryWrapper } = createWrapper();
        const { result } = renderHook(() => useReleaseNotes(), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.internal.error).toEqual({
            kind: 'infrastructure',
            message: '릴리즈 노트를 불러오는 중 오류가 발생했습니다.',
        }));
        expect(result.current.github.data).toEqual(github);
    });

    test('normalizes an unexpected GitHub service throw without affecting internal data', async () => {
        // Break caught: leaking a raw exception from one query or corrupting the other query state.
        jest.mocked(createBrowserReleaseNoteServices).mockReturnValue({
            internalReleaseNoteQueryService: { get: jest.fn(async () => ok(internal)) },
            githubReleaseQueryService: { get: jest.fn(async () => { throw new Error('private fetch detail'); }) },
        } as unknown as ReturnType<typeof createBrowserReleaseNoteServices>);
        const { QueryWrapper } = createWrapper();
        const { result } = renderHook(() => useReleaseNotes(), { wrapper: QueryWrapper });

        await waitFor(() => expect(result.current.github.error).toEqual({
            kind: 'infrastructure',
            message: 'GitHub 릴리즈를 불러오는 중 오류가 발생했습니다.',
        }));
        expect(result.current.internal.data).toEqual(internal);
    });
});

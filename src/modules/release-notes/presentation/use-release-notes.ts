'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { ApplicationError } from '@/src/shared/application/application-error';
import type { Result } from '@/src/shared/application/result';
import type { GetGithubReleasesService } from '../application/get-github-releases';
import type { GetInternalReleaseNotesService } from '../application/get-internal-release-notes';
import type { GithubReleaseNote, InternalReleaseNote } from '../application/release-note-query-types';
import { createBrowserReleaseNoteServices } from '../infrastructure/browser/browser-release-note-services';

export const releaseNoteQueryKeys = {
    internal: ['release-notes', 'internal'] as const,
    github: ['release-notes', 'github'] as const,
};

type InternalReleaseNoteQueryService = Pick<GetInternalReleaseNotesService, 'get'>;
type GithubReleaseQueryService = Pick<GetGithubReleasesService, 'get'>;

const internalError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '릴리즈 노트를 불러오는 중 오류가 발생했습니다.',
});

const githubError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: 'GitHub 릴리즈를 불러오는 중 오류가 발생했습니다.',
});

const isApplicationError = (value: unknown): value is ApplicationError => {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as { kind?: unknown; message?: unknown };
    return (candidate.kind === 'validation'
        || candidate.kind === 'unauthorized'
        || candidate.kind === 'forbidden'
        || candidate.kind === 'not-found'
        || candidate.kind === 'conflict'
        || candidate.kind === 'infrastructure')
        && typeof candidate.message === 'string';
};

const unwrapQuery = async <T>(
    operation: () => Promise<Result<T>>,
    fallbackError: () => ApplicationError,
): Promise<T> => {
    try {
        const result = await operation();
        if (!result.ok) throw result.error;
        return result.value;
    } catch (error) {
        throw isApplicationError(error) ? error : fallbackError();
    }
};

export interface ReleaseNoteQueries {
    internal: UseQueryResult<InternalReleaseNote[], ApplicationError>;
    github: UseQueryResult<GithubReleaseNote[], ApplicationError>;
}

/** 내부 릴리즈와 GitHub 릴리즈를 서로 독립적인 React Query cache로 조회합니다. */
export const useReleaseNotes = (): ReleaseNoteQueries => {
    const [services] = useState<{
        internal: InternalReleaseNoteQueryService;
        github: GithubReleaseQueryService;
    }>(() => {
        const browserServices = createBrowserReleaseNoteServices();
        return {
            internal: browserServices.internalReleaseNoteQueryService,
            github: browserServices.githubReleaseQueryService,
        };
    });

    const internal = useQuery<InternalReleaseNote[], ApplicationError>({
        queryKey: releaseNoteQueryKeys.internal,
        queryFn: () => unwrapQuery(() => services.internal.get(), internalError),
        retry: false,
    });
    const github = useQuery<GithubReleaseNote[], ApplicationError>({
        queryKey: releaseNoteQueryKeys.github,
        queryFn: () => unwrapQuery(() => services.github.get(), githubError),
        retry: false,
    });

    return { internal, github };
};

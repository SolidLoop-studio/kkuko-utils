'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { ApplicationError } from '@/src/shared/application/application-error';
import type { Result } from '@/src/shared/application/result';
import type { GetProfileFavoriteDocsService } from '../application/get-profile-favorite-docs';
import type { ProfileFavoriteDoc } from '../application/profile-favorite-docs-query-types';
import { createBrowserIdentityServices } from '../infrastructure/browser/browser-identity-services';
import { identityQueryKeys } from './identity-query-keys';

export type ProfileFavoriteDocsQueryService = Pick<GetProfileFavoriteDocsService, 'get'>;

const profileFavoriteDocsError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '즐겨찾기한 문서를 불러오는 중 오류가 발생했습니다.',
});

const unwrapProfileFavoriteDocs = async (
    operation: () => Promise<Result<ProfileFavoriteDoc[]>>,
): Promise<ProfileFavoriteDoc[]> => {
    let result: Result<ProfileFavoriteDoc[]>;

    try {
        result = await operation();
    } catch {
        throw profileFavoriteDocsError();
    }

    if (!result.ok) throw result.error;
    return result.value;
};

/** 프로필 즐겨찾기 문서 projection을 React Query cache와 연결합니다. */
export const useProfileFavoriteDocs = (userId: string): UseQueryResult<
    ProfileFavoriteDoc[],
    ApplicationError
> => {
    const [service] = useState<ProfileFavoriteDocsQueryService>(() => (
        createBrowserIdentityServices().profileFavoriteDocsQueryService
    ));
    const normalizedUserId = userId.trim();

    return useQuery<ProfileFavoriteDoc[], ApplicationError>({
        queryKey: identityQueryKeys.profileFavoriteDocs(normalizedUserId),
        queryFn: () => unwrapProfileFavoriteDocs(() => service.get(normalizedUserId)),
        enabled: normalizedUserId.length > 0,
        retry: false,
    });
};

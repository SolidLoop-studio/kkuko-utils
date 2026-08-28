'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { ApplicationError } from '@/src/shared/application/application-error';
import type { Result } from '@/src/shared/application/result';
import type { GetProfileWordRequestsService } from '../application/get-profile-word-requests';
import type { ProfileWordRequest } from '../application/profile-word-requests-query-types';
import { createBrowserIdentityServices } from '../infrastructure/browser/browser-identity-services';
import { identityQueryKeys } from './identity-query-keys';

export type ProfileWordRequestsQueryService = Pick<GetProfileWordRequestsService, 'get'>;

const profileWordRequestsError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '단어 요청 내역을 불러오는 중 오류가 발생했습니다.',
});

const unwrapProfileWordRequests = async (
    operation: () => Promise<Result<ProfileWordRequest[]>>,
): Promise<ProfileWordRequest[]> => {
    let result: Result<ProfileWordRequest[]>;

    try {
        result = await operation();
    } catch {
        throw profileWordRequestsError();
    }

    if (!result.ok) throw result.error;
    return result.value;
};

/** 프로필 단어 요청 projection을 React Query cache와 연결합니다. */
export const useProfileWordRequests = (userId: string): UseQueryResult<
    ProfileWordRequest[],
    ApplicationError
> => {
    const [service] = useState<ProfileWordRequestsQueryService>(() => (
        createBrowserIdentityServices().profileWordRequestsQueryService
    ));
    const normalizedUserId = userId.trim();

    return useQuery<ProfileWordRequest[], ApplicationError>({
        queryKey: identityQueryKeys.profileWordRequests(normalizedUserId),
        queryFn: () => unwrapProfileWordRequests(() => service.get(normalizedUserId)),
        enabled: normalizedUserId.length > 0,
        retry: false,
    });
};

'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { ApplicationError } from '@/src/shared/application/application-error';
import type { Result } from '@/src/shared/application/result';
import type { GetProfileProcessedRequestsService } from '../application/get-profile-processed-requests';
import type { ProfileProcessedRequest } from '../application/profile-processed-requests-query-types';
import { createBrowserIdentityServices } from '../infrastructure/browser/browser-identity-services';
import { identityQueryKeys } from './identity-query-keys';

export type ProfileProcessedRequestsQueryService = Pick<GetProfileProcessedRequestsService, 'get'>;

const profileProcessedRequestsError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '처리된 요청을 불러오는 중 오류가 발생했습니다.',
});

const unwrapProfileProcessedRequests = async (
    operation: () => Promise<Result<ProfileProcessedRequest[]>>,
): Promise<ProfileProcessedRequest[]> => {
    let result: Result<ProfileProcessedRequest[]>;

    try {
        result = await operation();
    } catch {
        throw profileProcessedRequestsError();
    }

    if (!result.ok) throw result.error;
    return result.value;
};

/** 프로필 처리 요청 projection을 React Query cache와 연결합니다. */
export const useProfileProcessedRequests = (userId: string): UseQueryResult<
    ProfileProcessedRequest[],
    ApplicationError
> => {
    const [service] = useState<ProfileProcessedRequestsQueryService>(() => (
        createBrowserIdentityServices().profileProcessedRequestsQueryService
    ));
    const normalizedUserId = userId.trim();

    return useQuery<ProfileProcessedRequest[], ApplicationError>({
        queryKey: identityQueryKeys.profileProcessedRequests(normalizedUserId),
        queryFn: () => unwrapProfileProcessedRequests(() => service.get(normalizedUserId)),
        enabled: normalizedUserId.length > 0,
        retry: false,
    });
};

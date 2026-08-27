'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { ApplicationError } from '@/src/shared/application/application-error';
import type { Result } from '@/src/shared/application/result';
import type { GetProfileSummaryService } from '../application/get-profile-summary';
import type { ProfileSummaryProjection } from '../application/profile-summary-query-types';
import { createBrowserIdentityServices } from '../infrastructure/browser/browser-identity-services';
import { identityQueryKeys } from './identity-query-keys';

export type ProfileSummaryQueryService = Pick<GetProfileSummaryService, 'get'>;

const profileSummaryError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '프로필 정보를 불러오는 중 오류가 발생했습니다.',
});

const isApplicationError = (value: unknown): value is ApplicationError => (
    typeof value === 'object'
    && value !== null
    && typeof (value as { kind?: unknown }).kind === 'string'
    && typeof (value as { message?: unknown }).message === 'string'
);

const unwrapProfileSummary = async (
    operation: () => Promise<Result<ProfileSummaryProjection>>,
): Promise<ProfileSummaryProjection> => {
    try {
        const result = await operation();
        if (!result.ok) throw result.error;
        return result.value;
    } catch (error) {
        throw isApplicationError(error) ? error : profileSummaryError();
    }
};

/** 닉네임 기반 프로필 요약 projection을 React Query cache와 연결합니다. */
export const useProfileSummary = (nickname: string): UseQueryResult<
    ProfileSummaryProjection,
    ApplicationError
> => {
    const [service] = useState<ProfileSummaryQueryService>(() => (
        createBrowserIdentityServices().profileSummaryQueryService
    ));
    const normalizedNickname = nickname.trim();

    return useQuery<ProfileSummaryProjection, ApplicationError>({
        queryKey: identityQueryKeys.profileSummary(normalizedNickname),
        queryFn: () => unwrapProfileSummary(() => service.get(normalizedNickname)),
        enabled: normalizedNickname.length > 0,
        retry: false,
    });
};

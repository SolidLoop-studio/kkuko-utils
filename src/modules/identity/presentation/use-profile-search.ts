'use client';

import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { err, type Result } from '@/src/shared/application/result';
import type { ProfileSearchItem } from '../application/profile-search-query-types';
import { createBrowserIdentityServices } from '../infrastructure/browser/browser-identity-services';

const profileSearchError = () => err<ProfileSearchItem[]>({
    kind: 'infrastructure',
    message: '사용자 검색 중 오류가 발생했습니다.',
});

/** 명시적으로 제출한 닉네임 검색만 실행하고 진행 상태를 화면에 제공합니다. */
export const useProfileSearch = (): {
    search(query: string): Promise<Result<ProfileSearchItem[]>>;
    isPending: boolean;
} => {
    const [services] = useState(() => createBrowserIdentityServices());
    const mutation = useMutation<Result<ProfileSearchItem[]>, never, string>({
        mutationFn: async (query) => {
            try {
                return await services.profileSearchQueryService.search(query);
            } catch {
                return profileSearchError();
            }
        },
    });
    const search = useCallback(
        (query: string) => mutation.mutateAsync(query),
        [mutation],
    );

    return { search, isPending: mutation.isPending };
};

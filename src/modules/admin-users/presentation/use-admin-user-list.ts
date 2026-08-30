'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { ApplicationError } from '@/src/shared/application/application-error';
import type { Result } from '@/src/shared/application/result';
import type { GetAdminUserListService } from '../application/get-admin-user-list';
import type { AdminUserListItem, AdminUserListSort } from '../application/admin-user-list-types';
import { createBrowserAdminUserServices } from '../infrastructure/browser/browser-admin-user-services';
import { adminUserQueryKeys } from './admin-user-query-keys';

export type AdminUserListQueryService = Pick<GetAdminUserListService, 'get'>;

const adminUserListError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '사용자 목록을 불러오는 중 오류가 발생했습니다.',
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

const unwrapAdminUserList = async (
    operation: () => Promise<Result<AdminUserListItem[]>>,
): Promise<AdminUserListItem[]> => {
    try {
        const result = await operation();
        if (!result.ok) throw result.error;
        return result.value;
    } catch (error) {
        throw isApplicationError(error) ? error : adminUserListError();
    }
};

/** 관리자 사용자 목록 projection을 React Query cache와 연결합니다. */
export const useAdminUserList = (
    sort: AdminUserListSort,
): UseQueryResult<AdminUserListItem[], ApplicationError> => {
    const [service] = useState<AdminUserListQueryService>(() => (
        createBrowserAdminUserServices().adminUserListService
    ));

    return useQuery<AdminUserListItem[], ApplicationError>({
        queryKey: adminUserQueryKeys.list(sort),
        queryFn: () => unwrapAdminUserList(() => service.get(sort)),
        retry: false,
    });
};

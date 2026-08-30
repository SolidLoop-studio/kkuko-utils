'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { ApplicationError } from '@/src/shared/application/application-error';
import type { Result } from '@/src/shared/application/result';
import type { GetAdminLogsInitialService } from '../application/get-admin-logs-initial';
import type { AdminLogsInitialProjection } from '../application/admin-logs-initial-query-types';
import { createBrowserAdminLogsServices } from '../infrastructure/browser/browser-admin-logs-services';
import { adminLogsQueryKeys } from './admin-logs-query-keys';

export type AdminLogsInitialQueryService = Pick<GetAdminLogsInitialService, 'get'>;

const adminLogsInitialError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '관리자 로그를 불러오는 중 오류가 발생했습니다.',
});

const unwrapAdminLogsInitial = async (
    operation: () => Promise<Result<AdminLogsInitialProjection>>,
): Promise<AdminLogsInitialProjection> => {
    let result: Result<AdminLogsInitialProjection>;
    try {
        result = await operation();
    } catch {
        throw adminLogsInitialError();
    }
    if (!result.ok) throw result.error;
    return result.value;
};

/** 관리자 로그 초기 projection을 안정적인 React Query cache와 연결합니다. */
export const useAdminLogsInitial = (): UseQueryResult<
    AdminLogsInitialProjection,
    ApplicationError
> => {
    const [service] = useState<AdminLogsInitialQueryService>(() => (
        createBrowserAdminLogsServices().adminLogsInitialQueryService
    ));

    return useQuery<AdminLogsInitialProjection, ApplicationError>({
        queryKey: adminLogsQueryKeys.initial,
        queryFn: () => unwrapAdminLogsInitial(() => service.get()),
        retry: false,
    });
};

'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { ApplicationError } from '@/src/shared/application/application-error';
import type { Result } from '@/src/shared/application/result';
import type { GetAdminLogsPageService } from '../application/get-admin-logs-page';
import type {
    AdminLogsPageProjection,
    AdminLogsPageQuery,
} from '../application/admin-logs-page-query-types';
import { createBrowserAdminLogsServices } from '../infrastructure/browser/browser-admin-logs-services';
import { adminLogsQueryKeys } from './admin-logs-query-keys';

export type AdminLogsPageQueryService = Pick<GetAdminLogsPageService, 'get'>;

const adminLogsPageError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '관리자 로그를 불러오는 중 오류가 발생했습니다.',
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

const unwrapAdminLogsPage = async (
    operation: () => Promise<Result<AdminLogsPageProjection>>,
): Promise<AdminLogsPageProjection> => {
    try {
        const result = await operation();
        if (!result.ok) throw result.error;
        return result.value;
    } catch (error) {
        throw isApplicationError(error) ? error : adminLogsPageError();
    }
};

/** 관리자 로그의 필터링된 페이지 projection을 React Query cache와 연결합니다. */
export const useAdminLogsPage = (
    query: AdminLogsPageQuery,
): UseQueryResult<AdminLogsPageProjection, ApplicationError> => {
    const [service] = useState<AdminLogsPageQueryService>(() => (
        createBrowserAdminLogsServices().adminLogsPageQueryService
    ));

    return useQuery<AdminLogsPageProjection, ApplicationError>({
        queryKey: adminLogsQueryKeys.page(query),
        queryFn: () => unwrapAdminLogsPage(() => service.get(query)),
        retry: false,
    });
};

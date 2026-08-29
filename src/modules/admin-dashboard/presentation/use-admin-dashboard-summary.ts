'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { ApplicationError } from '@/src/shared/application/application-error';
import type { Result } from '@/src/shared/application/result';
import type { GetAdminDashboardSummaryService } from '../application/get-admin-dashboard-summary';
import type { AdminDashboardSummary } from '../application/admin-dashboard-query-types';
import { createBrowserAdminDashboardServices } from '../infrastructure/browser/browser-admin-dashboard-services';
import { adminDashboardQueryKeys } from './admin-dashboard-query-keys';

export type AdminDashboardSummaryService = Pick<GetAdminDashboardSummaryService, 'get'>;

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '관리자 대시보드 정보를 불러오는 중 오류가 발생했습니다.',
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

const unwrapSummary = async (
    operation: () => Promise<Result<AdminDashboardSummary>>,
): Promise<AdminDashboardSummary> => {
    try {
        const result = await operation();
        if (!result.ok) throw result.error;
        return result.value;
    } catch (error) {
        throw isApplicationError(error) ? error : infrastructureError();
    }
};

/** 관리자 집계 projection을 React Query 캐시와 연결합니다. */
export const useAdminDashboardSummary = (): UseQueryResult<
    AdminDashboardSummary,
    ApplicationError
> => {
    const [service] = useState<AdminDashboardSummaryService>(() => (
        createBrowserAdminDashboardServices().adminDashboardSummaryService
    ));

    return useQuery<AdminDashboardSummary, ApplicationError>({
        queryKey: adminDashboardQueryKeys.summary(),
        queryFn: () => unwrapSummary(() => service.get()),
        retry: false,
        staleTime: 60 * 1000,
    });
};

import 'server-only';

import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import { createPublicSupabaseClient } from '@/src/shared/infrastructure/supabase/public-client';
import { createServerSupabaseClient } from '@/src/shared/infrastructure/supabase/server-client';
import { GetNotificationDetailService } from '../../application/get-notification-detail';
import { GetNotificationListService } from '../../application/get-notification-list';
import {
    SupabaseNotificationDetailQueryGateway,
    type NotificationDetailQueryClient,
} from './supabase-notification-detail-query-gateway';
import {
    SupabaseServerNotificationListQueryGateway,
    type ServerNotificationListQueryClient,
} from './supabase-server-notification-list-query-gateway';

export interface ServerNotificationServices {
    notificationDetailQueryService: GetNotificationDetailService;
    notificationListQueryService: GetNotificationListService;
}

const createNotificationServices = (
    client: NotificationDetailQueryClient & ServerNotificationListQueryClient,
): ServerNotificationServices => {
    return {
        notificationDetailQueryService: new GetNotificationDetailService(
            new SupabaseNotificationDetailQueryGateway(
                client,
            ),
        ),
        notificationListQueryService: new GetNotificationListService(
            new SupabaseServerNotificationListQueryGateway(
                client,
            ),
        ),
    };
};

/** 쿠키 없는 anon Supabase client로 공개 공지 조회 서비스를 조합합니다. */
export const createPublicNotificationServices = (): ServerNotificationServices =>
    createNotificationServices(
        createPublicSupabaseClient() as unknown as NotificationDetailQueryClient
            & ServerNotificationListQueryClient,
    );

/** 요청별 인증 Supabase client로 공지 조회 서비스를 조합합니다. */
export const createAuthenticatedNotificationQueryServices = async (): Promise<ServerNotificationServices> =>
    createNotificationServices(
        await createServerSupabaseClient() as unknown as NotificationDetailQueryClient
            & ServerNotificationListQueryClient,
    );

/** @deprecated `createAuthenticatedNotificationQueryServices`를 사용하세요. */
export const createServerNotificationServices = createAuthenticatedNotificationQueryServices;

const getCachedNotificationDetail = unstable_cache(
    async (id: number) => {
        const { notificationDetailQueryService } = createPublicNotificationServices();
        return notificationDetailQueryService.get(id);
    },
    ['notification-detail'],
    { revalidate: 60 },
);

/** 같은 RSC 요청과 60초 ISR cache에서 공개 공지 상세 조회 결과를 공유합니다. */
export const getServerNotificationDetail = cache(getCachedNotificationDetail);

/** 인증이 필요한 편집 화면을 위해 캐시 없이 공지 상세를 조회합니다. */
export const getFreshServerNotificationDetail = async (id: number) => {
    const { notificationDetailQueryService } = await createAuthenticatedNotificationQueryServices();
    return notificationDetailQueryService.get(id);
};

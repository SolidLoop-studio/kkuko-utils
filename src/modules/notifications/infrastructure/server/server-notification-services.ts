import { cache } from 'react';
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

/** 요청별 server Supabase client로 공지 조회 서비스를 조합합니다. */
export const createServerNotificationServices = async (): Promise<ServerNotificationServices> => {
    const client = await createServerSupabaseClient();
    return {
        notificationDetailQueryService: new GetNotificationDetailService(
            new SupabaseNotificationDetailQueryGateway(
                client as unknown as NotificationDetailQueryClient,
            ),
        ),
        notificationListQueryService: new GetNotificationListService(
            new SupabaseServerNotificationListQueryGateway(
                client as unknown as ServerNotificationListQueryClient,
            ),
        ),
    };
};

/** 같은 RSC 요청 안의 metadata와 page가 공지 상세 조회 결과를 공유합니다. */
export const getServerNotificationDetail = cache(async (id: number) => {
    const { notificationDetailQueryService } = await createServerNotificationServices();
    return notificationDetailQueryService.get(id);
});

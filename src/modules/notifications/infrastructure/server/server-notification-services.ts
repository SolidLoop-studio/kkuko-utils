import { createServerSupabaseClient } from '@/src/shared/infrastructure/supabase/server-client';
import { GetNotificationListService } from '../../application/get-notification-list';
import {
    SupabaseServerNotificationListQueryGateway,
    type ServerNotificationListQueryClient,
} from './supabase-server-notification-list-query-gateway';

export interface ServerNotificationServices {
    notificationListQueryService: GetNotificationListService;
}

/** 요청별 server Supabase client로 공지 조회 서비스를 조합합니다. */
export const createServerNotificationServices = async (): Promise<ServerNotificationServices> => {
    const client = await createServerSupabaseClient();
    return {
        notificationListQueryService: new GetNotificationListService(
            new SupabaseServerNotificationListQueryGateway(
                client as unknown as ServerNotificationListQueryClient,
            ),
        ),
    };
};

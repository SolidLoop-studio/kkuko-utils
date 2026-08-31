import 'server-only';

import { DeleteNotificationService } from '../../application/delete-notification';
import { RecordNotificationViewService } from '../../application/record-notification-view';
import { SaveNotificationService } from '../../application/save-notification';
import { err, ok, type Result } from '@/src/shared/application/result';
import { createPublicSupabaseClient } from '@/src/shared/infrastructure/supabase/public-client';
import { createServerSupabaseClient } from '@/src/shared/infrastructure/supabase/server-client';
import {
    SupabaseNotificationDeleteCommandGateway,
    type NotificationDeleteClient,
} from '../supabase/supabase-notification-delete-command-gateway';
import {
    SupabaseNotificationImageReferenceQueryGateway,
    type NotificationImageReferenceQueryClient,
} from '../supabase/supabase-notification-image-reference-query-gateway';
import {
    SupabaseNotificationImageStorage,
    type NotificationImageStorageClient,
} from '../supabase/supabase-notification-image-storage';
import {
    SupabaseNotificationWriteCommandGateway,
    type NotificationWriteClient,
} from '../supabase/supabase-notification-write-command-gateway';
import {
    SupabaseNotificationViewCommandGateway,
    type NotificationViewCommandClient,
} from './supabase-notification-view-command-gateway';

interface UserRoleQuery {
    select(columns: 'role'): UserRoleQuery;
    eq(column: 'id', value: string): UserRoleQuery;
    maybeSingle(): PromiseLike<unknown>;
}

export interface NotificationAuthorizationClient {
    auth: {
        getUser(): PromiseLike<unknown>;
    };
    from(table: 'users'): UserRoleQuery;
}

export interface ServerNotificationCommandServices {
    authorize(): Promise<Result<void>>;
    notificationDeleteService: DeleteNotificationService;
    notificationWriteService: SaveNotificationService;
}

const unauthorized = () => err<void>({
    kind: 'unauthorized',
    message: '로그인이 필요합니다.',
});

const forbidden = () => err<void>({
    kind: 'forbidden',
    message: '공지사항 관리 권한이 없습니다.',
});

const infrastructure = () => err<void>({
    kind: 'infrastructure',
    message: '공지사항 권한을 확인하지 못했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const userIdFromResponse = (response: unknown): string | null => {
    if (!isRecord(response) || !isRecord(response.data)) return null;
    const user = response.data.user;
    return isRecord(user) && typeof user.id === 'string' && user.id.length > 0 ? user.id : null;
};

/** 인증 사용자와 DB role을 모두 확인해 공지 관리 권한을 판정합니다. */
export const authorizeNotificationManager = async (
    client: NotificationAuthorizationClient,
): Promise<Result<void>> => {
    let userResponse: unknown;
    try {
        userResponse = await client.auth.getUser();
    } catch {
        return infrastructure();
    }

    const userId = userIdFromResponse(userResponse);
    if (userId === null) return unauthorized();

    try {
        const response: unknown = await client
            .from('users')
            .select('role')
            .eq('id', userId)
            .maybeSingle();
        if (!isRecord(response) || response.error !== null) return infrastructure();
        if (response.data === null) return forbidden();
        if (!isRecord(response.data)) return infrastructure();

        return response.data.role === 'r4' || response.data.role === 'admin'
            ? ok(undefined)
            : forbidden();
    } catch {
        return infrastructure();
    }
};

type AuthenticatedNotificationClient = NotificationAuthorizationClient
    & NotificationDeleteClient
    & NotificationImageReferenceQueryClient
    & NotificationImageStorageClient
    & NotificationWriteClient;

/** 하나의 요청별 인증 Supabase client로 관리 명령 서비스를 조합합니다. */
export const createServerNotificationCommandServices = async (): Promise<ServerNotificationCommandServices> => {
    const client = await createServerSupabaseClient() as unknown as AuthenticatedNotificationClient;
    const imageStorage = new SupabaseNotificationImageStorage(client);
    const imageReferences = new SupabaseNotificationImageReferenceQueryGateway(client);

    return {
        authorize: () => authorizeNotificationManager(client),
        notificationDeleteService: new DeleteNotificationService(
            new SupabaseNotificationDeleteCommandGateway(client),
            imageStorage,
            imageReferences,
        ),
        notificationWriteService: new SaveNotificationService(
            new SupabaseNotificationWriteCommandGateway(client),
            imageStorage,
            imageReferences,
        ),
    };
};

/** 쿠키 없는 anon client로 공개 조회 수 기록 서비스를 조합합니다. */
export const createPublicNotificationViewService = (): RecordNotificationViewService =>
    new RecordNotificationViewService(
        new SupabaseNotificationViewCommandGateway(
            createPublicSupabaseClient() as unknown as NotificationViewCommandClient,
        ),
    );

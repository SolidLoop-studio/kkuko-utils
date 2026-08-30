import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import {
    SupabaseModalNoticeQueryGateway as SharedSupabaseModalNoticeQueryGateway,
    type SupabaseModalNoticeQueryClient,
} from '../supabase/supabase-modal-notice-query-gateway';

export type ModalNoticeQueryClient = SupabaseModalNoticeQueryClient;

/** 브라우저 Supabase client로 활성 모달 공지를 조회합니다. */
export class SupabaseModalNoticeQueryGateway extends SharedSupabaseModalNoticeQueryGateway {
    constructor(
        client: ModalNoticeQueryClient = browserSupabaseClient as unknown as ModalNoticeQueryClient,
        clock?: () => Date,
    ) {
        super(client, clock);
    }
}

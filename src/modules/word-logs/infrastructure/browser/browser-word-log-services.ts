import { GetWordLogPageService } from '../../application/get-word-log-page';
import { SupabaseWordLogQueryGateway } from './supabase-word-log-query-gateway';

export interface BrowserWordLogServices {
    wordLogPageQueryService: GetWordLogPageService;
}

/** 공개 단어 로그의 브라우저 조회 의존성을 조합합니다. */
export const createBrowserWordLogServices = (): BrowserWordLogServices => ({
    wordLogPageQueryService: new GetWordLogPageService(
        new SupabaseWordLogQueryGateway(),
    ),
});

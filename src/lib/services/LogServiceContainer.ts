import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import { SupabaseLogRepository } from './infrastructure/supabase/SupabaseLogRepository';
import { LogService } from './application/log/LogService';

/**
 * Log 서비스 컨테이너
 *
 * Supabase 기반 로그 리포지토리를 구성하고 LogService를 제공합니다.
 */
export class LogServiceContainer {
    public readonly service: LogService;

    constructor(supabase: SupabaseClient<Database>) {
        const repo = new SupabaseLogRepository(supabase);
        this.service = new LogService(repo);
    }
}

/**
 * LogServiceContainer 팩토리
 *
 * @param supabase - Supabase 클라이언트
 * @returns LogServiceContainer 인스턴스
 */
export function createLogServiceContainer(supabase: SupabaseClient<Database>): LogServiceContainer {
    return new LogServiceContainer(supabase);
}

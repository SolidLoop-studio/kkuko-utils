import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import { SupabaseLogRepository } from './infrastructure/supabase/SupabaseLogRepository';
import { LogService } from './application/log/LogService';

export class LogServiceContainer {
    public readonly service: LogService;

    constructor(supabase: SupabaseClient<Database>) {
        const repo = new SupabaseLogRepository(supabase);
        this.service = new LogService(repo);
    }
}

export function createLogServiceContainer(supabase: SupabaseClient<Database>): LogServiceContainer {
    return new LogServiceContainer(supabase);
}

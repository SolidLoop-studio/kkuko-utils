import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import type { ILogRepository } from '../../domain/log/LogRepository';
import type { WordLogEntity, WordLogFilter } from '../../domain/log/LogEntity';
import type { Result, CustomError } from '../../domain/result';
import { success, failure } from '../../domain/result';
import { infrastructureError } from '../../domain/errors';

function toWordLogEntity(row: {
    id: number;
    word: string;
    state: 'approved' | 'rejected' | 'pending';
    r_type: 'add' | 'delete';
    make_by: string | null;
    processed_by: string | null;
    created_at: string;
    make_by_user: { nickname: string } | null;
    processed_by_user: { nickname: string | null } | null;
}): WordLogEntity {
    return {
        id: row.id,
        word: row.word,
        state: row.state,
        requestType: row.r_type,
        madeBy: row.make_by,
        processedBy: row.processed_by,
        createdAt: row.created_at,
        madeByUser: row.make_by_user,
        processedByUser: row.processed_by_user,
    };
}

export class SupabaseLogRepository implements ILogRepository {
    constructor(private readonly supabase: SupabaseClient<Database>) {}

    async findWordLogsByFilter(
        filter: WordLogFilter
    ): Promise<Result<{ data: WordLogEntity[]; count: number }, CustomError>> {
        let query = this.supabase
            .from('logs')
            .select(
                `*, make_by_user:users!logs_make_by_fkey(nickname), processed_by_user:users!logs_processed_by_fkey(nickname)`,
                { count: 'exact' }
            )
            .order('created_at', { ascending: false });

        if (filter.filterState !== 'all') query = query.eq('state', filter.filterState);
        if (filter.filterType !== 'all') query = query.eq('r_type', filter.filterType);
        query = query.range(filter.from, filter.to);

        const { data, error, count } = await query;
        if (error) return failure(infrastructureError(error));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return success({ data: (data ?? []).map((r) => toWordLogEntity(r as any)), count: count ?? 0 });
    }

    async deleteWordLogsByIds(ids: number[]): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.from('logs').delete().in('id', ids);
        if (error) return failure(infrastructureError(error));
        return success(undefined);
    }

    async deleteDocsLogsByIds(ids: number[]): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.from('docs_logs').delete().in('id', ids);
        if (error) return failure(infrastructureError(error));
        return success(undefined);
    }

    async saveWordLogs(logsData: { word: string; make_by: string | null; processed_by: string | null; r_type: 'add' | 'delete'; state: 'approved' | 'rejected' }[]): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.from('logs').insert(logsData);
        if (error) return failure(infrastructureError(error));
        return success(undefined);
    }

    async saveDocsLogs(logsData: { word: string; docs_id: number; add_by: string | null; type: 'add' | 'delete' }[]): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.from('docs_logs').insert(logsData);
        if (error) return failure(infrastructureError(error));
        return success(undefined);
    }
}

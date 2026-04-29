import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import type { IWaitDocsRepository } from '../../domain/docs/WaitDocsRepository';
import type { Result, CustomError } from '../../domain/result';
import type { WaitDocsEntity, WaitDocsWithUser } from '../../domain/docs/DocsEntity';
import { success, failure } from '../../domain/result';
import { infrastructureError } from '../../domain/errors';

type WaitDocsRow = Database['public']['Tables']['docs_wait']['Row'];

function toWaitDocsEntity(row: WaitDocsRow): WaitDocsEntity {
    return {
        id: row.id,
        docsName: row.docs_name,
        reqBy: row.req_by,
        reqAt: row.req_at,
    };
}

function toWaitDocsWithUser(
    row: WaitDocsRow & { users: { nickname: string } | null }
): WaitDocsWithUser {
    return {
        ...toWaitDocsEntity(row),
        userNickname: row.users?.nickname ?? null,
    };
}

/**
 * Supabase 기반 IWaitDocsRepository 구현체
 */
export class SupabaseWaitDocsRepository implements IWaitDocsRepository {
    constructor(private readonly supabase: SupabaseClient<Database>) {}

    /** @inheritdoc */
    async findAll(): Promise<Result<WaitDocsWithUser[], CustomError>> {
        const { data, error } = await this.supabase
            .from('docs_wait')
            .select('*, users(*)');

        if (error) return failure(infrastructureError(error));

        return success((data ?? []).map(toWaitDocsWithUser));
    }

    /** @inheritdoc */
    async save(docsName: string, reqBy: string | null): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase
            .from('docs_wait')
            .insert({ docs_name: docsName, req_by: reqBy });

        if (error) return failure(infrastructureError(error));

        return success(undefined);
    }

    /** @inheritdoc */
    async deleteByIds(ids: number[]): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.from('docs_wait').delete().in('id', ids);

        if (error) return failure(infrastructureError(error));

        return success(undefined);
    }
}

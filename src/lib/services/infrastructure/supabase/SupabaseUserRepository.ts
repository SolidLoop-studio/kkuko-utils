import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import type { IUserRepository } from '../../domain/user/UserRepository';
import type { Result, CustomError } from '../../domain/result';
import type {
    UserEntity,
    UserSortField,
    UserStarredDocs,
    UserMonthlyContribution,
    UserWaitWordRequest,
    UserWordLog,
} from '../../domain/user/UserEntity';
import { success, failure } from '../../domain/result';
import { infrastructureError } from '../../domain/errors';
import axios from 'axios';

type UserRow = Database['public']['Tables']['users']['Row'];

function toUserEntity(row: UserRow): UserEntity {
    return {
        id: row.id,
        nickname: row.nickname,
        role: row.role,
        contribution: row.contribution,
        monthContribution: row.month_contribution,
    };
}

export class SupabaseUserRepository implements IUserRepository {
    constructor(private readonly supabase: SupabaseClient<Database>) {}

    async findById(userId: string): Promise<Result<UserEntity | null, CustomError>> {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
        if (error) return failure(infrastructureError(error));
        return success(data ? toUserEntity(data) : null);
    }

    async findByNickname(nickname: string): Promise<Result<UserEntity | null, CustomError>> {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .eq('nickname', nickname)
            .maybeSingle();
        if (error) return failure(infrastructureError(error));
        return success(data ? toUserEntity(data) : null);
    }

    async findByNicknameExact(nickname: string): Promise<Result<UserEntity[], CustomError>> {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .eq('nickname', nickname.trim());
        if (error) return failure(infrastructureError(error));
        return success((data ?? []).map(toUserEntity));
    }

    async searchByNickname(query: string): Promise<Result<UserEntity[], CustomError>> {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .ilike('nickname', `%${query}%`);
        if (error) return failure(infrastructureError(error));
        return success((data ?? []).map(toUserEntity));
    }

    async findAll(
        sort: { field: UserSortField; ascending: boolean } = { field: 'contribution', ascending: false }
    ): Promise<Result<UserEntity[], CustomError>> {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .order(sort.field, { ascending: sort.ascending });
        if (error) return failure(infrastructureError(error));
        return success((data ?? []).map(toUserEntity));
    }

    async findMonthlyRank(userId: string): Promise<Result<number, CustomError>> {
        const { data, error } = await this.supabase.rpc('get_user_monthly_rank', { uid: userId });
        if (error) return failure(infrastructureError(error));
        return success(data ?? 0);
    }

    async findMonthlyContributions(
        userId: string
    ): Promise<Result<UserMonthlyContribution[], CustomError>> {
        const { data, error } = await this.supabase
            .from('user_month_contributions')
            .select('*')
            .eq('user_id', userId)
            .limit(4);
        if (error) return failure(infrastructureError(error));
        return success(
            (data ?? []).map((row) => ({
                id: row.id,
                userId: row.user_id,
                month: row.month,
                contribution: row.contribution,
            }))
        );
    }

    async findStarredDocs(userId: string): Promise<Result<UserStarredDocs[], CustomError>> {
        const { data, error } = await this.supabase
            .from('user_star_docs')
            .select('*, docs(*)')
            .eq('user_id', userId);
        if (error) return failure(infrastructureError(error));
        return success(
            (data ?? []).map((row) => {
                const docs = row.docs as { id: number; name: string; typez: string } | null;
                return {
                    userId: row.user_id,
                    docsId: row.docs_id,
                    createdAt: row.created_at,
                    docs: {
                        id: docs?.id ?? 0,
                        name: docs?.name ?? '',
                        typez: docs?.typez ?? '',
                    },
                };
            })
        );
    }

    async findWaitWordRequests(
        userId: string
    ): Promise<Result<UserWaitWordRequest[], CustomError>> {
        const { data, error } = await this.supabase
            .from('wait_words')
            .select('*')
            .eq('requested_by', userId)
            .order('requested_at', { ascending: false })
            .limit(30);
        if (error) return failure(infrastructureError(error));
        return success(
            (data ?? []).map((row) => ({
                id: row.id,
                word: row.word,
                requestType: row.request_type,
                requestedAt: row.requested_at,
            }))
        );
    }

    async findWordLogs(userId: string): Promise<Result<UserWordLog[], CustomError>> {
        const { data, error } = await this.supabase
            .from('logs')
            .select('*')
            .eq('make_by', userId)
            .order('created_at', { ascending: false })
            .limit(30);
        if (error) return failure(infrastructureError(error));
        return success(
            (data ?? []).map((row) => ({
                id: row.id,
                word: row.word,
                rType: row.r_type,
                state: row.state,
                createdAt: row.created_at,
            }))
        );
    }

    async incrementContribution(userId: string, amount: number = 1): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.rpc('increment_contribution', {
            target_id: userId,
            inc_amount: amount,
        });
        if (error) return failure(infrastructureError(error));
        return success(undefined);
    }

    async addStarDocs(userId: string, docsId: number): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase
            .from('user_star_docs')
            .insert({ docs_id: docsId, user_id: userId });
        if (error) return failure(infrastructureError(error));
        return success(undefined);
    }

    async removeStarDocs(userId: string, docsId: number): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase
            .from('user_star_docs')
            .delete()
            .eq('docs_id', docsId)
            .eq('user_id', userId);
        if (error) return failure(infrastructureError(error));
        return success(undefined);
    }

    async setNickname(nickname: string): Promise<Result<UserEntity, CustomError>> {
        try {
            const res = await axios.post('/api/auth/set_nickname', { nickname: nickname.trim() });
            const { data, error } = res.data as { data: null, error: PostgrestError } | { data: UserRow, error: null};
            if (error) return failure(infrastructureError(error));
            return success(toUserEntity(data));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return failure(infrastructureError({ message }));
        }
    }
}

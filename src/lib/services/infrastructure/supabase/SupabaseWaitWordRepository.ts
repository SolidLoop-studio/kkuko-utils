import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import type { IWaitWordRepository } from '../../domain/word/WaitWordRepository';
import type { CustomError } from '../../domain/result';
import type { Result } from '../../domain/result';
import type {
    WaitWordEntity,
    WaitWordWithUser,
    NewWaitWord,
} from '../../domain/word/WaitWordEntity';
import { success, failure } from '../../domain/result';
import { infrastructureError } from '../../domain/errors';

type WaitWordRow = Database['public']['Tables']['wait_words']['Row'];

/**
 * DB Row를 WaitWordEntity 도메인 객체로 변환합니다.
 *
 * @param row - wait_words 테이블 Row
 * @returns WaitWordEntity
 */
function toWaitWordEntity(row: WaitWordRow): WaitWordEntity {
    return {
        id: row.id,
        word: row.word,
        requestType: row.request_type,
        status: row.status,
        requestedBy: row.requested_by,
        requestedAt: row.requested_at,
        wordId: row.word_id,
    };
}

/**
 * Supabase 기반 IWaitWordRepository 구현체
 *
 * GetManager, AddManager, DeleteManager에서 wait_words 테이블 관련 쿼리를 추출하여 구현합니다.
 */
export class SupabaseWaitWordRepository implements IWaitWordRepository {
    constructor(private readonly supabase: SupabaseClient<Database>) {}

    /** @inheritdoc */
    async findByWord(word: string): Promise<Result<WaitWordWithUser | null, CustomError>> {
        const { data, error } = await this.supabase
            .from('wait_words')
            .select('*,users(nickname)')
            .eq('word', word)
            .maybeSingle();

        if (error) return failure(infrastructureError(error));

        if (!data) return success(null);

        return success({
            ...toWaitWordEntity(data),
            userNickname: data.users?.nickname ?? null,
        });
    }

    /** @inheritdoc */
    async findAll(filter?: 'add' | 'delete'): Promise<Result<WaitWordWithUser[], CustomError>> {
        let query = this.supabase
            .from('wait_words')
            .select('*,words(*),users(*)')
            .order('requested_at', { ascending: true });

        if (filter === 'add') {
            query = this.supabase
                .from('wait_words')
                .select('*,words(*),users(*)')
                .eq('request_type', 'add')
                .order('requested_at', { ascending: true });
        } else if (filter === 'delete') {
            query = this.supabase
                .from('wait_words')
                .select('*,words(*),users(*)')
                .eq('request_type', 'delete')
                .order('requested_at', { ascending: true });
        }

        const { data, error } = await query;

        if (error) return failure(infrastructureError(error));

        return success(
            (data ?? []).map((row) => ({
                ...toWaitWordEntity(row),
                userNickname: row.users?.nickname ?? null,
            }))
        );
    }

    /** @inheritdoc */
    async findByPrefix(query: string): Promise<Result<string[], CustomError>> {
        const cleanQuery = query.trim().replace(/[^ㄱ-힣a-zA-Z0-9]/g, '');

        const { data, error } = await this.supabase
            .from('wait_words')
            .select('word')
            .ilike('word', `${cleanQuery}%`);

        if (error) return failure(infrastructureError(error));

        return success((data ?? []).map((item) => item.word));
    }

    /** @inheritdoc */
    async save(data: NewWaitWord): Promise<Result<WaitWordEntity | null, CustomError>> {
        const insertData = data.requestType === 'delete'
            ? {
                word: data.word,
                requested_by: data.requestedBy,
                request_type: 'delete' as const,
                word_id: data.wordId,
            }
            : {
                word: data.word,
                requested_by: data.requestedBy,
                request_type: 'add' as const,
            };

        const { data: result, error } = await this.supabase
            .from('wait_words')
            .insert(insertData)
            .select('*')
            .maybeSingle();

        if (error) return failure(infrastructureError(error));

        if (!result) return success(null);

        return success(toWaitWordEntity(result));
    }

    /** @inheritdoc */
    async saveBulk(data: { word: string; requestedBy: string | null; requestType: 'add' }[]): Promise<Result<WaitWordEntity[], CustomError>> {
        const insertData = data.map((d) => ({
            word: d.word,
            requested_by: d.requestedBy,
            request_type: d.requestType,
        }));

        const { data: result, error } = await this.supabase
            .from('wait_words')
            .upsert(insertData, { onConflict: 'word', ignoreDuplicates: true })
            .select('*');

        if (error) return failure(infrastructureError(error));

        return success((result ?? []).map(toWaitWordEntity));
    }

    /** @inheritdoc */
    async deleteById(id: number): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.from('wait_words').delete().eq('id', id);

        if (error) return failure(infrastructureError(error));

        return success(undefined);
    }

    /** @inheritdoc */
    async deleteByIds(ids: number[]): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.from('wait_words').delete().in('id', ids);

        if (error) return failure(infrastructureError(error));

        return success(undefined);
    }

    /** @inheritdoc */
    async deleteByWord(word: string): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.from('wait_words').delete().eq('word', word);

        if (error) return failure(infrastructureError(error));

        return success(undefined);
    }

    /** @inheritdoc */
    async deleteByWords(words: string[]): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.from('wait_words').delete().in('word', words);

        if (error) return failure(infrastructureError(error));

        return success(undefined);
    }

    /** @inheritdoc */
    async findWaitWordsCount(): Promise<Result<number, CustomError>> {
        const { count: count1, error: error1 } = await this.supabase
            .from('wait_words')
            .select('word', { count: 'exact', head: true });
        const { count: count2, error: error2 } = await this.supabase
            .from('word_themes_wait')
            .select('word_id', { count: 'exact', head: true });

        if (error1 || error2) {
            return failure(infrastructureError(error1 ?? error2!));
        }

        return success((count1 ?? 0) + (count2 ?? 0));
    }
}

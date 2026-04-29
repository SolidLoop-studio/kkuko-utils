import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import type { IDocsRepository } from '../../domain/docs/DocsRepository';
import type { Result, CustomError } from '../../domain/result';
import type {
    DocsEntity,
    DocsWithUser,
    DocsLogEntity,
    DocsLogWithDocs,
    NewDocs,
    NewDocsLog,
    DocsLogFilter,
    DocsWordCountInput,
} from '../../domain/docs/DocsEntity';
import { success, failure } from '../../domain/result';
import { infrastructureError } from '../../domain/errors';
import { reverDuemLaw } from '@/src/lib/hangulUtils';
import { sum } from 'es-toolkit';

type DocsRow = Database['public']['Tables']['docs']['Row'];
type DocsLogRow = Database['public']['Tables']['docs_logs']['Row'];

function toDocsEntity(row: DocsRow): DocsEntity {
    return {
        id: row.id,
        name: row.name,
        typez: row.typez,
        maker: row.maker,
        duem: row.duem,
        isHidden: row.is_hidden,
        views: row.views,
        createdAt: row.created_at,
        lastUpdate: row.last_update,
    };
}

function toDocsLogEntity(row: DocsLogRow): DocsLogEntity {
    return {
        id: row.id,
        docsId: row.docs_id,
        word: row.word,
        type: row.type,
        addBy: row.add_by,
        date: row.date,
    };
}

/**
 * Supabase 기반 IDocsRepository 구현체
 */
export class SupabaseDocsRepository implements IDocsRepository {
    constructor(private readonly supabase: SupabaseClient<Database>) {}

    /** @inheritdoc */
    async findAll(): Promise<Result<DocsWithUser[], CustomError>> {
        let query = this.supabase.from('docs').select('*, users(*)');

        if (process.env.NODE_ENV === 'production') {
            query = query.eq('is_hidden', false) as typeof query;
        }

        const { data, error } = await query;

        if (error) return failure(infrastructureError(error));

        return success(
            (data ?? []).map((row) => ({
                ...toDocsEntity(row),
                userNickname: row.users?.nickname ?? null,
            }))
        );
    }

    /** @inheritdoc */
    async findById(id: number): Promise<Result<DocsWithUser | null, CustomError>> {
        const { data, error } = await this.supabase
            .from('docs')
            .select('*, users(*)')
            .eq('id', id)
            .maybeSingle();

        if (error) return failure(infrastructureError(error));

        if (!data) return success(null);

        return success({
            ...toDocsEntity(data),
            userNickname: data.users?.nickname ?? null,
        });
    }

    /** @inheritdoc */
    async findByType(typez: 'letter' | 'theme'): Promise<Result<DocsEntity[], CustomError>> {
        const { data, error } = await this.supabase
            .from('docs')
            .select('*')
            .eq('typez', typez);

        if (error) return failure(infrastructureError(error));

        return success((data ?? []).map(toDocsEntity));
    }

    /** @inheritdoc */
    async findByThemeNames(names: string[]): Promise<Result<DocsEntity[], CustomError>> {
        const { data, error } = await this.supabase
            .from('docs')
            .select('*')
            .eq('typez', 'theme')
            .in('name', names);

        if (error) return failure(infrastructureError(error));

        return success((data ?? []).map(toDocsEntity));
    }

    /** @inheritdoc */
    async findLastUpdate(id: number): Promise<Result<string | null, CustomError>> {
        const { data, error } = await this.supabase
            .from('docs')
            .select('last_update')
            .eq('id', id)
            .maybeSingle();

        if (error) return failure(infrastructureError(error));

        return success(data?.last_update ?? null);
    }

    /** @inheritdoc */
    async findWordCount(input: DocsWordCountInput): Promise<Result<number, CustomError>> {
        if (input.typez === 'letter') {
            if (input.duem) {
                const letters = reverDuemLaw(input.name[0]);
                const { data, error } = await this.supabase
                    .from('word_last_letter_counts')
                    .select('count')
                    .in('last_letter', letters);

                if (error) return failure(infrastructureError(error));

                return success(sum((data ?? []).map((row) => row.count)));
            } else {
                const { data, error } = await this.supabase
                    .from('word_last_letter_counts')
                    .select('count')
                    .eq('last_letter', input.name[0])
                    .maybeSingle();

                if (error) return failure(infrastructureError(error));

                return success(data?.count ?? 0);
            }
        }

        if (input.typez === 'theme') {
            const { data: themeData, error: themeError } = await this.supabase
                .from('themes')
                .select('id')
                .eq('name', input.name)
                .maybeSingle();

            if (themeError) return failure(infrastructureError(themeError));

            if (!themeData) return success(0);

            const { count, error } = await this.supabase
                .from('word_themes')
                .select('word_id', { count: 'exact', head: true })
                .eq('theme_id', themeData.id);

            if (error) return failure(infrastructureError(error));

            return success(count ?? 0);
        }

        // typez === 'ect'
        if (input.name === 201 || input.name === 202) {
            const { count, error } = await this.supabase
                .from('words')
                .select('id', { count: 'exact', head: true })
                .eq('k_canuse', true)
                .gt('length', 8);

            if (error) return failure(infrastructureError(error));

            return success(count ?? 0);
        }

        return success(0);
    }

    /** @inheritdoc */
    async findViewRank(id: number): Promise<Result<number, CustomError>> {
        const { data, error } = await this.supabase.rpc('get_doc_rank', { doc_id: id });

        if (error) return failure(infrastructureError(error));

        return success(data as number);
    }

    /** @inheritdoc */
    async findStarCount(id: number): Promise<Result<number, CustomError>> {
        const { data, error } = await this.supabase
            .from('user_star_docs')
            .select('id')
            .eq('docs_id', id);

        if (error) return failure(infrastructureError(error));

        return success((data ?? []).length);
    }

    /** @inheritdoc */
    async findStarUsers(id: number): Promise<Result<string[], CustomError>> {
        const { data, error } = await this.supabase
            .from('user_star_docs')
            .select('user_id')
            .eq('docs_id', id);

        if (error) return failure(infrastructureError(error));

        return success((data ?? []).map((row) => row.user_id));
    }

    /** @inheritdoc */
    async findLogs(docsId: number): Promise<Result<DocsLogEntity[], CustomError>> {
        const { data, error } = await this.supabase
            .from('docs_logs')
            .select('*, users(*)')
            .eq('docs_id', docsId)
            .order('date', { ascending: false });

        if (error) return failure(infrastructureError(error));

        return success((data ?? []).map(toDocsLogEntity));
    }

    /** @inheritdoc */
    async findLogsByFilter(
        filter: DocsLogFilter,
    ): Promise<Result<{ data: DocsLogWithDocs[]; count: number }, CustomError>> {
        const { docsName, logType, from, to } = filter;

        let query = this.supabase
            .from('docs_logs')
            .select('*, docs(*), users(nickname)', { count: 'exact' })
            .order('date', { ascending: false });

        if (docsName && docsName !== 'all') {
            query = query.eq('docs.name', docsName) as typeof query;
        }

        if (logType !== 'all') {
            query = query.eq('type', logType) as typeof query;
        }

        query = query.range(from, to) as typeof query;

        const { data, count, error } = await query;

        if (error) return failure(infrastructureError(error));

        const mapped: DocsLogWithDocs[] = (data ?? []).map((row) => ({
            ...toDocsLogEntity(row),
            docsName: (row.docs as { name?: string } | null)?.name ?? '',
        }));

        return success({ data: mapped, count: count ?? 0 });
    }

    /** @inheritdoc */
    async saveLogs(logs: NewDocsLog[]): Promise<Result<void, CustomError>> {
        const insertData = logs.map((log) => ({
            docs_id: log.docsId,
            word: log.word,
            type: log.type,
            add_by: log.addBy,
        }));

        const { error } = await this.supabase.from('docs_logs').insert(insertData);

        if (error) return failure(infrastructureError(error));

        return success(undefined);
    }

    /** @inheritdoc */
    async deleteLogsByIds(ids: number[]): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.from('docs_logs').delete().in('id', ids);

        if (error) return failure(infrastructureError(error));

        return success(undefined);
    }

    /** @inheritdoc */
    async saveStar(docsId: number, userId: string): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase
            .from('user_star_docs')
            .insert({ docs_id: docsId, user_id: userId });

        if (error) return failure(infrastructureError(error));

        return success(undefined);
    }

    /** @inheritdoc */
    async deleteStar(docsId: number, userId: string): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase
            .from('user_star_docs')
            .delete()
            .eq('docs_id', docsId)
            .eq('user_id', userId);

        if (error) return failure(infrastructureError(error));

        return success(undefined);
    }

    /** @inheritdoc */
    async save(docs: NewDocs[]): Promise<Result<DocsEntity[], CustomError>> {
        const insertData = docs.map((doc) => ({
            name: doc.name,
            maker: doc.maker,
            duem: doc.duem,
            typez: doc.typez,
        }));

        const { data, error } = await this.supabase
            .from('docs')
            .insert(insertData)
            .select('*');

        if (error) return failure(infrastructureError(error));

        return success((data ?? []).map(toDocsEntity));
    }

    /** @inheritdoc */
    async updateLastUpdate(docsIds: number[]): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.rpc('update_last_updates', { docs_ids: docsIds });

        if (error) return failure(infrastructureError(error));

        return success(undefined);
    }

    /** @inheritdoc */
    async incrementView(id: number): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.rpc('increment_doc_views', { doc_id: id });

        if (error) return failure(infrastructureError(error));

        return success(undefined);
    }
}

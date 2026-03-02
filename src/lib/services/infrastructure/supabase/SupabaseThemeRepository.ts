import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import type { IThemeRepository } from '../../domain/word/ThemeRepository';
import type { CustomError } from '../../domain/result';
import type { Result } from '../../domain/result';
import type {
    ThemeEntity,
    WordThemeMapping,
    WordThemeResult,
    WordThemeRequest,
    ThemeRequestResult,
    WaitThemeInfo,
} from '../../domain/word/ThemeEntity';
import { success, failure } from '../../domain/result';
import { infrastructureError } from '../../domain/errors';

/**
 * Supabase 기반 IThemeRepository 구현체
 *
 * GetManager, AddManager, DeleteManager에서 themes, word_themes,
 * wait_word_themes, word_themes_wait 테이블 관련 쿼리를 추출하여 구현합니다.
 */
export class SupabaseThemeRepository implements IThemeRepository {
    constructor(private readonly supabase: SupabaseClient<Database>) {}

    /** @inheritdoc */
    async findAll(): Promise<Result<ThemeEntity[], CustomError>> {
        const { data, error } = await this.supabase.from('themes').select('*');

        if (error) return failure(infrastructureError(error));

        return success(
            (data ?? []).map((row) => ({
                id: row.id,
                name: row.name,
                code: row.code,
            }))
        );
    }

    /** @inheritdoc */
    async findByName(name: string): Promise<Result<ThemeEntity | null, CustomError>> {
        const { data, error } = await this.supabase
            .from('themes')
            .select('*')
            .eq('name', name)
            .maybeSingle();

        if (error) return failure(infrastructureError(error));

        if (!data) return success(null);

        return success({
            id: data.id,
            name: data.name,
            code: data.code,
        });
    }

    /** @inheritdoc */
    async findThemesByWordId(wordId: number): Promise<Result<WordThemeMapping[], CustomError>> {
        const { data, error } = await this.supabase
            .from('word_themes')
            .select('word_id,themes(*)')
            .eq('word_id', wordId);

        if (error) return failure(infrastructureError(error));

        return success(
            (data ?? []).map((row) => ({
                wordId: row.word_id,
                themeId: row.themes.id,
                themeName: row.themes.name,
                themeCode: row.themes.code,
            }))
        );
    }

    /** @inheritdoc */
    async findThemesByWordIds(wordIds: number[]): Promise<Result<WordThemeMapping[], CustomError>> {
        const { data, error } = await this.supabase
            .from('word_themes')
            .select('*,themes(*),words(*)')
            .in('word_id', wordIds);

        if (error) return failure(infrastructureError(error));

        return success(
            (data ?? []).map((row) => ({
                wordId: row.word_id,
                themeId: row.themes.id,
                themeName: row.themes.name,
                themeCode: row.themes.code,
            }))
        );
    }

    /** @inheritdoc */
    async findWaitWordThemes(waitWordId: number): Promise<Result<{ themeId: number; theme: ThemeEntity }[], CustomError>> {
        const { data, error } = await this.supabase
            .from('wait_word_themes')
            .select('*,themes(*)')
            .eq('wait_word_id', waitWordId);

        if (error) return failure(infrastructureError(error));

        return success(
            (data ?? []).map((row) => ({
                themeId: row.theme_id,
                theme: {
                    id: row.themes.id,
                    name: row.themes.name,
                    code: row.themes.code,
                },
            }))
        );
    }

    /** @inheritdoc */
    async findWaitWordThemesByIds(waitWordIds: number[]): Promise<Result<{ waitWordId: number; waitWord: string; theme: ThemeEntity }[], CustomError>> {
        const { data, error } = await this.supabase
            .from('wait_word_themes')
            .select('*,themes(*),wait_words(word)')
            .in('wait_word_id', waitWordIds);

        if (error) return failure(infrastructureError(error));

        return success(
            (data ?? []).map((row) => ({
                waitWordId: row.wait_word_id,
                waitWord: row.wait_words.word,
                theme: {
                    id: row.themes.id,
                    name: row.themes.name,
                    code: row.themes.code,
                },
            }))
        );
    }

    /** @inheritdoc */
    async saveWordThemes(data: { wordId: number; themeId: number }[]): Promise<Result<WordThemeResult[], CustomError>> {
        const insertData = data.map((d) => ({
            word_id: d.wordId,
            theme_id: d.themeId,
        }));

        const { data: result, error } = await this.supabase
            .from('word_themes')
            .upsert(insertData, { ignoreDuplicates: true, onConflict: 'word_id,theme_id' })
            .select('words(*),themes(*)');

        if (error) return failure(infrastructureError(error));

        return success(
            (result ?? []).map((row) => ({
                wordId: row.words.id,
                word: row.words.word,
                themeId: row.themes.id,
                themeName: row.themes.name,
            }))
        );
    }

    /** @inheritdoc */
    async deleteWordThemes(data: { wordId: number; themeId: number }[]): Promise<Result<void, CustomError>> {
        if (data.length === 0) return success(undefined);

        const pairs = data.map((d) => ({
            word_id: d.wordId,
            theme_id: d.themeId,
        }));

        const { error } = await this.supabase.rpc('delete_word_themes_bulk', {
            pairs: pairs as unknown as Database['public']['Functions']['delete_word_themes_bulk']['Args']['pairs'],
        });

        if (error) return failure(infrastructureError(error));

        return success(undefined);
    }

    /** @inheritdoc */
    async saveWaitWordThemes(data: { waitWordId: number; themeId: number }[]): Promise<Result<void, CustomError>> {
        const insertData = data.map((d) => ({
            wait_word_id: d.waitWordId,
            theme_id: d.themeId,
        }));

        const { error } = await this.supabase
            .from('wait_word_themes')
            .insert(insertData);

        if (error) return failure(infrastructureError(error));

        return success(undefined);
    }

    /** @inheritdoc */
    async saveWordThemeRequests(data: WordThemeRequest[]): Promise<Result<ThemeRequestResult[], CustomError>> {
        const insertData = data.map((d) => ({
            word_id: d.wordId,
            theme_id: d.themeId,
            typez: d.typez,
            req_by: d.reqBy,
        }));

        const { data: result, error } = await this.supabase
            .from('word_themes_wait')
            .upsert(insertData, { onConflict: 'word_id,theme_id', ignoreDuplicates: true })
            .select('themes(name), typez');

        if (error) return failure(infrastructureError(error));

        return success(
            (result ?? []).map((row) => ({
                themeName: row.themes.name,
                typez: row.typez,
            }))
        );
    }

    /** @inheritdoc */
    async findWaitThemesByWordId(wordId: number): Promise<Result<WaitThemeInfo[], CustomError>> {
        const { data, error } = await this.supabase
            .from('word_themes_wait')
            .select('themes(*), typez')
            .eq('word_id', wordId);

        if (error) return failure(infrastructureError(error));

        return success(
            (data ?? []).map((row) => ({
                wordId,
                word: '',
                theme: {
                    id: row.themes.id,
                    name: row.themes.name,
                    code: row.themes.code,
                },
                typez: row.typez,
                reqBy: null,
            }))
        );
    }

    /** @inheritdoc */
    async findAllWaitThemes(filter?: 'add' | 'delete'): Promise<Result<WaitThemeInfo[], CustomError>> {
        let query = this.supabase
            .from('word_themes_wait')
            .select('*,words(word,id),themes(*),users(*)');

        if (filter === 'add') {
            query = query.eq('typez', 'add');
        } else if (filter === 'delete') {
            query = query.eq('typez', 'delete');
        }

        const { data, error } = await query;

        if (error) return failure(infrastructureError(error));

        return success(
            (data ?? []).map((row) => ({
                wordId: row.word_id,
                word: row.words.word,
                theme: {
                    id: row.themes.id,
                    name: row.themes.name,
                    code: row.themes.code,
                },
                typez: row.typez,
                reqBy: row.req_by,
            }))
        );
    }

    /** @inheritdoc */
    async deleteWaitThemesByWordIds(wordIds: number[]): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase
            .from('word_themes_wait')
            .delete()
            .in('word_id', wordIds);

        if (error) return failure(infrastructureError(error));

        return success(undefined);
    }
}

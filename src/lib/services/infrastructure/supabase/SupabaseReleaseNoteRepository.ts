import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import type { IReleaseNoteRepository } from '../../domain/release-note/ReleaseNoteRepository';
import type { ReleaseNoteEntity } from '../../domain/release-note/ReleaseNoteEntity';
import type { Result, CustomError } from '../../domain/result';
import { success, failure } from '../../domain/result';
import { infrastructureError } from '../../domain/errors';

/**
 * Supabase 기반 IReleaseNoteRepository 구현체
 */
export class SupabaseReleaseNoteRepository implements IReleaseNoteRepository {
    constructor(private readonly supabase: SupabaseClient<Database>) {}

    /** @inheritdoc */
    async findAll(): Promise<Result<ReleaseNoteEntity[], CustomError>> {
        const { data, error } = await this.supabase
            .from('release_note')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) return failure(infrastructureError(error));
        return success(
            (data ?? []).map((row) => ({
                id: row.id,
                title: row.title,
                content: row.content,
                createdAt: row.created_at,
                link: row.link ?? null,
            }))
        );
    }
}

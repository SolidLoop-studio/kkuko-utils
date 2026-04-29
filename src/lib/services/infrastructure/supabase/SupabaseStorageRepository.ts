import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import type { IStorageRepository } from '../../domain/notification/NotificationRepository';
import type { Result, CustomError } from '../../domain/result';
import { success, failure } from '../../domain/result';
import { infrastructureError } from '../../domain/errors';

const BUCKET = 'public_img';

export class SupabaseStorageRepository implements IStorageRepository {
    constructor(private readonly supabase: SupabaseClient<Database>) {}

    async uploadImage(file: File, path: string): Promise<Result<string, CustomError>> {
        const { error } = await this.supabase.storage
            .from(BUCKET)
            .upload(path, file, { cacheControl: '3600', upsert: false });
        if (error) return failure(infrastructureError({ message: error.message }));
        return success(this.getPublicUrl(path));
    }

    async deleteImage(path: string): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.storage.from(BUCKET).remove([path]);
        if (error) return failure(infrastructureError({ message: error.message }));
        return success(undefined);
    }

    getPublicUrl(path: string): string {
        return this.supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import type { INotificationRepository } from '../../domain/notification/NotificationRepository';
import type { Result, CustomError } from '../../domain/result';
import type { NotificationEntity, NewNotification, UpdateNotification } from '../../domain/notification/NotificationEntity';
import { success, failure } from '../../domain/result';
import { infrastructureError } from '../../domain/errors';

type NotificationRow = Database['public']['Tables']['notification']['Row'];

function toNotificationEntity(row: NotificationRow): NotificationEntity {
    return {
        id: row.id,
        title: row.title,
        body: row.body,
        img: row.img,
        endAt: row.end_at,
        isImportant: row.is_important,
        isModal: row.is_modal,
        createdAt: row.created_at,
    };
}

export class SupabaseNotificationRepository implements INotificationRepository {
    constructor(private readonly supabase: SupabaseClient<Database>) {}

    async findAll(): Promise<Result<NotificationEntity[], CustomError>> {
        const { data, error } = await this.supabase
            .from('notification')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) return failure(infrastructureError(error));
        return success((data ?? []).map(toNotificationEntity));
    }

    async findById(id: number): Promise<Result<NotificationEntity | null, CustomError>> {
        const { data, error } = await this.supabase
            .from('notification')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error) return failure(infrastructureError(error));
        return success(data ? toNotificationEntity(data) : null);
    }

    async findActiveModal(): Promise<Result<NotificationEntity | null, CustomError>> {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const { data, error } = await this.supabase
            .from('notification')
            .select('*')
            .gte('end_at', today.toISOString())
            .eq('is_modal', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) return failure(infrastructureError(error));
        return success(data ? toNotificationEntity(data) : null);
    }

    async save(data: NewNotification): Promise<Result<NotificationEntity, CustomError>> {
        const { data: row, error } = await this.supabase
            .from('notification')
            .insert({
                title: data.title,
                body: data.body,
                img: data.img ?? null,
                end_at: data.endAt,
                is_important: data.isImportant ?? false,
                is_modal: data.isModal ?? false,
            })
            .select('*')
            .single();
        if (error) return failure(infrastructureError(error));
        return success(toNotificationEntity(row));
    }

    async update(id: number, data: UpdateNotification): Promise<Result<NotificationEntity, CustomError>> {
        const { data: row, error } = await this.supabase
            .from('notification')
            .update({
                ...(data.title !== undefined && { title: data.title }),
                ...(data.body !== undefined && { body: data.body }),
                ...(data.img !== undefined && { img: data.img }),
                end_at: data.endAt,
                ...(data.isImportant !== undefined && { is_important: data.isImportant }),
                ...(data.isModal !== undefined && { is_modal: data.isModal }),
            })
            .eq('id', id)
            .select('*')
            .single();
        if (error) return failure(infrastructureError(error));
        return success(toNotificationEntity(row));
    }

    async deleteById(id: number): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.from('notification').delete().eq('id', id);
        if (error) return failure(infrastructureError(error));
        return success(undefined);
    }
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import { SupabaseReleaseNoteRepository } from './infrastructure/supabase/SupabaseReleaseNoteRepository';
import { ReleaseNoteService } from './application/release-note/ReleaseNoteService';

export class ReleaseNoteServiceContainer {
    public readonly service: ReleaseNoteService;

    constructor(supabase: SupabaseClient<Database>) {
        this.service = new ReleaseNoteService(new SupabaseReleaseNoteRepository(supabase));
    }
}

export function createReleaseNoteServiceContainer(
    supabase: SupabaseClient<Database>
): ReleaseNoteServiceContainer {
    return new ReleaseNoteServiceContainer(supabase);
}

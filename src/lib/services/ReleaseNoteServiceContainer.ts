import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import { SupabaseReleaseNoteRepository } from './infrastructure/supabase/SupabaseReleaseNoteRepository';
import { ReleaseNoteService } from './application/release-note/ReleaseNoteService';

/**
 * ReleaseNote 서비스 컨테이너
/**
 * ReleaseNoteServiceContainer 팩토리
 *
 * @param supabase - Supabase 클라이언트
 * @returns ReleaseNoteServiceContainer 인스턴스
 */
    constructor(supabase: SupabaseClient<Database>) {
        this.service = new ReleaseNoteService(new SupabaseReleaseNoteRepository(supabase));
    }
}

/**
 * ReleaseNoteServiceContainer 팩토리
 *
     * @param supabase - Supabase 클라이언트
 * @returns ReleaseNoteServiceContainer 인스턴스
 */
export function createReleaseNoteServiceContainer(
    supabase: SupabaseClient<Database>
): ReleaseNoteServiceContainer {
    return new ReleaseNoteServiceContainer(supabase);
}

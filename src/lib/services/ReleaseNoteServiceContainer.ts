import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import { SupabaseReleaseNoteRepository } from './infrastructure/supabase/SupabaseReleaseNoteRepository';
import { ReleaseNoteService } from './application/release-note/ReleaseNoteService';

/**
 * ReleaseNote 서비스 컨테이너
 *
 * Supabase 기반 릴리즈 노트 리포지토리를 구성하고 ReleaseNoteService를 제공합니다.
 */
export class ReleaseNoteServiceContainer {
    public readonly service: ReleaseNoteService;

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

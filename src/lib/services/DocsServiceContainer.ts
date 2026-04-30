import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import { SupabaseDocsRepository } from './infrastructure/supabase/SupabaseDocsRepository';
import { SupabaseWaitDocsRepository } from './infrastructure/supabase/SupabaseWaitDocsRepository';
import { DocsQueryService } from './application/docs/DocsQueryService';
import { DocsCommandService } from './application/docs/DocsCommandService';
import type { IDocsRepository } from './domain/docs/DocsRepository';
import type { IWaitDocsRepository } from './domain/docs/WaitDocsRepository';
import type { LogService } from './application/log/LogService';
import { createLogServiceContainer } from './LogServiceContainer';

/**
 * Docs 도메인 서비스 컨테이너
 *
 * Supabase 클라이언트를 받아 Docs 도메인의 모든 서비스 인스턴스를 생성합니다.
 * Strangler Fig 패턴에 따라 기존 SCM과 공존하며 점진적으로 이관합니다.
 */
export class DocsServiceContainer {
    public readonly docsRepo: IDocsRepository;
    public readonly waitDocsRepo: IWaitDocsRepository;
    public readonly queryService: DocsQueryService;
    public readonly commandService: DocsCommandService;

    constructor(supabase: SupabaseClient<Database>, logService: LogService) {
        this.docsRepo = new SupabaseDocsRepository(supabase);
        this.waitDocsRepo = new SupabaseWaitDocsRepository(supabase);
        this.queryService = new DocsQueryService(this.docsRepo, this.waitDocsRepo);
        this.commandService = new DocsCommandService(this.docsRepo, this.waitDocsRepo, logService);
    }
}

/**
 * Supabase 클라이언트로 Docs 서비스 컨테이너를 생성합니다.
 *
 * @param supabase - Supabase 클라이언트
 * @param logService - 선택적으로 주입할 LogService 인스턴스. 생략 시 내부에서 생성합니다.
 * @returns 초기화된 DocsServiceContainer
 */
export function createDocsServiceContainer(
    supabase: SupabaseClient<Database>,
    logService?: LogService
): DocsServiceContainer {
    const logSvc = logService ?? createLogServiceContainer(supabase).service;
    return new DocsServiceContainer(supabase, logSvc);
}

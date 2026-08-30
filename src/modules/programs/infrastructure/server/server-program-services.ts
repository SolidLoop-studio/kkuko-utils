import { createServiceSupabaseClient } from '@/src/shared/infrastructure/supabase/service-client';
import { GetProgramsService } from '../../application/get-programs';
import { GithubProgramReleaseGateway } from './github-program-release-gateway';
import { SupabaseProgramQueryGateway, type SupabaseProgramQueryClient } from './supabase-program-query-gateway';

export interface ServerProgramsServices { programsService: GetProgramsService; }

/** 요청이 처리될 때에만 service-role Supabase client를 생성합니다. */
export const createServerProgramsServices = (): ServerProgramsServices => ({
    programsService: new GetProgramsService(
        new SupabaseProgramQueryGateway(createServiceSupabaseClient() as unknown as SupabaseProgramQueryClient),
        new GithubProgramReleaseGateway(),
    ),
});

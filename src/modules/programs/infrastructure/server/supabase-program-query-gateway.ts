import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { ProgramQueryGateway } from '../../application/program-query-ports';
import type { ProgramCategory, ProgramQuery } from '../../application/program-query-types';

type SupabaseResponse = { data: unknown; error: unknown };

export interface SupabaseProgramQueryClient {
    from(table: 'programs'): {
        select(columns: string): PromiseLike<SupabaseResponse> & {
            eq(column: 'category' | 'id', value: string | number): PromiseLike<SupabaseResponse> & {
                single(): Promise<SupabaseResponse>;
            };
            single(): Promise<SupabaseResponse>;
        };
    };
}

const PROGRAM_COLUMNS = 'id, name, description, github_repo, category, tags, is_active, created_at, readme_path';

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '프로그램 정보를 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isNonBlankString = (value: unknown): value is string => (
    typeof value === 'string' && value.trim().length > 0
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

const isCategory = (value: unknown): value is Exclude<ProgramCategory, 'all'> => (
    value === 'tool' || value === 'util' || value === 'other'
);

const parseProgram = (value: unknown): ProgramQuery | null => {
    if (!isRecord(value)
        || !isPositiveSafeInteger(value.id)
        || !isNonBlankString(value.name)
        || !isNonBlankString(value.description)
        || !isNonBlankString(value.github_repo)
        || !isCategory(value.category)
        || !Array.isArray(value.tags) || !value.tags.every(isNonBlankString)
        || typeof value.is_active !== 'boolean'
        || !isNonBlankString(value.created_at)
        || !isNonBlankString(value.readme_path)) return null;

    return {
        id: value.id,
        name: value.name,
        description: value.description,
        githubRepo: value.github_repo,
        category: value.category,
        tags: value.tags,
        isActive: value.is_active,
        createdAt: value.created_at,
        readmePath: value.readme_path,
    };
};

/** Supabase programs 테이블 행을 애플리케이션 projection으로 안전하게 변환합니다. */
export class SupabaseProgramQueryGateway implements ProgramQueryGateway {
    constructor(private readonly client: SupabaseProgramQueryClient) {}

    async list(category: ProgramCategory): Promise<Result<ProgramQuery[]>> {
        try {
            const query = this.client.from('programs').select(PROGRAM_COLUMNS);
            const response = await (category === 'all' ? query : query.eq('category', category));
            if (!isRecord(response) || response.error !== null || !Array.isArray(response.data)) {
                return err(infrastructureError());
            }
            const programs = response.data.map(parseProgram);
            return programs.some((program) => program === null)
                ? err(infrastructureError())
                : ok(programs as ProgramQuery[]);
        } catch {
            return err(infrastructureError());
        }
    }

    async findById(id: number): Promise<Result<ProgramQuery | null>> {
        try {
            const response = await this.client.from('programs').select(PROGRAM_COLUMNS).eq('id', id).single();
            if (!isRecord(response)) return err(infrastructureError());
            if (response.error !== null) {
                return isRecord(response.error) && response.error.code === 'PGRST116'
                    ? ok(null)
                    : err(infrastructureError());
            }
            const program = parseProgram(response.data);
            return program === null ? err(infrastructureError()) : ok(program);
        } catch {
            return err(infrastructureError());
        }
    }
}

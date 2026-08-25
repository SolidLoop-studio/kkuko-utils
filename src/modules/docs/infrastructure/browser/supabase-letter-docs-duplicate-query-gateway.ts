import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { LetterDocsDuplicateQueryGateway } from '../../application/letter-docs-duplicate-query-ports';

interface LetterDocsDuplicateQueryBuilder extends PromiseLike<unknown> {
    select(columns: string): LetterDocsDuplicateQueryBuilder;
    eq(column: string, value: unknown): LetterDocsDuplicateQueryBuilder;
    limit(count: number): LetterDocsDuplicateQueryBuilder;
}

interface LetterDocsDuplicateQueryClient {
    from(table: 'docs'): LetterDocsDuplicateQueryBuilder;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isDocsIdRow = (value: unknown): value is { id: number } => (
    isRecord(value)
    && typeof value.id === 'number'
    && Number.isSafeInteger(value.id)
    && value.id > 0
);

/** Supabase 문서 행의 존재 여부를 글자 문서 중복 조회 결과로 변환합니다. */
export class SupabaseLetterDocsDuplicateQueryGateway implements LetterDocsDuplicateQueryGateway {
    constructor(
        private readonly client: LetterDocsDuplicateQueryClient = browserSupabaseClient as unknown as LetterDocsDuplicateQueryClient,
    ) {}

    async existsByName(docsName: string): Promise<Result<boolean>> {
        let response: unknown;
        try {
            response = await this.client
                .from('docs')
                .select('id')
                .eq('typez', 'letter')
                .eq('name', docsName)
                .limit(1);
        } catch {
            return err(infrastructureError());
        }

        if (!isRecord(response)
            || response.error !== null
            || !Array.isArray(response.data)) {
            return err(infrastructureError());
        }

        if (response.data.length === 0) {
            return ok(false);
        }

        if (response.data.length !== 1 || !isDocsIdRow(response.data[0])) {
            return err(infrastructureError());
        }

        return ok(true);
    }
}

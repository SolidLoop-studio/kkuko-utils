import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { NicknameQueryGateway } from '../../application/nickname-ports';

interface QueryResponse {
    data?: unknown;
    error?: unknown;
}

interface NicknameQueryBuilder {
    select(columns: string): {
        eq(column: string, value: string): PromiseLike<QueryResponse>;
    };
}

interface NicknameQueryClient {
    from(table: 'users'): NicknameQueryBuilder;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '닉네임 확인 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isValidRows = (value: unknown): value is Array<{ id: string }> => (
    Array.isArray(value)
    && value.length <= 1
    && value.every((row) => isRecord(row) && typeof row.id === 'string' && row.id.length > 0)
);

/** users의 unique nickname을 최소 필드로 조회하고 응답 모양을 검증합니다. */
export class SupabaseNicknameQueryGateway implements NicknameQueryGateway {
    constructor(
        private readonly client: NicknameQueryClient = (
            browserSupabaseClient as unknown as NicknameQueryClient
        ),
    ) {}

    async isAvailable(nickname: string): Promise<Result<boolean>> {
        try {
            const response = await this.client
                .from('users')
                .select('id')
                .eq('nickname', nickname);
            if (!isRecord(response) || response.error !== null || !isValidRows(response.data)) {
                return err(infrastructureError());
            }
            return ok(response.data.length === 0);
        } catch {
            return err(infrastructureError());
        }
    }
}

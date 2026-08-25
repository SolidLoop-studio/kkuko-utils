import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { DocsCreationRequestGateway } from '../../application/docs-creation-request-ports';
import type { DocsCreationRequestCommand } from '../../application/docs-creation-request-types';

interface DocsCreationRequestBuilder extends PromiseLike<unknown> {
    insert(row: { docs_name: string; req_by: string }): DocsCreationRequestBuilder;
}

interface DocsCreationRequestClient {
    from(table: 'docs_wait'): DocsCreationRequestBuilder;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

/** Supabase의 대기 문서 요청 행과 문서 생성 요청 command를 연결합니다. */
export class SupabaseDocsCreationRequestGateway implements DocsCreationRequestGateway {
    constructor(
        private readonly client: DocsCreationRequestClient = browserSupabaseClient as unknown as DocsCreationRequestClient,
    ) {}

    async request(command: DocsCreationRequestCommand): Promise<Result<void>> {
        let response: unknown;
        try {
            response = await this.client.from('docs_wait').insert({
                docs_name: command.docsName,
                req_by: command.requesterId,
            });
        } catch {
            return err(infrastructureError());
        }

        return isRecord(response) && response.error === null
            ? ok(undefined)
            : err(infrastructureError());
    }
}

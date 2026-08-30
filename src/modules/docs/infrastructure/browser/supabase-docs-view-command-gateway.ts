import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { DocsViewCommandGateway } from '../../application/docs-view-command-ports';

interface DocsViewCommandClient {
    rpc(
        name: 'increment_doc_views',
        args: { doc_id: number },
    ): Promise<unknown>;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '문서 조회 수 기록에 실패했습니다. 잠시 후 다시 시도해주세요.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

/** Supabase 조회 수 증가 RPC를 문서 조회 명령 gateway로 연결합니다. */
export class SupabaseDocsViewCommandGateway implements DocsViewCommandGateway {
    constructor(
        private readonly client: DocsViewCommandClient = browserSupabaseClient as unknown as DocsViewCommandClient,
    ) {}

    async record(docsId: number): Promise<Result<void>> {
        let response: unknown;
        try {
            response = await this.client.rpc('increment_doc_views', { doc_id: docsId });
        } catch {
            return err(infrastructureError());
        }

        return isRecord(response) && response.error === null
            ? ok(undefined)
            : err(infrastructureError());
    }
}

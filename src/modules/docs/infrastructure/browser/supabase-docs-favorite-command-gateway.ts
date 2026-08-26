import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type {
    DocsFavoriteCommandGateway,
    SetDocsFavoriteCommand,
} from '../../application/docs-favorite-command-ports';

type RpcError = {
    code?: string | null;
    message: string;
};

interface DocsFavoriteCommandClient {
    rpc(
        name: 'set_docs_favorite',
        args: { p_docs_id: number; p_is_starred: boolean },
    ): Promise<unknown>;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '문서 즐겨찾기 설정에 실패했습니다. 잠시 후 다시 시도해주세요.',
});

const publicErrors = {
    DOCS_FAVORITE_UNAUTHORIZED: {
        kind: 'unauthorized',
        message: '인증이 필요합니다.',
    },
    DOCS_FAVORITE_NOT_FOUND: {
        kind: 'not-found',
        message: '문서를 찾을 수 없습니다.',
    },
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const hasOwn = (value: Record<string, unknown>, key: string): boolean => (
    Object.prototype.hasOwnProperty.call(value, key)
);

const isRpcError = (value: unknown): value is RpcError => (
    isRecord(value)
    && hasOwn(value, 'message')
    && typeof value.message === 'string'
    && (!hasOwn(value, 'code') || value.code === null || typeof value.code === 'string')
);

const mapError = (error: RpcError): ApplicationError => {
    const publicError = publicErrors[error.message as keyof typeof publicErrors];
    if (publicError !== undefined) {
        return { ...publicError };
    }
    return infrastructureError();
};

/** 인증된 사용자의 Supabase 즐겨찾기 RPC를 문서 command gateway로 연결합니다. */
export class SupabaseDocsFavoriteCommandGateway implements DocsFavoriteCommandGateway {
    constructor(
        private readonly client: DocsFavoriteCommandClient = browserSupabaseClient as unknown as DocsFavoriteCommandClient,
    ) {}

    async set(command: SetDocsFavoriteCommand): Promise<Result<void>> {
        let response: unknown;
        try {
            response = await this.client.rpc('set_docs_favorite', {
                p_docs_id: command.docsId,
                p_is_starred: command.isStarred,
            });
        } catch {
            return err(infrastructureError());
        }

        if (!isRecord(response) || !hasOwn(response, 'data') || !hasOwn(response, 'error')) {
            return err(infrastructureError());
        }
        if (response.error !== null && !isRpcError(response.error)) {
            return err(infrastructureError());
        }
        if (isRpcError(response.error)) {
            return err(mapError(response.error));
        }
        return ok(undefined);
    }
}

import type { WordRequestModerationGateway } from '../../application/ports';
import type {
    ModerateWordRequestsCommand,
    WordRequestModerationResult,
} from '../../application/word-request-moderation-types';
import type { ApplicationError } from '../../../../shared/application/application-error';
import { err, ok, type Result } from '../../../../shared/application/result';
import { browserSupabaseClient } from '../../../../shared/infrastructure/supabase/browser-client';
import { mapSupabaseError } from '../../../../shared/infrastructure/supabase/map-supabase-error';

type RpcError = {
    code?: string | null;
    message: string;
};

type RpcResponse = {
    data: unknown;
    error: RpcError | null;
};

interface WordRequestModerationRpcClient {
    rpc(functionName: string, args: Record<string, unknown>): Promise<RpcResponse>;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '데이터 처리 중 오류가 발생했습니다.',
});

const wordRequestModerationErrors = {
    UNAUTHORIZED: {
        kind: 'unauthorized',
        message: '인증이 필요합니다.',
    },
    FORBIDDEN: {
        kind: 'forbidden',
        message: '권한이 없습니다.',
    },
    INVALID_INPUT: {
        kind: 'validation',
        message: '입력값이 올바르지 않습니다.',
    },
    CONFLICT: {
        kind: 'conflict',
        message: '요청이 이미 처리되었거나 충돌이 발생했습니다.',
    },
} as const;

const mapWordRequestModerationError = (error: RpcError): ApplicationError => {
    const sharedError = mapSupabaseError(error);
    if (sharedError.kind !== 'infrastructure') {
        return sharedError;
    }

    const mappedError = wordRequestModerationErrors[
        error.message as keyof typeof wordRequestModerationErrors
    ];
    if (mappedError) {
        return {
            ...mappedError,
            code: error.code ?? undefined,
        };
    }

    return {
        ...infrastructureError(),
        code: error.code ?? undefined,
    };
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isNonNegativeSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

const parseWordRequestModerationResult = (value: unknown): WordRequestModerationResult | null => {
    if (!isRecord(value)
        || !isNonNegativeSafeInteger(value.processedWordRequestCount)
        || !isNonNegativeSafeInteger(value.processedThemeChangeCount)
        || !Array.isArray(value.affectedDocsIds)
        || !value.affectedDocsIds.every(isPositiveSafeInteger)) {
        return null;
    }

    const affectedDocsIds = value.affectedDocsIds;
    if (new Set(affectedDocsIds).size !== affectedDocsIds.length) {
        return null;
    }

    return {
        processedWordRequestCount: value.processedWordRequestCount,
        processedThemeChangeCount: value.processedThemeChangeCount,
        affectedDocsIds: [...affectedDocsIds].sort((left, right) => left - right),
    };
};

/** 브라우저 단어 요청 조정 RPC와 Application DTO를 연결한다. */
export class SupabaseWordRequestModerationGateway implements WordRequestModerationGateway {
    constructor(
        private readonly rpcClient: WordRequestModerationRpcClient = browserSupabaseClient as unknown as WordRequestModerationRpcClient,
    ) {}

    approve(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>> {
        return this.moderate('approve_word_requests', command);
    }

    reject(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>> {
        return this.moderate('reject_word_requests', command);
    }

    private async moderate(
        functionName: string,
        command: ModerateWordRequestsCommand,
    ): Promise<Result<WordRequestModerationResult>> {
        let response: RpcResponse;
        try {
            response = await this.rpcClient.rpc(functionName, { p_selections: command.selections });
        } catch {
            return err(infrastructureError());
        }

        if (response.error) {
            return err(mapWordRequestModerationError(response.error));
        }

        const result = parseWordRequestModerationResult(response.data);
        return result === null ? err(infrastructureError()) : ok(result);
    }
}

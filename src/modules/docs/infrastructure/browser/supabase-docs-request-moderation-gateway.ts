import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import { mapSupabaseError } from '@/src/shared/infrastructure/supabase/map-supabase-error';
import type { DocsRequestModerationGateway } from '../../application/docs-request-moderation-ports';
import type {
    ApproveDocsRequestsCommand,
    DocsRequestModerationResult,
    RejectDocsRequestsCommand,
} from '../../application/docs-request-moderation-types';

type RpcError = {
    code?: string | null;
    message: string;
};

type RpcResponse = {
    data: unknown;
    error: RpcError | null;
};

interface DocsRequestModerationRpcClient {
    rpc(functionName: string, args: Record<string, unknown>): Promise<RpcResponse>;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '데이터 처리 중 오류가 발생했습니다.',
});

const docsRequestModerationErrors = {
    DOCS_REQUEST_MODERATION_UNAUTHORIZED: {
        kind: 'unauthorized',
        message: '인증이 필요합니다.',
    },
    DOCS_REQUEST_MODERATION_FORBIDDEN: {
        kind: 'forbidden',
        message: '권한이 없습니다.',
    },
    DOCS_REQUEST_MODERATION_INVALID_INPUT: {
        kind: 'validation',
        message: '입력값이 올바르지 않습니다.',
    },
    DOCS_REQUEST_MODERATION_CONFLICT: {
        kind: 'conflict',
        message: '요청이 이미 처리되었거나 충돌이 발생했습니다.',
    },
    DOCS_REQUEST_MODERATION_INTERNAL_ERROR: infrastructureError(),
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

const isNonNegativeSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
);

const isRpcError = (value: unknown): value is RpcError => (
    isRecord(value)
    && typeof value.message === 'string'
    && (value.code === undefined || value.code === null || typeof value.code === 'string')
);

const parseDocsRequestModerationResult = (
    value: unknown,
    expectedRequestIds: number[],
): DocsRequestModerationResult | null => {
    if (!isRecord(value)
        || !isNonNegativeSafeInteger(value.processedRequestCount)
        || !Array.isArray(value.processedRequestIds)
        || !value.processedRequestIds.every(isPositiveSafeInteger)) {
        return null;
    }

    const processedRequestIds = [...value.processedRequestIds].sort((left, right) => left - right);
    const sortedExpectedRequestIds = [...expectedRequestIds].sort((left, right) => left - right);
    if (processedRequestIds.length !== value.processedRequestCount
        || new Set(processedRequestIds).size !== processedRequestIds.length
        || processedRequestIds.length !== sortedExpectedRequestIds.length
        || !processedRequestIds.every((requestId, index) => (
            requestId === sortedExpectedRequestIds[index]
        ))) {
        return null;
    }

    return {
        processedRequestIds,
        processedRequestCount: value.processedRequestCount,
    };
};

const mapDocsRequestModerationError = (error: RpcError): ApplicationError => {
    const mappedError = docsRequestModerationErrors[
        error.message as keyof typeof docsRequestModerationErrors
    ];
    if (mappedError) {
        return { ...mappedError, code: error.code ?? undefined };
    }

    const sharedError = mapSupabaseError(error);
    return { ...infrastructureError(), code: sharedError.code };
};

/** 브라우저 문서 요청 조정 RPC와 Application DTO를 연결한다. */
export class SupabaseDocsRequestModerationGateway implements DocsRequestModerationGateway {
    constructor(
        private readonly rpcClient: DocsRequestModerationRpcClient = browserSupabaseClient as unknown as DocsRequestModerationRpcClient,
    ) {}

    approve(command: ApproveDocsRequestsCommand): Promise<Result<DocsRequestModerationResult>> {
        return this.moderate(
            'approve_docs_requests',
            { p_selections: command.selections },
            command.selections.map(({ requestId }) => requestId),
        );
    }

    reject(command: RejectDocsRequestsCommand): Promise<Result<DocsRequestModerationResult>> {
        return this.moderate(
            'reject_docs_requests',
            { p_request_ids: command.requestIds },
            command.requestIds,
        );
    }

    private async moderate(
        functionName: string,
        args: Record<string, unknown>,
        expectedRequestIds: number[],
    ): Promise<Result<DocsRequestModerationResult>> {
        let response: unknown;
        try {
            response = await this.rpcClient.rpc(functionName, args);
        } catch {
            return err(infrastructureError());
        }

        if (!isRecord(response)) {
            return err(infrastructureError());
        }

        if (response.error !== null && !isRpcError(response.error)) {
            return err(infrastructureError());
        }

        if (isRpcError(response.error)) {
            return err(mapDocsRequestModerationError(response.error));
        }

        const result = parseDocsRequestModerationResult(response.data, expectedRequestIds);
        return result === null ? err(infrastructureError()) : ok(result);
    }
}

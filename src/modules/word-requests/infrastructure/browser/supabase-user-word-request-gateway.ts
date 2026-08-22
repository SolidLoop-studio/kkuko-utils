import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { UserWordRequestGateway } from '../../application/user-word-request-ports';
import type {
    UserWordRequestCommand,
    UserWordRequestResult,
} from '../../application/user-word-request-types';

type RpcError = {
    code?: string | null;
    message: string;
};

type RpcResponse = {
    data: unknown;
    error: RpcError | null;
};

interface UserWordRequestRpcClient {
    rpc(functionName: string, args: Record<string, unknown>): Promise<RpcResponse>;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '데이터 처리 중 오류가 발생했습니다.',
});

const errorKinds = {
    WORD_REQUEST_UNAUTHORIZED: 'unauthorized',
    WORD_REQUEST_INVALID_INPUT: 'validation',
    WORD_REQUEST_NOT_FOUND: 'not-found',
    WORD_REQUEST_CONFLICT: 'conflict',
    WORD_REQUEST_FORBIDDEN: 'forbidden',
    WORD_REQUEST_INTERNAL_ERROR: 'infrastructure',
} as const;

const errorMessages: Record<keyof typeof errorKinds, string> = {
    WORD_REQUEST_UNAUTHORIZED: '인증이 필요합니다.',
    WORD_REQUEST_INVALID_INPUT: '입력값이 올바르지 않습니다.',
    WORD_REQUEST_NOT_FOUND: '요청한 데이터를 찾을 수 없습니다.',
    WORD_REQUEST_CONFLICT: '요청이 이미 처리되었거나 충돌이 발생했습니다.',
    WORD_REQUEST_FORBIDDEN: '권한이 없습니다.',
    WORD_REQUEST_INTERNAL_ERROR: '데이터 처리 중 오류가 발생했습니다.',
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

const isRpcError = (value: unknown): value is RpcError => (
    isRecord(value)
    && typeof value.message === 'string'
    && (value.code === undefined || value.code === null || typeof value.code === 'string')
);

const parseUserWordRequestResult = (
    value: unknown,
    expectedWord: string,
): UserWordRequestResult | null => {
    if (!isRecord(value)
        || !isPositiveSafeInteger(value.requestId)
        || value.word !== expectedWord
        || (value.requestType !== 'add' && value.requestType !== 'delete')) {
        return null;
    }

    return {
        requestId: value.requestId,
        word: value.word,
        requestType: value.requestType,
    };
};

const mapUserWordRequestError = (error: RpcError): ApplicationError => {
    const publicErrorCode = error.message as keyof typeof errorKinds;
    if (publicErrorCode in errorKinds) {
        return {
            kind: errorKinds[publicErrorCode],
            message: errorMessages[publicErrorCode],
            code: error.code ?? undefined,
        };
    }

    return { ...infrastructureError(), code: error.code ?? undefined };
};

/** 브라우저 사용자 단어 요청 RPC와 Application DTO를 연결한다. */
export class SupabaseUserWordRequestGateway implements UserWordRequestGateway {
    constructor(
        private readonly rpcClient: UserWordRequestRpcClient = browserSupabaseClient as unknown as UserWordRequestRpcClient,
    ) {}

    requestDeletion(command: UserWordRequestCommand): Promise<Result<UserWordRequestResult>> {
        return this.request('request_word_deletion', command);
    }

    cancel(command: UserWordRequestCommand): Promise<Result<UserWordRequestResult>> {
        return this.request('cancel_word_request', command);
    }

    private async request(
        functionName: string,
        command: UserWordRequestCommand,
    ): Promise<Result<UserWordRequestResult>> {
        let response: unknown;
        try {
            response = await this.rpcClient.rpc(functionName, { p_word: command.word });
        } catch {
            return err(infrastructureError());
        }

        if (!isRecord(response) || !('error' in response) || !('data' in response)) {
            return err(infrastructureError());
        }

        if (response.error !== null && !isRpcError(response.error)) {
            return err(infrastructureError());
        }

        if (isRpcError(response.error)) {
            return err(mapUserWordRequestError(response.error));
        }

        const result = parseUserWordRequestResult(response.data, command.word);
        return result === null ? err(infrastructureError()) : ok(result);
    }
}

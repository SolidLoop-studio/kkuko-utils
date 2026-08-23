import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { UserWordRequestGateway } from '../../application/user-word-request-ports';
import type {
    RequestWordAdditionCommand,
    RequestWordAdditionResult,
    RequestWordAdditionsCommand,
    RequestWordAdditionsProgressListener,
    RequestWordAdditionsResult,
    RequestedWordAdditionTheme,
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
    WORD_REQUEST_ALREADY_REGISTERED: 'conflict',
    WORD_REQUEST_INVALID_THEME: 'validation',
    WORD_ADDITION_BATCH_UNAUTHORIZED: 'unauthorized',
    WORD_ADDITION_BATCH_INVALID_INPUT: 'validation',
    WORD_ADDITION_BATCH_INVALID_THEME: 'validation',
    WORD_ADDITION_BATCH_CONFLICT: 'conflict',
    WORD_ADDITION_BATCH_INTERNAL_ERROR: 'infrastructure',
} as const;

const errorMessages: Record<keyof typeof errorKinds, string> = {
    WORD_REQUEST_UNAUTHORIZED: '인증이 필요합니다.',
    WORD_REQUEST_INVALID_INPUT: '입력값이 올바르지 않습니다.',
    WORD_REQUEST_NOT_FOUND: '요청한 데이터를 찾을 수 없습니다.',
    WORD_REQUEST_CONFLICT: '요청이 이미 처리되었거나 충돌이 발생했습니다.',
    WORD_REQUEST_FORBIDDEN: '권한이 없습니다.',
    WORD_REQUEST_INTERNAL_ERROR: '데이터 처리 중 오류가 발생했습니다.',
    WORD_REQUEST_ALREADY_REGISTERED: '이미 존재하는 단어입니다.',
    WORD_REQUEST_INVALID_THEME: '선택한 주제 정보를 확인할 수 없습니다.',
    WORD_ADDITION_BATCH_UNAUTHORIZED: '인증이 필요합니다.',
    WORD_ADDITION_BATCH_INVALID_INPUT: '대량 요청 입력값이 올바르지 않습니다.',
    WORD_ADDITION_BATCH_INVALID_THEME: '선택한 주제 정보를 확인할 수 없습니다.',
    WORD_ADDITION_BATCH_CONFLICT: '대량 요청 처리 중 충돌이 발생했습니다. 다시 시도해 주세요.',
    WORD_ADDITION_BATCH_INTERNAL_ERROR: '데이터 처리 중 오류가 발생했습니다.',
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

const isNonNegativeSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
);

const ADDITION_BATCH_SIZE = 300;

const isNonBlankString = (value: unknown): value is string => (
    typeof value === 'string' && value.trim().length > 0
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

const parseAdditionTheme = (value: unknown): RequestedWordAdditionTheme | null => {
    if (!isRecord(value)
        || !isNonBlankString(value.themeCode)
        || !isNonBlankString(value.themeName)) {
        return null;
    }
    return { themeCode: value.themeCode, themeName: value.themeName };
};

const parseWordAdditionResult = (
    value: unknown,
    command: RequestWordAdditionCommand,
): RequestWordAdditionResult | null => {
    if (!isRecord(value)
        || !isPositiveSafeInteger(value.requestId)
        || value.word !== command.word
        || value.requestType !== 'add'
        || !Array.isArray(value.themes)) {
        return null;
    }

    const themes: RequestedWordAdditionTheme[] = [];
    for (const rawTheme of value.themes) {
        const theme = parseAdditionTheme(rawTheme);
        if (theme === null) {
            return null;
        }
        themes.push(theme);
    }

    const responseCodes = themes.map(({ themeCode }) => themeCode);
    const isSorted = responseCodes.every((themeCode, index) => (
        index === 0 || responseCodes[index - 1] < themeCode
    ));
    const hasRequestedThemes = responseCodes.length === command.themeCodes.length
        && responseCodes.every((themeCode, index) => themeCode === command.themeCodes[index]);

    return isSorted && hasRequestedThemes
        ? {
            requestId: value.requestId,
            word: value.word,
            requestType: 'add',
            themes,
        }
        : null;
};

const parseWordAdditionsResult = (
    value: unknown,
    requestedWordCount: number,
): RequestWordAdditionsResult | null => {
    if (!isRecord(value)) {
        return null;
    }

    const countKeys = [
        'requestedWordCount',
        'createdWordRequestCount',
        'updatedWordRequestCount',
        'changedRegisteredWordCount',
        'createdThemeChangeRequestCount',
        'unchangedWordCount',
    ] as const;
    if (!countKeys.every((key) => isNonNegativeSafeInteger(value[key]))
        || value.requestedWordCount !== requestedWordCount) {
        return null;
    }

    const result = Object.fromEntries(
        countKeys.map((key) => [key, value[key]]),
    ) as RequestWordAdditionsResult;
    const outcomeCount = result.createdWordRequestCount
        + result.updatedWordRequestCount
        + result.changedRegisteredWordCount
        + result.unchangedWordCount;
    return outcomeCount === requestedWordCount ? result : null;
};

const emptyWordAdditionsResult = (): RequestWordAdditionsResult => ({
    requestedWordCount: 0,
    createdWordRequestCount: 0,
    updatedWordRequestCount: 0,
    changedRegisteredWordCount: 0,
    createdThemeChangeRequestCount: 0,
    unchangedWordCount: 0,
});

const mapUserWordRequestError = (error: RpcError): ApplicationError => {
    const publicErrorCode = error.message as keyof typeof errorKinds;
    if (Object.prototype.hasOwnProperty.call(errorKinds, publicErrorCode)) {
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

    async requestAddition(
        command: RequestWordAdditionCommand,
    ): Promise<Result<RequestWordAdditionResult>> {
        let response: unknown;
        try {
            response = await this.rpcClient.rpc('request_word_addition', {
                p_word: command.word,
                p_theme_codes: command.themeCodes,
            });
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

        const result = parseWordAdditionResult(response.data, command);
        return result === null ? err(infrastructureError()) : ok(result);
    }

    async requestAdditions(
        command: RequestWordAdditionsCommand,
        onProgress?: RequestWordAdditionsProgressListener,
    ): Promise<Result<RequestWordAdditionsResult>> {
        const aggregate = emptyWordAdditionsResult();
        for (let offset = 0; offset < command.entries.length; offset += ADDITION_BATCH_SIZE) {
            const entries = command.entries.slice(offset, offset + ADDITION_BATCH_SIZE);
            let response: unknown;
            try {
                response = await this.rpcClient.rpc('request_word_additions', { p_entries: entries });
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

            const batchResult = parseWordAdditionsResult(response.data, entries.length);
            if (batchResult === null) {
                return err(infrastructureError());
            }
            for (const key of Object.keys(aggregate) as (keyof RequestWordAdditionsResult)[]) {
                aggregate[key] += batchResult[key];
            }
            try {
                onProgress?.({
                    completedWordCount: Math.min(offset + entries.length, command.entries.length),
                    totalWordCount: command.entries.length,
                });
            } catch {
                // 진행률 observer 오류는 이미 커밋된 batch 결과를 실패로 바꾸지 않습니다.
            }
        }
        return ok(aggregate);
    }

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

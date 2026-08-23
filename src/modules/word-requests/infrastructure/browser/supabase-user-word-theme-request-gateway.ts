import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { UserWordThemeRequestGateway } from '../../application/user-word-theme-request-ports';
import type {
    RequestedWordThemeChange,
    RequestWordThemeChangesCommand,
    RequestWordThemeChangesResult,
    UserWordThemeChange,
} from '../../application/user-word-theme-request-types';

type RpcError = { code?: string | null; message: string };
type RpcResponse = { data: unknown; error: RpcError | null };

interface UserWordThemeRequestRpcClient {
    rpc(functionName: string, args: Record<string, unknown>): Promise<RpcResponse>;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '데이터 처리 중 오류가 발생했습니다.',
});

const errorKinds = {
    WORD_THEME_REQUEST_UNAUTHORIZED: 'unauthorized',
    WORD_THEME_REQUEST_INVALID_INPUT: 'validation',
    WORD_THEME_REQUEST_NOT_FOUND: 'not-found',
    WORD_THEME_REQUEST_CONFLICT: 'conflict',
    WORD_THEME_REQUEST_INTERNAL_ERROR: 'infrastructure',
} as const;

const errorMessages: Record<keyof typeof errorKinds, string> = {
    WORD_THEME_REQUEST_UNAUTHORIZED: '인증이 필요합니다.',
    WORD_THEME_REQUEST_INVALID_INPUT: '입력값이 올바르지 않습니다.',
    WORD_THEME_REQUEST_NOT_FOUND: '요청한 데이터를 찾을 수 없습니다.',
    WORD_THEME_REQUEST_CONFLICT: '요청이 이미 처리되었거나 충돌이 발생했습니다.',
    WORD_THEME_REQUEST_INTERNAL_ERROR: '데이터 처리 중 오류가 발생했습니다.',
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const hasOwn = (value: Record<string, unknown>, key: string): boolean => (
    Object.prototype.hasOwnProperty.call(value, key)
);

const isNonBlankString = (value: unknown): value is string => (
    typeof value === 'string' && value.trim().length > 0
);

const isRpcError = (value: unknown): value is RpcError => (
    isRecord(value)
    && hasOwn(value, 'message')
    && typeof value.message === 'string'
    && (!hasOwn(value, 'code') || value.code === null || typeof value.code === 'string')
);

const compareThemeChanges = (left: UserWordThemeChange, right: UserWordThemeChange) => {
    if (left.themeCode !== right.themeCode) {
        return left.themeCode < right.themeCode ? -1 : 1;
    }
    if (left.type === right.type) {
        return 0;
    }
    return left.type === 'add' ? -1 : 1;
};

const parseThemeChange = (value: unknown): RequestedWordThemeChange | null => {
    if (!isRecord(value)
        || !hasOwn(value, 'themeCode')
        || !hasOwn(value, 'themeName')
        || !hasOwn(value, 'type')
        || !isNonBlankString(value.themeCode)
        || !isNonBlankString(value.themeName)
        || (value.type !== 'add' && value.type !== 'delete')) {
        return null;
    }
    return { themeCode: value.themeCode, themeName: value.themeName, type: value.type };
};

const hasRequestedPairs = (
    changes: RequestedWordThemeChange[],
    requestedChanges: UserWordThemeChange[],
): boolean => {
    if (changes.length !== requestedChanges.length) {
        return false;
    }
    const requestedPairs = new Set(requestedChanges.map(({ themeCode, type }) => `${themeCode}\u0000${type}`));
    const responsePairs = new Set(changes.map(({ themeCode, type }) => `${themeCode}\u0000${type}`));
    return requestedPairs.size === requestedChanges.length
        && responsePairs.size === changes.length
        && [...responsePairs].every((pair) => requestedPairs.has(pair));
};

const parseResult = (
    value: unknown,
    command: RequestWordThemeChangesCommand,
): RequestWordThemeChangesResult | null => {
    if (!isRecord(value)
        || !hasOwn(value, 'word')
        || !hasOwn(value, 'changes')
        || value.word !== command.word
        || !Array.isArray(value.changes)) {
        return null;
    }

    const changes: RequestedWordThemeChange[] = [];
    for (const rawChange of value.changes) {
        const change = parseThemeChange(rawChange);
        if (change === null) {
            return null;
        }
        changes.push(change);
    }

    const isSorted = changes.every((change, index) => (
        index === 0 || compareThemeChanges(changes[index - 1], change) <= 0
    ));
    return isSorted && hasRequestedPairs(changes, command.changes)
        ? { word: value.word, changes }
        : null;
};

const mapError = (error: RpcError): ApplicationError => {
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

/** 브라우저 주제 변경 요청 RPC와 Application DTO를 연결합니다. */
export class SupabaseUserWordThemeRequestGateway implements UserWordThemeRequestGateway {
    constructor(
        private readonly rpcClient: UserWordThemeRequestRpcClient = browserSupabaseClient as unknown as UserWordThemeRequestRpcClient,
    ) {}

    async requestThemeChanges(
        command: RequestWordThemeChangesCommand,
    ): Promise<Result<RequestWordThemeChangesResult>> {
        let response: unknown;
        try {
            response = await this.rpcClient.rpc('request_word_theme_changes', {
                p_word: command.word,
                p_changes: command.changes,
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

        const result = parseResult(response.data, command);
        return result === null ? err(infrastructureError()) : ok(result);
    }
}

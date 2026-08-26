import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { DirectWordAdditionGateway } from '../../application/direct-word-addition-ports';
import type {
    DirectWordAdditionGatewayCommand,
    DirectWordAdditionResult,
} from '../../application/direct-word-addition-types';

type RpcError = { code?: string | null; message: string };
type RpcResponse = { data: unknown; error: RpcError | null };

interface DirectWordAdditionRpcClient {
    rpc(functionName: string, args: Record<string, unknown>): Promise<RpcResponse>;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '단어 추가 처리 중 오류가 발생했습니다.',
});

const publicErrors = {
    DIRECT_WORD_ADDITION_UNAUTHORIZED: {
        kind: 'unauthorized', message: '인증이 필요합니다.', code: 'DIRECT_WORD_ADDITION_UNAUTHORIZED',
    },
    DIRECT_WORD_ADDITION_FORBIDDEN: {
        kind: 'forbidden', message: '권한이 없습니다.', code: 'DIRECT_WORD_ADDITION_FORBIDDEN',
    },
    DIRECT_WORD_ADDITION_INVALID_INPUT: {
        kind: 'validation', message: '입력값이 올바르지 않습니다.', code: 'DIRECT_WORD_ADDITION_INVALID_INPUT',
    },
    DIRECT_WORD_ADDITION_INVALID_THEME: {
        kind: 'validation', message: '선택한 주제 정보를 확인해 주세요.', code: 'DIRECT_WORD_ADDITION_INVALID_THEME',
    },
    DIRECT_WORD_ADDITION_DUPLICATE: {
        kind: 'conflict', message: '이미 존재하는 단어입니다.', code: 'DIRECT_WORD_ADDITION_DUPLICATE',
    },
    DIRECT_WORD_ADDITION_INTERNAL_ERROR: {
        kind: 'infrastructure', message: '단어 추가 처리 중 오류가 발생했습니다.', code: 'DIRECT_WORD_ADDITION_INTERNAL_ERROR',
    },
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);
const isPositiveInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);
const isSortedUniquePositiveIntegers = (value: unknown): value is number[] => (
    Array.isArray(value)
    && value.every((item, index) => isPositiveInteger(item)
        && (index === 0 || value[index - 1] < item))
);

const mapError = (error: RpcError): ApplicationError => {
    const mapped = publicErrors[error.message as keyof typeof publicErrors];
    return mapped
        ? { ...mapped }
        : infrastructureError();
};

const parseResult = (
    value: unknown,
    command: DirectWordAdditionGatewayCommand,
): DirectWordAdditionResult | null => {
    if (!isRecord(value)
        || !isPositiveInteger(value.wordId)
        || value.word !== command.word
        || typeof value.noinCanUse !== 'boolean'
        || !isSortedUniquePositiveIntegers(value.themeIds)
        || value.themeIds.length !== command.themeCodes.length
        || !Array.isArray(value.affectedDocsIds)
        || !value.affectedDocsIds.every((item, index) => isPositiveInteger(item)
            && (index === 0 || (value.affectedDocsIds as number[])[index - 1] < item))) {
        return null;
    }
    return {
        wordId: value.wordId,
        word: value.word,
        noinCanUse: value.noinCanUse,
        themeIds: value.themeIds,
        affectedDocsIds: value.affectedDocsIds as number[],
    };
};

/** 브라우저 직접 추가 명령을 보안 경계인 단일 RPC에 연결합니다. */
export class SupabaseDirectWordAdditionGateway implements DirectWordAdditionGateway {
    constructor(
        private readonly rpcClient: DirectWordAdditionRpcClient =
            browserSupabaseClient as unknown as DirectWordAdditionRpcClient,
    ) {}

    async add(command: DirectWordAdditionGatewayCommand): Promise<Result<DirectWordAdditionResult>> {
        let response: RpcResponse;
        try {
            response = await this.rpcClient.rpc('add_word_directly', {
                p_word: command.word,
                p_theme_codes: command.themeCodes,
            });
        } catch {
            return err(infrastructureError());
        }
        if (response.error !== null) return err(mapError(response.error));

        const result = parseResult(response.data, command);
        return result === null ? err(infrastructureError()) : ok(result);
    }
}

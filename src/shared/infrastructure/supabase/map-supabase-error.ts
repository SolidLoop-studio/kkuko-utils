import type { ApplicationError } from '@/src/shared/application/application-error';

export type SupabaseErrorLike = {
    code?: string | null;
    message: string;
    cause?: unknown;
};

const applicationErrors = {
    WORD_APPROVAL_UNAUTHORIZED: {
        kind: 'unauthorized',
        message: '인증이 필요합니다.',
    },
    WORD_APPROVAL_FORBIDDEN: {
        kind: 'forbidden',
        message: '권한이 없습니다.',
    },
    WORD_APPROVAL_NOT_FOUND: {
        kind: 'not-found',
        message: '요청한 데이터를 찾을 수 없습니다.',
    },
    WORD_APPROVAL_CONFLICT: {
        kind: 'conflict',
        message: '요청이 이미 처리되었거나 충돌이 발생했습니다.',
    },
    WORD_APPROVAL_INVALID_INPUT: {
        kind: 'validation',
        message: '입력값이 올바르지 않습니다.',
    },
} as const;

export const mapSupabaseError = (error: SupabaseErrorLike): ApplicationError => {
    const mappedError = applicationErrors[error.message as keyof typeof applicationErrors];

    if (mappedError) {
        return {
            ...mappedError,
            code: error.code ?? undefined,
        };
    }

    return {
        kind: 'infrastructure',
        message: '데이터 처리 중 오류가 발생했습니다.',
        code: error.code ?? undefined,
        ...(error.cause === undefined ? {} : { cause: error.cause }),
    };
};

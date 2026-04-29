import type { CustomError } from './result';

/**
 * 도메인 에러의 기본 생성 함수
 *
 * @param name - 에러 이름
 * @param message - 에러 메시지
 * @param httpStatus - HTTP 상태 코드
 * @param options - 추가 옵션 (details, hint, code)
 * @returns CustomError 객체
 */
function createDomainError(
    name: string,
    message: string,
    httpStatus: number,
    options?: { details?: string; hint?: string; code?: string | number }
): CustomError {
    return {
        name,
        message,
        httpStatus,
        details: options?.details,
        hint: options?.hint,
        code: options?.code,
    };
}

/**
 * 단어를 찾을 수 없을 때 발생하는 에러
 *
 * @param word - 찾으려 한 단어
 * @returns CustomError
 */
export function wordNotFoundError(word: string): CustomError {
    return createDomainError(
        'WordNotFoundError',
        `단어 '${word}'를 찾을 수 없습니다.`,
        404,
        { code: 'WORD_NOT_FOUND' }
    );
}

/**
 * 이미 존재하는 단어를 추가하려 할 때 발생하는 에러
 *
 * @param word - 중복된 단어
 * @returns CustomError
 */
export function wordAlreadyExistsError(word: string): CustomError {
    return createDomainError(
        'WordAlreadyExistsError',
        `단어 '${word}'가 이미 존재합니다.`,
        409,
        { code: 'WORD_ALREADY_EXISTS' }
    );
}

/**
 * 테마를 찾을 수 없을 때 발생하는 에러
 *
 * @param name - 찾으려 한 테마 이름
 * @returns CustomError
 */
export function themeNotFoundError(name: string): CustomError {
    return createDomainError(
        'ThemeNotFoundError',
        `테마 '${name}'를 찾을 수 없습니다.`,
        404,
        { code: 'THEME_NOT_FOUND' }
    );
}

/**
 * 인증이 필요한 작업에서 인증되지 않은 사용자가 접근할 때 발생하는 에러
 *
 * @param message - 에러 메시지 (기본값: '인증이 필요합니다.')
 * @returns CustomError
 */
export function unauthorizedError(message?: string): CustomError {
    return createDomainError(
        'UnauthorizedError',
        message ?? '인증이 필요합니다.',
        401,
        { code: 'UNAUTHORIZED' }
    );
}

/**
 * 입력 데이터가 유효하지 않을 때 발생하는 에러
 *
 * @param message - 검증 실패 메시지
 * @param details - 상세 정보
 * @returns CustomError
 */
export function validationError(message: string, details?: string): CustomError {
    return createDomainError(
        'ValidationError',
        message,
        400,
        { code: 'VALIDATION_ERROR', details }
    );
}

/**
 * 대기 단어를 찾을 수 없을 때 발생하는 에러
 *
 * @param identifier - 대기 단어 식별자 (ID 또는 단어)
 * @returns CustomError
 */
export function waitWordNotFoundError(identifier: string | number): CustomError {
    return createDomainError(
        'WaitWordNotFoundError',
        `대기 단어 '${identifier}'를 찾을 수 없습니다.`,
        404,
        { code: 'WAIT_WORD_NOT_FOUND' }
    );
}

/**
 * 문서를 찾을 수 없을 때 발생하는 에러
 *
 * @param identifier - 문서 식별자 (ID 또는 이름)
 * @returns CustomError
 */
export function docsNotFoundError(identifier: string | number): CustomError {
    return createDomainError(
        'DocsNotFoundError',
        `문서 '${identifier}'를 찾을 수 없습니다.`,
        404,
        { code: 'DOCS_NOT_FOUND' }
    );
}

/**
 * 대기 문서를 찾을 수 없을 때 발생하는 에러
 *
 * @param identifier - 대기 문서 식별자 (ID 또는 이름)
 * @returns CustomError
 */
export function waitDocsNotFoundError(identifier: string | number): CustomError {
    return createDomainError(
        'WaitDocsNotFoundError',
        `대기 문서 '${identifier}'를 찾을 수 없습니다.`,
        404,
        { code: 'WAIT_DOCS_NOT_FOUND' }
    );
}

/**
 * Supabase 인프라 레이어에서 발생하는 에러를 래핑하는 함수
 *
 * @param originalError - 원본 PostgrestError 또는 에러 객체
 * @returns CustomError
 */
export function infrastructureError(originalError: {
    message: string;
    details?: string;
    hint?: string;
    code?: string;
}): CustomError {
    return createDomainError(
        'InfrastructureError',
        originalError.message,
        500,
        {
            details: originalError.details,
            hint: originalError.hint,
            code: originalError.code ?? 'INFRASTRUCTURE_ERROR',
        }
    );
}

import type { ApplicationError } from '@/src/shared/application/application-error';
import type { Result } from '@/src/shared/application/result';

const applicationErrorKinds = new Set<ApplicationError['kind']>([
    'validation',
    'unauthorized',
    'forbidden',
    'not-found',
    'conflict',
    'infrastructure',
]);

const isApplicationError = (error: unknown): error is ApplicationError => {
    if (typeof error !== 'object' || error === null) return false;
    const candidate = error as { kind?: unknown; message?: unknown };
    return typeof candidate.kind === 'string'
        && applicationErrorKinds.has(candidate.kind as ApplicationError['kind'])
        && typeof candidate.message === 'string';
};

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '문서 요청 목록을 불러오는 중 오류가 발생했습니다.',
});

export const unwrapDocsQuery = async <T>(operation: () => Promise<Result<T>>): Promise<T> => {
    try {
        const result = await operation();
        if (!result.ok) throw result.error;
        return result.value;
    } catch (error) {
        throw isApplicationError(error) ? error : infrastructureError();
    }
};

export const retryDocsQuery = (
    failureCount: number,
    error: ApplicationError,
): boolean => error.kind !== 'validation' && failureCount < 3;

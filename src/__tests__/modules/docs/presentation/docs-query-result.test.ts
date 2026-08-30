import type { ApplicationError } from '@/src/shared/application/application-error';
import { retryDocsQuery } from '@/src/modules/docs/presentation/docs-query-result';

describe('retryDocsQuery', () => {
    it('retries infrastructure errors three times before the final fourth attempt', () => {
        const error: ApplicationError = {
            kind: 'infrastructure',
            message: '문서 목록을 불러오는 중 오류가 발생했습니다.',
        };

        expect(retryDocsQuery(0, error)).toBe(true);
        expect(retryDocsQuery(1, error)).toBe(true);
        expect(retryDocsQuery(2, error)).toBe(true);
        expect(retryDocsQuery(3, error)).toBe(false);
    });

    it.each<ApplicationError['kind']>([
        'validation',
        'unauthorized',
        'forbidden',
        'not-found',
        'conflict',
    ])('does not retry %s errors', (kind) => {
        expect(retryDocsQuery(0, { kind, message: '오류' })).toBe(false);
    });
});

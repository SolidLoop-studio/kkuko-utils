import { CheckLetterDocsDuplicateService } from '@/src/modules/docs/application/check-letter-docs-duplicate';
import type { LetterDocsDuplicateQueryGateway } from '@/src/modules/docs/application/letter-docs-duplicate-query-ports';
import { ok, type Result } from '@/src/shared/application/result';

class FakeLetterDocsDuplicateQueryGateway implements LetterDocsDuplicateQueryGateway {
    readonly docsNames: string[] = [];

    result: Result<boolean> = ok(false);

    async existsByName(docsName: string): Promise<Result<boolean>> {
        this.docsNames.push(docsName);
        return this.result;
    }
}

const validationError = {
    kind: 'validation' as const,
    message: '문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
};

describe('CheckLetterDocsDuplicateService', () => {
    it.each([
        ['non-Hangul', 'A'],
        ['precomposed Hangul', '가'],
        ['whitespace', ' '],
        ['normalization-sensitive', 'Å'],
    ])('passes a one-code-unit %s docs name unchanged', async (_description, docsName) => {
        const gateway = new FakeLetterDocsDuplicateQueryGateway();
        gateway.result = ok(true);
        const service = new CheckLetterDocsDuplicateService(gateway);

        await expect(service.check(docsName)).resolves.toEqual(ok(true));
        expect(gateway.docsNames).toEqual([docsName]);
    });

    it.each(['', '가나', '😀'])(
        'rejects invalid docs name %p before infrastructure',
        async (docsName) => {
            const gateway = new FakeLetterDocsDuplicateQueryGateway();
            const service = new CheckLetterDocsDuplicateService(gateway);

            await expect(service.check(docsName)).resolves.toEqual({
                ok: false,
                error: validationError,
            });
            expect(gateway.docsNames).toEqual([]);
        },
    );
});

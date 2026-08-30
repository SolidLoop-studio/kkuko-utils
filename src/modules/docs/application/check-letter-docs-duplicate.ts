import { err, type Result } from '@/src/shared/application/result';
import type { LetterDocsDuplicateQueryGateway } from './letter-docs-duplicate-query-ports';

const validationError = () => ({
    kind: 'validation' as const,
    message: '문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
});

/** 글자 문서 이름의 중복 여부를 조회하는 애플리케이션 서비스입니다. */
export class CheckLetterDocsDuplicateService {
    constructor(private readonly gateway: LetterDocsDuplicateQueryGateway) {}

    check(docsName: string): Promise<Result<boolean>> {
        if (docsName.length !== 1) {
            return Promise.resolve(err(validationError()));
        }
        return this.gateway.existsByName(docsName);
    }
}

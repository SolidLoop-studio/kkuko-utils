import { err, type Result } from '@/src/shared/application/result';
import type { DocsCreationRequestGateway } from './docs-creation-request-ports';
import type { DocsCreationRequestCommand } from './docs-creation-request-types';

const validationError = () => ({
    kind: 'validation' as const,
    message: '문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
});

/** 새 글자 문서 생성 요청을 제출하는 애플리케이션 서비스입니다. */
export class RequestDocsCreationService {
    constructor(private readonly gateway: DocsCreationRequestGateway) {}

    request(command: DocsCreationRequestCommand): Promise<Result<void>> {
        if (command.docsName.length !== 1 || command.requesterId.length === 0) {
            return Promise.resolve(err(validationError()));
        }
        return this.gateway.request(command);
    }
}

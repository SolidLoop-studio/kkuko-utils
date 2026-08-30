import { err, type Result } from '@/src/shared/application/result';
import type { DocsViewCommandGateway } from './docs-view-command-ports';

const validationError = () => ({
    kind: 'validation' as const,
    message: '문서 조회 수 기록에 실패했습니다. 잠시 후 다시 시도해주세요.',
});

/** 유효한 문서 ID의 조회 수 기록을 명령 gateway에 위임합니다. */
export class RecordDocsViewService {
    constructor(private readonly gateway: DocsViewCommandGateway) {}

    record(docsId: number): Promise<Result<void>> {
        if (!Number.isInteger(docsId) || docsId <= 0) {
            return Promise.resolve(err(validationError()));
        }
        return this.gateway.record(docsId);
    }
}

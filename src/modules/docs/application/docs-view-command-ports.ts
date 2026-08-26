import type { Result } from '@/src/shared/application/result';

/** 문서 조회 수를 독립적으로 기록하는 외부 명령 경계입니다. */
export interface DocsViewCommandGateway {
    record(docsId: number): Promise<Result<void>>;
}

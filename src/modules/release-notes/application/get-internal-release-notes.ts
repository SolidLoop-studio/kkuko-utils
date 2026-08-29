import { err, type Result } from '@/src/shared/application/result';
import type { InternalReleaseNoteQueryGateway } from './release-note-query-ports';
import type { InternalReleaseNote } from './release-note-query-types';

const infrastructureError = () => ({
    kind: 'infrastructure' as const,
    message: '릴리즈 노트를 불러오는 중 오류가 발생했습니다.',
});

/** 내부 릴리즈 노트를 공개 오류 계약으로 조회합니다. */
export class GetInternalReleaseNotesService {
    constructor(private readonly gateway: InternalReleaseNoteQueryGateway) {}

    async get(): Promise<Result<InternalReleaseNote[]>> {
        try {
            const result = await this.gateway.load();
            return result.ok ? result : err(infrastructureError());
        } catch {
            return err(infrastructureError());
        }
    }
}

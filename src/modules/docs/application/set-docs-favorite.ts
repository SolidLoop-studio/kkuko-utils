import { err, type Result } from '@/src/shared/application/result';
import type {
    DocsFavoriteCommandGateway,
    SetDocsFavoriteCommand,
} from './docs-favorite-command-ports';

const validationError = () => ({
    kind: 'validation' as const,
    message: '문서 즐겨찾기 설정에 실패했습니다. 잠시 후 다시 시도해주세요.',
});

/** 유효한 문서 즐겨찾기 희망 상태를 명령 gateway에 위임합니다. */
export class SetDocsFavoriteService {
    constructor(private readonly gateway: DocsFavoriteCommandGateway) {}

    set(command: SetDocsFavoriteCommand): Promise<Result<void>> {
        if (!Number.isSafeInteger(command.docsId) || command.docsId <= 0) {
            return Promise.resolve(err(validationError()));
        }
        return this.gateway.set(command);
    }
}

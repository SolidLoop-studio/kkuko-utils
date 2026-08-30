import type { Result } from '@/src/shared/application/result';

/** 문서 즐겨찾기의 최종 희망 상태를 나타내는 명령입니다. */
export type SetDocsFavoriteCommand = {
    docsId: number;
    isStarred: boolean;
};

/** 인증된 사용자의 문서 즐겨찾기 상태를 설정하는 외부 명령 경계입니다. */
export interface DocsFavoriteCommandGateway {
    set(command: SetDocsFavoriteCommand): Promise<Result<void>>;
}

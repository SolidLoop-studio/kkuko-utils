import type { WordData } from '@/src/app/types/type';
import type { GetDocsWordMutationTargetsService } from '@/src/modules/word-moderation';
import type { DocsWordMutationTarget } from '@/src/modules/word-moderation';
import { err, ok, type Result } from '@/src/shared/application/result';

export const DOCS_WORD_TARGET_LOAD_ERROR_MESSAGE =
    '문서 단어 처리 대상을 불러오는 중 오류가 발생했습니다.';
export const DOCS_WORD_TARGET_REFRESH_ERROR_MESSAGE =
    '문서 단어 처리 대상을 새로고침하는 중 오류가 발생했습니다.';

export type DocsWordData = WordData & {
    mutationTarget: DocsWordMutationTarget | null;
};

export type DocsWordAdminAction = 'approve' | 'reject' | 'delete-directly';

type DocsWordMutationTargetReader = Pick<GetDocsWordMutationTargetsService, 'get'>;

const targetLoadError = () => ({
    kind: 'infrastructure' as const,
    message: DOCS_WORD_TARGET_LOAD_ERROR_MESSAGE,
});

/** 기존 문서 행에 현재 관리자 변경 대상을 입력 순서대로 보강합니다. */
export async function enrichDocsWordData(
    docsId: number,
    baseRows: WordData[],
    targetService: DocsWordMutationTargetReader,
): Promise<Result<DocsWordData[]>> {
    try {
        const targetResult = await targetService.get({
            docsId,
            rows: baseRows.map(({ word, status }) => ({ word, status })),
        });

        if (!targetResult.ok || targetResult.value.targets.length !== baseRows.length) {
            return err(targetLoadError());
        }

        return ok(baseRows.map((row, index) => ({
            ...row,
            mutationTarget: targetResult.value.targets[index],
        })));
    } catch {
        return err(targetLoadError());
    }
}

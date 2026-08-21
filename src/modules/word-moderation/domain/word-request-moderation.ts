import type { Result } from '@/src/shared/application/result';
import { err, ok } from '@/src/shared/application/result';

export type WordRequestModerationSelection =
    | {
        kind: 'word-request';
        requestId: number;
        selectedThemeIds: number[];
    }
    | {
        kind: 'theme-change';
        wordId: number;
        changes: Array<{ themeId: number; type: 'add' | 'delete' }>;
    };

export type ModerateWordRequestsCommand = {
    selections: WordRequestModerationSelection[];
};

const validationError = (field: string, message: string) => err({
    kind: 'validation' as const,
    field,
    message,
});

const isPositiveSafeInteger = (value: number): boolean => Number.isSafeInteger(value) && value > 0;

/**
 * 단어 요청 조작 명령을 검증하고 DB 경계에서 재현 가능한 순서로 정규화합니다.
 */
export function normalizeWordRequestModerationCommand(
    command: ModerateWordRequestsCommand,
): Result<ModerateWordRequestsCommand> {
    if (command.selections.length === 0) {
        return validationError('selections', '처리할 요청이 없습니다.');
    }
    if (command.selections.length > 30) {
        return validationError('selections', '한 번에 최대 30개의 요청만 처리할 수 있습니다.');
    }

    const requestIds = new Set<number>();
    const wordIds = new Set<number>();
    const selections: WordRequestModerationSelection[] = [];

    for (const selection of command.selections) {
        if (selection.kind === 'word-request') {
            if (!isPositiveSafeInteger(selection.requestId)) {
                return validationError('requestId', '요청 ID는 안전한 양의 정수여야 합니다.');
            }
            if (requestIds.has(selection.requestId)) {
                return validationError('requestId', '중복된 요청 ID가 있습니다.');
            }
            if (selection.selectedThemeIds.some((themeId) => !isPositiveSafeInteger(themeId))) {
                return validationError('selectedThemeIds', '주제 ID는 안전한 양의 정수여야 합니다.');
            }

            requestIds.add(selection.requestId);
            selections.push({
                kind: 'word-request',
                requestId: selection.requestId,
                selectedThemeIds: Array.from(new Set(selection.selectedThemeIds)).sort((left, right) => left - right),
            });
            continue;
        }

        if (!isPositiveSafeInteger(selection.wordId)) {
            return validationError('wordId', '단어 ID는 안전한 양의 정수여야 합니다.');
        }
        if (wordIds.has(selection.wordId)) {
            return validationError('wordId', '중복된 단어 ID가 있습니다.');
        }

        const changes = new Map<number, 'add' | 'delete'>();
        for (const change of selection.changes) {
            if (!isPositiveSafeInteger(change.themeId)) {
                return validationError('themeId', '주제 ID는 안전한 양의 정수여야 합니다.');
            }

            const existingType = changes.get(change.themeId);
            if (existingType !== undefined) {
                return validationError(
                    'changes',
                    existingType === change.type
                        ? '중복된 주제 변경이 있습니다.'
                        : '서로 상충하는 주제 변경이 있습니다.',
                );
            }
            changes.set(change.themeId, change.type);
        }

        wordIds.add(selection.wordId);
        selections.push({
            kind: 'theme-change',
            wordId: selection.wordId,
            changes: Array.from(changes, ([themeId, type]) => ({ themeId, type })).sort(
                (left, right) => left.themeId - right.themeId
                    || (left.type === right.type ? 0 : left.type < right.type ? -1 : 1),
            ),
        });
    }

    return ok({
        selections: selections.sort((left, right) => {
            if (left.kind === 'word-request' && right.kind === 'word-request') {
                return left.requestId - right.requestId;
            }
            if (left.kind === 'theme-change' && right.kind === 'theme-change') {
                return left.wordId - right.wordId;
            }
            return left.kind === 'word-request' ? -1 : 1;
        }),
    });
}

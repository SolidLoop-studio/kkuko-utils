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

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

/**
 * 단어 요청 조작 명령을 검증하고 DB 경계에서 재현 가능한 순서로 정규화합니다.
 */
export function normalizeWordRequestModerationCommand(
    command: ModerateWordRequestsCommand,
): Result<ModerateWordRequestsCommand> {
    const rawCommand: unknown = command;
    if (!isRecord(rawCommand) || !Array.isArray(rawCommand.selections)) {
        return validationError('selections', '요청 목록은 배열이어야 합니다.');
    }

    const rawSelections = rawCommand.selections;
    if (rawSelections.length === 0) {
        return validationError('selections', '처리할 요청이 없습니다.');
    }
    if (rawSelections.length > 30) {
        return validationError('selections', '한 번에 최대 30개의 요청만 처리할 수 있습니다.');
    }

    const requestIds = new Set<number>();
    const wordIds = new Set<number>();
    const selections: WordRequestModerationSelection[] = [];

    for (const rawSelection of rawSelections) {
        if (!isRecord(rawSelection)) {
            return validationError('selection', '요청 항목은 객체여야 합니다.');
        }

        if (rawSelection.kind === 'word-request') {
            const requestId = rawSelection.requestId;
            const selectedThemeIds = rawSelection.selectedThemeIds;
            if (!isPositiveSafeInteger(requestId)) {
                return validationError('requestId', '요청 ID는 안전한 양의 정수여야 합니다.');
            }
            if (requestIds.has(requestId)) {
                return validationError('requestId', '중복된 요청 ID가 있습니다.');
            }
            if (!Array.isArray(selectedThemeIds)) {
                return validationError('selectedThemeIds', '선택한 주제 ID 목록은 배열이어야 합니다.');
            }

            const normalizedThemeIds: number[] = [];
            for (const themeId of selectedThemeIds) {
                if (!isPositiveSafeInteger(themeId)) {
                    return validationError('selectedThemeIds', '주제 ID는 안전한 양의 정수여야 합니다.');
                }
                normalizedThemeIds.push(themeId);
            }

            requestIds.add(requestId);
            selections.push({
                kind: 'word-request',
                requestId,
                selectedThemeIds: Array.from(new Set(normalizedThemeIds)).sort((left, right) => left - right),
            });
            continue;
        }

        if (rawSelection.kind !== 'theme-change') {
            return validationError('kind', '알 수 없는 요청 종류입니다.');
        }

        const wordId = rawSelection.wordId;
        const rawChanges = rawSelection.changes;
        if (!isPositiveSafeInteger(wordId)) {
            return validationError('wordId', '단어 ID는 안전한 양의 정수여야 합니다.');
        }
        if (wordIds.has(wordId)) {
            return validationError('wordId', '중복된 단어 ID가 있습니다.');
        }
        if (!Array.isArray(rawChanges)) {
            return validationError('changes', '주제 변경 목록은 배열이어야 합니다.');
        }

        const changes = new Map<number, 'add' | 'delete'>();
        for (const rawChange of rawChanges) {
            if (!isRecord(rawChange)) {
                return validationError('changes', '주제 변경 항목은 객체여야 합니다.');
            }

            const themeId = rawChange.themeId;
            const type = rawChange.type;
            if (!isPositiveSafeInteger(themeId)) {
                return validationError('themeId', '주제 ID는 안전한 양의 정수여야 합니다.');
            }
            if (type !== 'add' && type !== 'delete') {
                return validationError('type', '알 수 없는 주제 변경 종류입니다.');
            }

            const existingType = changes.get(themeId);
            if (existingType !== undefined) {
                return validationError(
                    'changes',
                    existingType === type
                        ? '중복된 주제 변경이 있습니다.'
                        : '서로 상충하는 주제 변경이 있습니다.',
                );
            }
            changes.set(themeId, type);
        }

        wordIds.add(wordId);
        selections.push({
            kind: 'theme-change',
            wordId,
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

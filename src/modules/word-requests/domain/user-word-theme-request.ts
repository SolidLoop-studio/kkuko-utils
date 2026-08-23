import { err, ok, type Result } from '@/src/shared/application/result';

export const MAX_USER_WORD_THEME_CHANGES = 100;

type NormalizedUserWordThemeChange = {
    themeCode: string;
    type: 'add' | 'delete';
};

export type NormalizedUserWordThemeChangesCommand = {
    word: string;
    changes: NormalizedUserWordThemeChange[];
};

const validationError = (field: string, message: string) => err({
    kind: 'validation' as const,
    field,
    message,
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const compareThemeChanges = (
    left: NormalizedUserWordThemeChange,
    right: NormalizedUserWordThemeChange,
) => {
    if (left.themeCode !== right.themeCode) {
        return left.themeCode < right.themeCode ? -1 : 1;
    }
    if (left.type === right.type) {
        return 0;
    }
    return left.type === 'add' ? -1 : 1;
};

/** 사용자 주제 변경 요청을 RPC 전송 전에 정규화하고 검증합니다. */
export function normalizeUserWordThemeChangesCommand(
    command: unknown,
): Result<NormalizedUserWordThemeChangesCommand> {
    if (!isRecord(command) || typeof command.word !== 'string' || command.word.trim().length === 0) {
        return validationError('word', '단어를 입력해 주세요.');
    }
    if (!Array.isArray(command.changes)
        || command.changes.length === 0
        || command.changes.length > MAX_USER_WORD_THEME_CHANGES) {
        return validationError('changes', '요청을 하나 이상 100개 이하로 선택해 주세요.');
    }

    const themeCodes = new Set<string>();
    const changes: NormalizedUserWordThemeChange[] = [];
    for (const change of command.changes) {
        if (!isRecord(change)
            || typeof change.themeCode !== 'string'
            || change.themeCode.trim().length === 0
            || (change.type !== 'add' && change.type !== 'delete')) {
            return validationError('changes', '주제 변경 요청이 올바르지 않습니다.');
        }

        const themeCode = change.themeCode.trim();
        if (themeCodes.has(themeCode)) {
            return validationError('changes', '같은 주제는 한 번만 요청할 수 있습니다.');
        }
        themeCodes.add(themeCode);
        changes.push({ themeCode, type: change.type });
    }

    return ok({ word: command.word.trim(), changes: changes.sort(compareThemeChanges) });
}

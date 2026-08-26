import { err, ok, type Result } from '@/src/shared/application/result';
import type { DirectWordAdditionCommand } from '../application/direct-word-addition-types';

export const MAX_DIRECT_WORD_ADDITION_THEMES = 100;

export type DirectWordAdditionNoInjungPolicy = (themeCodes: readonly string[]) => boolean;

export interface NormalizedDirectWordAdditionCommand extends DirectWordAdditionCommand {
    noinCanUse: boolean;
}

const validationError = (field: string, message: string) => err({
    kind: 'validation' as const,
    field,
    message,
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

/** 관리자 직접 단어 추가 명령을 정규화하고 순수 어인정 규칙으로 파생값을 계산합니다. */
export function normalizeDirectWordAdditionCommand(
    command: unknown,
    isNoin: DirectWordAdditionNoInjungPolicy,
): Result<NormalizedDirectWordAdditionCommand> {
    if (!isRecord(command) || typeof command.word !== 'string' || command.word.trim() === '') {
        return validationError('word', '단어를 입력해 주세요.');
    }
    if (!Array.isArray(command.themeCodes)
        || command.themeCodes.length > MAX_DIRECT_WORD_ADDITION_THEMES) {
        return validationError('themeCodes', '주제는 100개 이하로 선택해 주세요.');
    }

    const themeCodes: string[] = [];
    const seenThemeCodes = new Set<string>();
    for (const rawThemeCode of command.themeCodes) {
        if (typeof rawThemeCode !== 'string' || rawThemeCode.trim() === '') {
            return validationError('themeCodes', '선택한 주제 정보가 올바르지 않습니다.');
        }
        const themeCode = rawThemeCode.trim();
        if (seenThemeCodes.has(themeCode)) {
            return validationError('themeCodes', '같은 주제는 한 번만 선택할 수 있습니다.');
        }
        seenThemeCodes.add(themeCode);
        themeCodes.push(themeCode);
    }
    themeCodes.sort();

    return ok({
        word: command.word.trim(),
        themeCodes,
        noinCanUse: isNoin(themeCodes),
    });
}

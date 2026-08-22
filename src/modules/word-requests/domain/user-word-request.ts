import { err, ok, type Result } from '@/src/shared/application/result';
import type { UserWordRequestCommand } from '../application/user-word-request-types';

export function normalizeUserWordRequestCommand(
    command: UserWordRequestCommand,
): Result<UserWordRequestCommand> {
    const rawWord: unknown = (command as { word?: unknown } | null)?.word;
    if (typeof rawWord !== 'string' || rawWord.trim().length === 0) {
        return err({ kind: 'validation', field: 'word', message: '단어를 입력해 주세요.' });
    }
    return ok({ word: rawWord.trim() });
}

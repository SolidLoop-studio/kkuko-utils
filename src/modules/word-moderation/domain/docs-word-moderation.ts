import { err, ok, type Result } from '@/src/shared/application/result';
import type { ModerateWordRequestsCommand } from './word-request-moderation';

export type DocsWordMutationTarget =
    | {
        kind: 'word-request';
        requestId: number;
        requestType: 'add' | 'delete';
        selectedThemeIds: number[];
    }
    | { kind: 'theme-change'; wordId: number; themeId: number; type: 'add' | 'delete' }
    | { kind: 'registered-word'; wordId: number };

export type DocsWordMutationTargetRow = {
    word: string;
    status: 'add' | 'delete' | 'ok';
};

export type GetDocsWordMutationTargetsQuery = {
    docsId: number;
    rows: DocsWordMutationTargetRow[];
};

export type GetDocsWordMutationTargetsResult = {
    targets: Array<DocsWordMutationTarget | null>;
};

export type DeleteWordDirectlyCommand = { wordId: number };

export type DeleteWordDirectlyResult = {
    deletedWordCount: 1;
    affectedDocsIds: number[];
};

const validationError = <T = never>(field: string, message: string): Result<T> => err({
    kind: 'validation',
    field,
    message,
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

const isMutationType = (value: unknown): value is 'add' | 'delete' => (
    value === 'add' || value === 'delete'
);

const normalizeThemeIds = (value: unknown): Result<number[]> => {
    if (!Array.isArray(value)) {
        return validationError('selectedThemeIds', '선택한 주제 ID 목록은 배열이어야 합니다.');
    }

    const themeIds: number[] = [];
    for (const themeId of value) {
        if (!isPositiveSafeInteger(themeId)) {
            return validationError('selectedThemeIds', '주제 ID는 안전한 양의 정수여야 합니다.');
        }
        themeIds.push(themeId);
    }

    return ok(Array.from(new Set(themeIds)).sort((left, right) => left - right));
};

/** 문서 단어 변경 대상을 검증하고 요청 조작 명령으로 변환합니다. */
export function toModerateWordRequestsCommand(
    target: unknown,
): Result<ModerateWordRequestsCommand> {
    if (!isRecord(target)) {
        return validationError('target', '변경 대상은 객체여야 합니다.');
    }

    if (target.kind === 'word-request') {
        if (!isPositiveSafeInteger(target.requestId)) {
            return validationError('requestId', '요청 ID는 안전한 양의 정수여야 합니다.');
        }
        if (!isMutationType(target.requestType)) {
            return validationError('requestType', '알 수 없는 요청 종류입니다.');
        }

        const themeIds = normalizeThemeIds(target.selectedThemeIds);
        if (!themeIds.ok) {
            return themeIds;
        }

        return ok({
            selections: [{
                kind: 'word-request',
                requestId: target.requestId,
                selectedThemeIds: themeIds.value,
            }],
        });
    }

    if (target.kind === 'theme-change') {
        if (!isPositiveSafeInteger(target.wordId)) {
            return validationError('wordId', '단어 ID는 안전한 양의 정수여야 합니다.');
        }
        if (!isPositiveSafeInteger(target.themeId)) {
            return validationError('themeId', '주제 ID는 안전한 양의 정수여야 합니다.');
        }
        if (!isMutationType(target.type)) {
            return validationError('type', '알 수 없는 주제 변경 종류입니다.');
        }

        return ok({
            selections: [{
                kind: 'theme-change',
                wordId: target.wordId,
                changes: [{ themeId: target.themeId, type: target.type }],
            }],
        });
    }

    if (target.kind === 'registered-word') {
        if (!isPositiveSafeInteger(target.wordId)) {
            return validationError('wordId', '단어 ID는 안전한 양의 정수여야 합니다.');
        }
        return validationError('target', '등록된 단어는 요청 조작으로 처리할 수 없습니다.');
    }

    return validationError('kind', '알 수 없는 변경 대상 종류입니다.');
}

/** 문서 단어 변경 대상 조회 입력을 검증합니다. */
export function normalizeDocsWordMutationTargetsQuery(
    query: unknown,
): Result<GetDocsWordMutationTargetsQuery> {
    if (!isRecord(query) || !isPositiveSafeInteger(query.docsId)) {
        return validationError('docsId', '문서 ID는 안전한 양의 정수여야 합니다.');
    }
    if (!Array.isArray(query.rows)) {
        return validationError('rows', '단어 행 목록은 배열이어야 합니다.');
    }

    const rows: DocsWordMutationTargetRow[] = [];
    for (const rawRow of query.rows) {
        if (!isRecord(rawRow)) {
            return validationError('rows', '단어 행은 객체여야 합니다.');
        }
        if (typeof rawRow.word !== 'string' || rawRow.word.length === 0 || rawRow.word.trim() !== rawRow.word) {
            return validationError('word', '단어는 공백 없이 입력해야 합니다.');
        }
        if (rawRow.status !== 'add' && rawRow.status !== 'delete' && rawRow.status !== 'ok') {
            return validationError('status', '알 수 없는 단어 상태입니다.');
        }
        rows.push({ word: rawRow.word, status: rawRow.status });
    }

    return ok({ docsId: query.docsId, rows });
}

/** 직접 단어 삭제 입력을 검증합니다. */
export function normalizeDeleteWordDirectlyCommand(
    command: unknown,
): Result<DeleteWordDirectlyCommand> {
    if (!isRecord(command) || !isPositiveSafeInteger(command.wordId)) {
        return validationError('wordId', '단어 ID는 안전한 양의 정수여야 합니다.');
    }

    return ok({ wordId: command.wordId });
}

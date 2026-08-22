import { err, ok, type Result } from '@/src/shared/application/result';

export type ApproveDocsRequestSelection = { requestId: number; duem: boolean };
export type ApproveDocsRequestsCommand = { selections: ApproveDocsRequestSelection[] };
export type RejectDocsRequestsCommand = { requestIds: number[] };

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

const validateRequestIds = (value: unknown[], field: 'selections' | 'requestIds') => {
    if (value.length === 0) {
        return validationError(field, '처리할 요청이 없습니다.');
    }
    if (value.length > 30) {
        return validationError(field, '한 번에 최대 30개의 요청만 처리할 수 있습니다.');
    }
    return null;
};

/** 문서 승인 요청을 검증하고 요청 ID 순서로 정규화합니다. */
export function normalizeApproveDocsRequestsCommand(
    command: ApproveDocsRequestsCommand,
): Result<ApproveDocsRequestsCommand> {
    const rawCommand: unknown = command;
    if (!isRecord(rawCommand)) {
        return validationError('selections', '요청 명령은 객체여야 합니다.');
    }

    const rawSelections = rawCommand.selections;
    if (!Array.isArray(rawSelections)) {
        return validationError('selections', '요청 목록은 배열이어야 합니다.');
    }
    const listError = validateRequestIds(rawSelections, 'selections');
    if (listError) return listError;

    const selections: ApproveDocsRequestSelection[] = [];
    const requestIds = new Set<number>();
    for (const rawSelection of rawSelections) {
        if (!isRecord(rawSelection)) {
            return validationError('selections', '요청 항목은 객체여야 합니다.');
        }
        if (!isPositiveSafeInteger(rawSelection.requestId)) {
            return validationError('requestId', '요청 ID는 안전한 양의 정수여야 합니다.');
        }
        if (requestIds.has(rawSelection.requestId)) {
            return validationError('requestId', '중복된 요청 ID가 있습니다.');
        }
        if (typeof rawSelection.duem !== 'boolean') {
            return validationError('duem', '어인정 여부는 불리언이어야 합니다.');
        }
        requestIds.add(rawSelection.requestId);
        selections.push({ requestId: rawSelection.requestId, duem: rawSelection.duem });
    }

    return ok({ selections: selections.sort((left, right) => left.requestId - right.requestId) });
}

/** 문서 거부 요청을 검증하고 요청 ID 순서로 정규화합니다. */
export function normalizeRejectDocsRequestsCommand(
    command: RejectDocsRequestsCommand,
): Result<RejectDocsRequestsCommand> {
    const rawCommand: unknown = command;
    if (!isRecord(rawCommand)) {
        return validationError('requestIds', '요청 명령은 객체여야 합니다.');
    }

    const rawRequestIds = rawCommand.requestIds;
    if (!Array.isArray(rawRequestIds)) {
        return validationError('requestIds', '요청 목록은 배열이어야 합니다.');
    }
    const listError = validateRequestIds(rawRequestIds, 'requestIds');
    if (listError) return listError;

    const requestIds: number[] = [];
    const uniqueRequestIds = new Set<number>();
    for (const rawRequestId of rawRequestIds) {
        if (!isPositiveSafeInteger(rawRequestId)) {
            return validationError('requestId', '요청 ID는 안전한 양의 정수여야 합니다.');
        }
        if (uniqueRequestIds.has(rawRequestId)) {
            return validationError('requestId', '중복된 요청 ID가 있습니다.');
        }
        uniqueRequestIds.add(rawRequestId);
        requestIds.push(rawRequestId);
    }

    return ok({ requestIds: requestIds.sort((left, right) => left - right) });
}

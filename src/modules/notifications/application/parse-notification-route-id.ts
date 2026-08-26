const CANONICAL_POSITIVE_DECIMAL = /^[1-9]\d*$/;

/** route parameter가 canonical positive safe integer이면 숫자 ID로 변환합니다. */
export const parseNotificationRouteId = (value: string): number | null => {
    if (!CANONICAL_POSITIVE_DECIMAL.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
};

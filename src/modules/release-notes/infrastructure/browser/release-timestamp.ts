const RELEASE_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/;

const isLeapYear = (year: number): boolean => (
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
);

const daysInMonth = (year: number, month: number): number => {
    if (month === 2) return isLeapYear(year) ? 29 : 28;
    return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

/** RFC3339 형태와 날짜·시간·offset 구성요소가 모두 유효한 릴리즈 timestamp인지 확인합니다. */
export const isValidReleaseTimestamp = (value: unknown): value is string => {
    if (typeof value !== 'string') return false;
    const match = RELEASE_TIMESTAMP_PATTERN.exec(value);
    if (match === null) return false;

    const [, yearText, monthText, dayText, hourText, minuteText, secondText,
        offsetHourText, offsetMinuteText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);
    const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText);
    const offsetMinute = offsetMinuteText === undefined ? 0 : Number(offsetMinuteText);

    return month >= 1
        && month <= 12
        && day >= 1
        && day <= daysInMonth(year, month)
        && hour <= 23
        && minute <= 59
        && second <= 59
        && offsetHour <= 23
        && offsetMinute <= 59;
};

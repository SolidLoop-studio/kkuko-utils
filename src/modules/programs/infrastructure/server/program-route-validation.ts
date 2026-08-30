import type { ReleasePagination } from '../../application/program-query-types';

const canonicalPositiveInteger = (value: string | null): number | null => {
    if (value === null || !/^[1-9]\d*$/.test(value)) return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : null;
};

export const parseProgramId = (value: string | null): number | null => canonicalPositiveInteger(value);

export const parseReleasePagination = (searchParams: URLSearchParams): ReleasePagination | null => {
    const page = searchParams.has('page') ? canonicalPositiveInteger(searchParams.get('page')) : 1;
    const perPage = searchParams.has('per_page') ? canonicalPositiveInteger(searchParams.get('per_page')) : 10;
    return page !== null && perPage !== null && page <= 10_000 && perPage <= 100
        ? { page, perPage }
        : null;
};

const repositoryPart = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

export const parseRepository = (segment: string): string | null => {
    let repository: string;
    try { repository = decodeURIComponent(segment); } catch { return null; }
    const parts = repository.split('/');
    return parts.length === 2 && repositoryPart.test(parts[0]) && repositoryPart.test(parts[1])
        ? repository
        : null;
};

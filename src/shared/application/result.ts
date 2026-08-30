import type { ApplicationError } from './application-error';

export type Result<T> =
    | { ok: true; value: T }
    | { ok: false; error: ApplicationError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <T = never>(error: ApplicationError): Result<T> => ({ ok: false, error });

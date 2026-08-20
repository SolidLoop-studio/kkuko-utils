export type ApplicationError =
    | { kind: 'validation'; message: string; field?: string; code?: string }
    | { kind: 'unauthorized'; message: string; code?: string }
    | { kind: 'forbidden'; message: string; code?: string }
    | { kind: 'not-found'; message: string; code?: string }
    | { kind: 'conflict'; message: string; code?: string }
    | { kind: 'infrastructure'; message: string; code?: string; cause?: unknown };

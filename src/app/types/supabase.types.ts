import type { PostgrestError } from '@supabase/supabase-js';

export type SupabaseResult<T> =
    | { data: T[] | T; error: null; count: number | null }
    | { data: null; error: PostgrestError; count: null };

export type SupabaseArrayResult<T> =
    | { data: T[]; error: null; count: number | null }
    | { data: null; error: PostgrestError; count: null };

export type ProgressCallback = (
    current: number,
    total: number,
    currentChunk: number,
    totalChunks: number
) => void;
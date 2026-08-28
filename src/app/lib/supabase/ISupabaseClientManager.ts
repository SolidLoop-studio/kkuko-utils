import { PostgrestError, PostgrestSingleResponse } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types'

type wait_word = Database['public']['Tables']['wait_words']['Row']
type theme = Database['public']['Tables']['themes']['Row']
type word = Database['public']['Tables']['words']['Row']
type docs = Database['public']['Tables']['docs']['Row']
type user = Database['public']['Tables']['users']['Row'];
type docs_log = Database['public']['Tables']['docs_logs']['Row'];
type log = Database['public']['Tables']['logs']['Row'];
type okWord = Omit<word, 'mission_mark'> & { mission_mark?: number; };

type delete_word_themes_bulk = Database['public']['Functions']['delete_word_themes_bulk']['Returns'];

// add 관련 타입
export interface IAddManager {
    waitWord(insertWaitWordData: { word: string, requested_by: string | null, request_type: "delete"; word_id: number; } | {word: string, requested_by: string | null, request_type: "add"}): Promise<PostgrestSingleResponse<wait_word | null>>;
    waitWordThemes(insertWaitWordThemeData: { wait_word_id: number; theme_id: number; }[]): Promise<PostgrestSingleResponse<null>>
    wordThemesReq(q: {word_id: number, theme_id: number, typez: "add" | "delete", req_by: string | null}[]): Promise<PostgrestSingleResponse<{typez: "add" | "delete"; themes:{name: string}}[]>>
    waitWords(q: {word: string, requested_by: string | null, request_type: "add"}[]): Promise<PostgrestSingleResponse<(wait_word)[]>>;
}

// get 관련 타입
export interface IGetManager{
    allDocs(): Promise<PostgrestSingleResponse<(docs & { users: user | null })[]>>;
    allThemes(): Promise<PostgrestSingleResponse<theme[]>>
    allWaitWords(c?:"add" | "delete"): Promise<PostgrestSingleResponse<(wait_word & {words: word | null; users: user | null})[]>>;
    wordsThemes(wordIds: number[]): Promise<PostgrestSingleResponse<{ theme_id: number; word_id: number; words: word; themes: theme}[]>>
    allWords({ includeAddReq, includeDeleteReq, includeInjung, includeNoInjung, onlyWordChain, lenf }: { includeAddReq?: boolean; includeDeleteReq?: boolean; includeInjung?: boolean; includeNoInjung?: boolean; onlyWordChain?: boolean; lenf?: boolean; }): Promise<{ data: { word: string; noin_canuse: boolean; k_canuse: boolean; status: "ok" | "add" | "delete"; }[]; error: null } | {data: null; error: PostgrestError; }>
    releaseNote(): Promise<PostgrestSingleResponse<{ id: number; content: string; created_at: string; title: string; link: string | null }[]>>;
    usersByNickname(userName: string): Promise<PostgrestSingleResponse<user[]>>;
    logsListById(userId: string): Promise<PostgrestSingleResponse<log[]>>;
    wordsCount(): Promise<{count: number | null; error: PostgrestError | null}>;
    waitWordsCount(): Promise<{count: number | null; error: PostgrestError | null}>;
    wordsByWords(words: string[]): Promise<PostgrestSingleResponse<(okWord&{wthemes: number[]})[]>>;
    logsByFilter({filterState, filterType, from, to}:{filterState?: "approved" | "rejected" | "pending" | "all", filterType: "delete" | "add" | "all", from: number, to: number}): Promise<PostgrestSingleResponse<(log & {make_by_user: { nickname: string; } | null; processed_by_user: { nickname: string | null } | null;})[]>>
    docsLogsByFilter({ docsName, logType, from, to }: { docsName?: string; logType: 'add' | 'delete' | 'all'; from: number; to: number; }): Promise<PostgrestSingleResponse<(docs_log & { docs: docs; users: { nickname: string } | null })[]>>;
    wordsThemesByWordId(wordIds: number[]): Promise<PostgrestSingleResponse<{word_id: number, themes: theme}[]>>;
    allUser(sortField?: 'contribution' | 'month_contribution' | 'nickname', isAsc?: boolean): Promise<PostgrestSingleResponse<user[]>>;
    letterCountInfo(): Promise<{data: {firstLetterCounts: Record<string, {count: number; k_count: number; n_count: number}>; lastLetterCounts: Record<string, {count: number; k_count: number; n_count: number}>;}, error: null}|{data: null; error: PostgrestError}>;
}

// delete 관련 타입
export interface IDeleteManager{
    waitWordById(wordId: number): Promise<PostgrestSingleResponse<null>>;
    wordByIds(wordIds: number[]): Promise<PostgrestSingleResponse<word[]>>;
    wordTheme(deleteQuery: { word_id: number, theme_id: number }[]): Promise<PostgrestSingleResponse<delete_word_themes_bulk>>;
    waitWordThemes(query:{word_id: number, theme_id: number}[]): Promise<PostgrestSingleResponse<undefined>>;
    waitWordsByWords(words: string[]): Promise<PostgrestSingleResponse<null>>;
    logsByIds(ids: number[]): Promise<PostgrestSingleResponse<null>>;
    docsLogsByIds(ids: number[]): Promise<PostgrestSingleResponse<null>>;
}

// update 관련 타입
export interface IUpdateManager{
    userContribution({ userId, amount }: { userId: string, amount?: number }): Promise<PostgrestSingleResponse<undefined>>;
}

// 전체 supabaseManager 타입 
export interface ISupabaseClientManager {
    add(): IAddManager;
    get(): IGetManager;
    delete(): IDeleteManager;
    update(): IUpdateManager;
    getJWT(): Promise<string | null>;
}

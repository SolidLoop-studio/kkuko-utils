import type { addWordQueryType, addWordThemeQueryType, advancedQueryType, DocsLogData, WordLogData } from '@/app/types/type';
import { AuthError, OAuthResponse, PostgrestError, PostgrestSingleResponse, Session, Subscription } from '@supabase/supabase-js';
import type { Database } from '@/app/types/database.types'

type wait_word = Database['public']['Tables']['wait_words']['Row']
type theme = Database['public']['Tables']['themes']['Row']
type wait_word_theme = Database['public']['Tables']['wait_word_themes']['Row'] & { themes: theme; }
type word = Database['public']['Tables']['words']['Row']
type word_theme = {words: word, themes: theme }
type docs = Database['public']['Tables']['docs']['Row']
type user = Database['public']['Tables']['users']['Row'];
type docs_log = Database['public']['Tables']['docs_logs']['Row'];
type docs_wait = Database['public']['Tables']['docs_wait']['Row'] & { users: user | null; }
type user_star_docs = Database['public']['Tables']['user_star_docs']['Row'];
type log = Database['public']['Tables']['logs']['Row'];
type word_themes_wait = Database['public']['Tables']['word_themes_wait']['Row'];
type wait_word_themes = Database['public']['Tables']['wait_word_themes']['Row'];
type notification = Database['public']['Tables']['notification']['Row'];
type word_first_letter_counts = Database['public']['Tables']['word_first_letter_counts']['Row'];
type word_last_letter_counts = Database['public']['Tables']['word_last_letter_counts']['Row'];
type okWord = Omit<word, 'mission_mark'> & { mission_mark?: number; };

type delete_word_themes_bulk = Database['public']['Functions']['delete_word_themes_bulk']['Returns'];

// add 관련 타입
export interface IAddManager {
    docsLog(logsData: DocsLogData[]): Promise<PostgrestSingleResponse<null>>;
    wordLog(logsData: WordLogData[]): Promise<PostgrestSingleResponse<null>>;
    word(insertWordData: addWordQueryType[]): Promise<PostgrestSingleResponse<word[]>>;
    wordThemes(insertWordThemesData: addWordThemeQueryType[]): Promise<PostgrestSingleResponse<word_theme[]>>;
    waitWord(insertWaitWordData: { word: string, requested_by: string | null, request_type: "delete"; word_id: number; } | {word: string, requested_by: string | null, request_type: "add"}): Promise<PostgrestSingleResponse<wait_word | null>>;
    starDocs({ docsId, userId }: { docsId: number; userId: string; }): Promise<PostgrestSingleResponse<null>>;
    waitWordThemes(insertWaitWordThemeData: { wait_word_id: number; theme_id: number; }[]): Promise<PostgrestSingleResponse<null>>
    waitDocs({ docsName, userId }: { docsName: string; userId: string | undefined; }): Promise<PostgrestSingleResponse<null>>;
    docs(insertDocsData: { name: string; maker: string | null; duem: boolean; typez: "letter" | "theme"; }[]): Promise<PostgrestSingleResponse<null>>;
    nickname(userId: string, nick: string): Promise<PostgrestSingleResponse<user>>;
    words(q:addWordQueryType[]): Promise<PostgrestSingleResponse<word[]>>;
    wordsThemes(q: addWordThemeQueryType[]): Promise<PostgrestSingleResponse<{words:{word: string}; themes: {name: string}}[]>>;
    wordThemesReq(q: {word_id: number, theme_id: number, typez: "add" | "delete", req_by: string | null}[]): Promise<PostgrestSingleResponse<{typez: "add" | "delete"; themes:{name: string}}[]>>
    waitWords(q: {word: string, requested_by: string | null, request_type: "add"}[]): Promise<PostgrestSingleResponse<(wait_word)[]>>;
    notification(data: { title: string; body: string; img?: string | null; end_at: string }): Promise<PostgrestSingleResponse<notification>>;
}

// get 관련 타입
export interface IGetManager{
    waitWordInfoByWord(word: string): Promise<PostgrestSingleResponse<wait_word & {users: {nickname: string} | null} | null>>;
    waitWordThemes(wordId: number): Promise<PostgrestSingleResponse<wait_word_theme[]>>;
    wordInfoByWord(word: string): Promise<PostgrestSingleResponse<word & {users: {nickname: string} | null} | null>>;
    allDocs(): Promise<PostgrestSingleResponse<(docs & { users: user | null })[]>>;
    wordThemeByWordId(wordId: number): Promise<PostgrestSingleResponse<word_theme[]>>;
    docsInfoByDocsId(docsId: number): Promise<PostgrestSingleResponse<(docs & { users: user | null }) | null>>
    docsWordCount({ name, duem, typez }: { name: string, duem: boolean, typez: "letter" | "theme" }|{name:number, duem:boolean, typez:"ect"}): Promise<{count: number | null; error: PostgrestError | null;}>
    docsVeiwRankByDocsId(docsId: number): Promise<PostgrestSingleResponse<number>>;
    allThemes(): Promise<PostgrestSingleResponse<theme[]>>
    themeInfoByThemeName(name: string): Promise<{ data: theme | null; error: PostgrestError | null;}>
    docsStarCount(id: number): Promise<{ data: number; error: PostgrestError | null;}>
    docsLogs(id:number): Promise<PostgrestSingleResponse<(docs_log & {users: user | null})[]>>
    docsStar(id: number): Promise<PostgrestSingleResponse<{user_id: string;}[]>>;
    docsWords({ name, duem, typez }: { name: string; duem: boolean; typez: "letter" | "theme";} | {name: number; duem: boolean; typez: "ect";}): Promise<{data: null, error: PostgrestError} | {data: {words: okWord[], waitWords: ({ word: string; request_type: "add" | "delete"; requested_by: string | null; })[]}, error: null}>
    allWaitWords(c?:"add" | "delete"): Promise<PostgrestSingleResponse<(wait_word & {words: word | null; users: user | null})[]>>;
    wordsThemes(wordIds: number[]): Promise<PostgrestSingleResponse<{ theme_id: number; word_id: number; words: word; themes: theme}[]>>
    allWords({ includeAddReq, includeDeleteReq, includeInjung, includeNoInjung, onlyWordChain, lenf }: { includeAddReq?: boolean; includeDeleteReq?: boolean; includeInjung?: boolean; includeNoInjung?: boolean; onlyWordChain?: boolean; lenf?: boolean; }): Promise<{ data: { word: string; noin_canuse: boolean; k_CanUse: boolean; status: "ok" | "add" | "delete"; }[]; error: null } | {data: null; error: PostgrestError; }>
    letterDocs(): Promise<PostgrestSingleResponse<docs[]>>;
    addWaitDocs(): Promise<PostgrestSingleResponse<docs_wait[]>>;
    releaseNote(): Promise<PostgrestSingleResponse<{ id: number; content: string; created_at: string; title: string; link: string | null }[]>>;
    userById(userId: string): Promise<PostgrestSingleResponse<user | null>>;
    session(): Promise<{data: {session: Session}, error: null} | {data: { session: null}, error: AuthError} | { data: {session: null}, error: null}>;
    usersByNickname(userName: string): Promise<PostgrestSingleResponse<user[]>>;
    usersLikeByNickname(q: string): Promise<PostgrestSingleResponse<user[]>>;
    userByNickname(nickname: string): Promise<PostgrestSingleResponse<user | null>>;
    monthlyConRankByUserId(userId: string): Promise<PostgrestSingleResponse<number>>;
    monthlyContributionsByUserId(userId: string): Promise<PostgrestSingleResponse<Database['public']['Tables']['user_month_contributions']['Row'][]>>
    starredDocsById(userId: string): Promise<PostgrestSingleResponse<(user_star_docs & {docs: docs})[]>>;
    requestsListById(userId: string): Promise<PostgrestSingleResponse<wait_word[]>>;
    logsListById(userId: string): Promise<PostgrestSingleResponse<log[]>>;
    wordsCount(): Promise<{count: number | null; error: PostgrestError | null}>;
    waitWordsCount(): Promise<{count: number | null; error: PostgrestError | null}>;
    allWordWaitTheme(c?: "add" | "delete"): Promise<PostgrestSingleResponse<(word_themes_wait & {words: {word: string, id: number}; themes: theme; users: user | null})[]>>
    waitWordsThemes(waitWordIds: number[]): Promise<PostgrestSingleResponse<(wait_word_themes & {themes: theme, wait_words:{word: string}})[]>>;
    wordsByWords(words: string[]): Promise<PostgrestSingleResponse<(okWord&{wthemes: number[]})[]>>;
    randomWordByFirstLetter(f: string[]): Promise<{data: string, error: null}|{data: null, error: PostgrestError}|{data: null, error: null}>;
    randomWordByLastLetter(l: string[]): Promise<{data: string, error: null}|{data: null, error: PostgrestError}|{data: null, error: null}>;
    wordThemeWaitByWordId(wordId: number): Promise<PostgrestSingleResponse<{themes: theme, typez: "add" | "delete"}[]>>;
    letterDocsByWord(word: string): Promise<PostgrestSingleResponse<docs[]>>;
    themeDocsByThemeNames(themeNames: string[]): Promise<PostgrestSingleResponse<docs[]>>;
    firstWordCountByLetters(letter: string): Promise<number>;
    lastWordCountByLetters(letter: string): Promise<number>;
    wordsByQuery(query: string): Promise<{data: string[], error: null} | {data: null; error: PostgrestError}>;
    logsByFilter({filterState, filterType, from, to}:{filterState?: "approved" | "rejected" | "pending" | "all", filterType: "delete" | "add" | "all", from: number, to: number}): Promise<PostgrestSingleResponse<(log & {make_by_user: { nickname: string; } | null; processed_by_user: { nickname: string | null } | null;})[]>>
    docsLogsByFilter({ docsName, logType, from, to }: { docsName?: string; logType: 'add' | 'delete' | 'all'; from: number; to: number; }): Promise<PostgrestSingleResponse<(docs_log & { docs: docs; users: { nickname: string } | null })[]>>;
    notice(): Promise<PostgrestSingleResponse<notification | null>>;
    wordsThemesByWordId(wordIds: number[]): Promise<PostgrestSingleResponse<{word_id: number, themes: theme}[]>>;
    allUser(sortField?: 'contribution' | 'month_contribution' | 'nickname', isAsc?: boolean): Promise<PostgrestSingleResponse<user[]>>;
    letterCountInfo(): Promise<{data: {firstLetterCounts: Record<string, {count: number; k_count: number; n_count: number}>; lastLetterCounts: Record<string, {count: number; k_count: number; n_count: number}>;}, error: null}|{data: null; error: PostgrestError}>;
    wordsByAdvancedQuery(input: advancedQueryType): Promise<{data: {word: string, nextWordCount: number}[], error: null} | {data: null; error: PostgrestError}>;
    wordState(): Promise<{data: {firstLetterCounts: word_first_letter_counts[]; lastLetterCounts: word_last_letter_counts[];}, error: null}|{data: null; error: PostgrestError}>;
    docsLastUpdate(id: number): Promise<PostgrestSingleResponse<{last_update: string;} | null>>
}

// delete 관련 타입
export interface IDeleteManager{
    waitWordById(wordId: number): Promise<PostgrestSingleResponse<null>>;
    wordByWord(word: string): Promise<PostgrestSingleResponse<word[]>>;
    wordById(wordId: number): Promise<PostgrestSingleResponse<word[]>>;
    wordByIds(wordIds: number[]): Promise<PostgrestSingleResponse<word[]>>;
    wordTheme(deleteQuery: { word_id: number, theme_id: number }[]): Promise<PostgrestSingleResponse<delete_word_themes_bulk>>;
    waitWordThemes(query:{word_id: number, theme_id: number}[]): Promise<PostgrestSingleResponse<undefined>>;
    startDocs({ docsId, userId }: { docsId: number; userId: string; }): Promise<PostgrestSingleResponse<null>>;
    waitDocsByIds(id: number[]): Promise<PostgrestSingleResponse<null>>;
    waitWordsByWords(words: string[]): Promise<PostgrestSingleResponse<null>>;
    waitWordsByIds(ids: number[]): Promise<PostgrestSingleResponse<null>>;
    waitWordByWord(word: string): Promise<PostgrestSingleResponse<null>>;
    wordsWaitThemesByIds(ids: number[]): Promise<PostgrestSingleResponse<null>>;
    logsByIds(ids: number[]): Promise<PostgrestSingleResponse<null>>;
    docsLogsByIds(ids: number[]): Promise<PostgrestSingleResponse<null>>;
    notificationById(id: number): Promise<PostgrestSingleResponse<null>>;
}

// update 관련 타입
export interface IUpdateManager{
    userContribution({ userId, amount }: { userId: string, amount?: number }): Promise<PostgrestSingleResponse<undefined>>;
    docsLastUpdate(docs_ids: number[]): Promise<void>;
    docView(id: number): Promise<void>;
    notification(id: number, data: { title?: string; body?: string; img?: string | null; end_at?: string | null }): Promise<PostgrestSingleResponse<notification>>;
}

// 전체 supabaseManager 타입 
export interface ISupabaseClientManager {
    add(): IAddManager;
    get(): IGetManager;
    delete(): IDeleteManager;
    update(): IUpdateManager;
    loginByGoogle(originUrl: string): Promise<OAuthResponse>;
    onAuthStateChange(func: (session: Session | null) => Promise<void>): {data: {subscription: Subscription}}
    logout(): Promise<void>;
}

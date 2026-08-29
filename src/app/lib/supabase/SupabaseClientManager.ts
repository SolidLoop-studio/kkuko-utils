import { ISupabaseClientManager, IAddManager, IGetManager, IDeleteManager, IUpdateManager } from './ISupabaseClientManager';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import { StorageError } from '@supabase/storage-js';

const CACHE_DURATION = 10 * 60 * 1000;

function storageErrorToPostgresError(storageError: StorageError): PostgrestError {
    return {
        name: storageError.name ?? "storage_error",
        message: storageError.message ?? 'Unknown storage error',
        details: "",
        hint: "null",
        code: '500',
    }

}

class AddManager implements IAddManager {
    constructor(private readonly supabase: SupabaseClient<Database>) { }

    public async waitWord(insertWaitWordData: { word: string, requested_by: string | null, request_type: "delete", word_id: number } | { word: string, requested_by: string | null, request_type: "add" }) {
        return await this.supabase.from('wait_words').insert(insertWaitWordData).select('*').maybeSingle();
    }
    public async waitWordThemes(insertWaitWordThemeData: { wait_word_id: number, theme_id: number }[]) {
        return await this.supabase.from('wait_word_themes').insert(insertWaitWordThemeData);
    }
    public async wordThemesReq(q: { word_id: number; theme_id: number; typez: 'add' | 'delete'; req_by: string | null; }[]) {
        return await this.supabase.from('word_themes_wait').upsert(q, { onConflict: "word_id,theme_id", ignoreDuplicates: true }).select('themes(name), typez');
    }
    public async waitWords(q: { word: string; requested_by: string | null; request_type: 'add'; }[]) {
        return this.supabase.from('wait_words').upsert(q, { onConflict: "word", ignoreDuplicates: true }).select('*');
    }

}

class GetManager implements IGetManager {
    constructor(private readonly supabase: SupabaseClient<Database>) { }

    private wordsCache: Record<string, { data: { word: string, noin_canuse: boolean, k_canuse: boolean, status: "ok" | "add" | "delete" }[], time: number }> = {};
    private wordFirstLetterCountsCache: Record<string, {
        count: number;
        k_count: number;
        n_count: number;
        len3_k_count: number;
        len3_n_count: number;
    }> = {};
    private wordLastLetterCountsCache: Record<string, { count: number, k_count: number, n_count: number }> = {};
    private wordLetterCountsCacheTime: number = 0;

    public async allThemes() {
        return await this.supabase.from('themes').select('*');
    }
    public async allWaitWords(c?: "add" | "delete") {
        if (c == "add") {
            return await this.supabase.from('wait_words').select('*,words(*),users(*)').eq('request_type', "add").order('requested_at', { ascending: true });
        }
        else if (c == "delete") {
            return await this.supabase.from('wait_words').select('*,words(*),users(*)').eq('request_type', "delete").order('requested_at', { ascending: true });
        }
        return await this.supabase.from('wait_words').select('*,words(*),users(*)').order('requested_at', { ascending: true });
    }
    public async wordsThemes(wordIds: number[]) {
        return await this.supabase.from('word_themes').select('*,themes(*),words(*)').in('word_id', wordIds);
    }
    public async allWords({ includeAddReq = false, includeDeleteReq = false, includeInjung = true, includeNoInjung = true, onlyWordChain = true, lenf = false }: {
        includeAddReq?: boolean;
        includeDeleteReq?: boolean;
        includeInjung?: boolean;
        includeNoInjung?: boolean;
        onlyWordChain?: boolean;
        lenf?: boolean;
    }) {
        const cacheKey = () => `iar-${includeAddReq}/idr-${includeDeleteReq}/iin-${includeInjung}/ini-${includeNoInjung}/ow-${onlyWordChain}/len-${lenf}`;

        const key = cacheKey();
        const know = Date.now();
        if (this.wordsCache[key] && know - this.wordsCache[key].time < CACHE_DURATION) {
            return { data: this.wordsCache[key].data, error: null }
        }

        // 단어조합기 전용
        if (lenf) {
            const { data: wordsData, error: wordsError } = await this.supabase.from('words').select('word, noin_canuse, k_canuse').in('length', [5, 6]);
            const { data: engData, error: engError } = await this.supabase.storage.from('public_img').download('txt/eng_len_6_words.txt')
            if (wordsError) return { data: null, error: wordsError }
            if (engError) return { data: null, error: storageErrorToPostgresError(engError) }

            const engText = await engData.text();
            const now = Date.now();
            const data = [
                ...wordsData.map(({ word, noin_canuse, k_canuse }) => ({ word, noin_canuse, k_canuse, status: "ok" as const })),
                ...engText.split(/\r?\n/).map(word => ({ word: word.trim(), noin_canuse: false, k_canuse: true, status: "ok" as const }))
            ]
            this.wordsCache[key] = {
                data,
                time: now
            }
            return { data, error: null }
        }

        let query = this.supabase.from('words').select('word, noin_canuse, k_canuse')
        if (includeInjung && includeNoInjung) { }
        else if (includeInjung || !includeNoInjung) {
            query = query.eq('noin_canuse', false);
        }
        else if (includeNoInjung && !includeInjung) {
            query = query.eq('noin_canuse', true);
        }
        if (onlyWordChain) query = query.eq('k_canuse', true);
        const { data: wordsData, error: wordsError } = await query;
        if (wordsError) return { data: null, error: wordsError }

        const { data: waitWordsData, error: waitWordsError } = await this.supabase.from('wait_words').select('word,request_type');
        if (waitWordsError) return { data: null, error: waitWordsError }

        const now = Date.now();
        const data = [
            ...wordsData.map(({ word, noin_canuse, k_canuse }) => ({ word, noin_canuse, k_canuse, status: "ok" as const })),
            ...waitWordsData.map(({ word, request_type }) => ({ word, noin_canuse: false, k_canuse: true, status: request_type }))
        ]
        this.wordsCache[key] = {
            data,
            time: now
        }
        return { data, error: null }
    }
    public async wordsCount() {
        const { data, error } = await this.supabase.from('words_count').select('total_words').single();
        if (error) return { count: null, error };
        return { count: data?.total_words ?? 0, error: null };
    }
    public async waitWordsCount() {
        const { count: count1, error: error1 } = await this.supabase.from('wait_words').select('word', { count: 'exact', head: true });
        const { count: count2, error: error2 } = await this.supabase.from('word_themes_wait').select('word_id', { count: 'exact', head: true });
        if (error1 || error2) return { count: null, error: error1 ?? error2 };
        return { count: (count1 ?? 0) + (count2 ?? 0), error: null };
    }
    public async wordsByWords(words: string[]) {
        return await this.supabase.rpc('get_words_with_themes', { words_input: words });
    }
    public async letterCountInfo() {
        const now = Date.now();
        if (this.wordLetterCountsCacheTime !== 0 && now - this.wordLetterCountsCacheTime < CACHE_DURATION) {
            return {
                data: {
                    firstLetterCounts: this.wordFirstLetterCountsCache,
                    lastLetterCounts: this.wordLastLetterCountsCache
                }, error: null
            }
        }
        const { data: firstLetterCountsData, error: firstLetterCountsError } = await this.supabase.from('word_first_letter_counts').select('*');
        if (firstLetterCountsError) return { data: null, error: firstLetterCountsError }
        const { data: lastLetterCountsData, error: lastLetterCountsError } = await this.supabase.from('word_last_letter_counts').select('*');
        if (lastLetterCountsError) return { data: null, error: lastLetterCountsError }

        const firstLetterCounts: Record<string, { count: number, k_count: number, n_count: number, len3_k_count: number, len3_n_count: number }> = {};
        firstLetterCountsData?.forEach(({ first_letter, count, k_count, n_count, len3_k_count, len3_n_count }) => {
            firstLetterCounts[first_letter] = { count, k_count, n_count, len3_k_count, len3_n_count };
        });
        const lastLetterCounts: Record<string, { count: number, k_count: number, n_count: number }> = {};
        lastLetterCountsData?.forEach(({ last_letter, count, k_count, n_count }) => {
            lastLetterCounts[last_letter] = { count, k_count, n_count };
        });

        this.wordFirstLetterCountsCache = firstLetterCounts;
        this.wordLastLetterCountsCache = lastLetterCounts;
        this.wordLetterCountsCacheTime = now;

        return {
            data: {
                firstLetterCounts,
                lastLetterCounts
            }, error: null
        }
    }
    public async wordsThemesByWordId(wordIds: number[]) {
        return await this.supabase.from('word_themes').select('word_id, themes(*)').in('word_id', wordIds);
    }
    public async allUser(sortField?: 'contribution' | 'month_contribution' | 'nickname', isAsc?: boolean) {
        return await this.supabase.from('users').select('*').order(sortField ?? 'contribution', { ascending: isAsc ?? false });
    }
}

class DeleteManager implements IDeleteManager {
    constructor(private readonly supabase: SupabaseClient<Database>) { }

    public async waitWordById(wordId: number) {
        return await this.supabase.from('wait_words').delete().eq('id', wordId);
    }
    public async wordByIds(wordIds: number[]) {
        return await this.supabase.from('words').delete().in('id', wordIds).select('*');
    }
    public async wordTheme(deleteQuery: { word_id: number, theme_id: number }[]) {
        if (deleteQuery.length === 0) {
            return {
                data: [],
                error: null,
                count: null,
                status: 200,
                statusText: "OK"
            };
        }
        return await this.supabase.rpc('delete_word_themes_bulk', { pairs: deleteQuery });
    }
    public async waitWordThemes(query: { word_id: number, theme_id: number }[]) {
        if (query.length === 0) {
            return {
                data: undefined,
                error: null,
                count: null,
                status: 200,
                statusText: "OK"
            };
        }
        return await this.supabase.rpc('delete_word_themes_wait_bulk', { pairs: query });
    }
    public async waitWordsByWords(words: string[]) {
        return await this.supabase.from('wait_words').delete().in('word', words);
    }
}

class UpdateManager implements IUpdateManager {
    constructor(private readonly supabase: SupabaseClient<Database>) { }

    public async userContribution({ userId, amount = 1 }: { userId: string, amount?: number }) {
        return await this.supabase.rpc('increment_contribution', { target_id: userId, inc_amount: amount });
    }
}

export class SupabaseClientManager implements ISupabaseClientManager {
    private readonly _add: IAddManager;
    private readonly _get: IGetManager;
    private readonly _delete: IDeleteManager;
    private readonly _update: IUpdateManager;

    constructor(private readonly supabase: SupabaseClient<Database>) {
        this._add = new AddManager(supabase);
        this._get = new GetManager(supabase);
        this._delete = new DeleteManager(supabase);
        this._update = new UpdateManager(supabase);
    }

    public add() {
        return this._add;
    }
    public get() {
        return this._get;
    }
    public delete() {
        return this._delete;
    }
    public update() {
        return this._update;
    }

    async getJWT(){
        const { data: { session } } = await this.supabase.auth.getSession();
        return session?.access_token ?? null;
    }
}

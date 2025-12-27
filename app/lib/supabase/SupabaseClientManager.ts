import { ISupabaseClientManager, IAddManager, IGetManager, IDeleteManager, IUpdateManager } from './ISupabaseClientManager';
import type { PostgrestError, PostgrestSingleResponse, Session, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/app/types/database.types';
import type { addWordQueryType, addWordThemeQueryType, DocsLogData, WordLogData, advancedQueryType } from '@/app/types/type';
import DuemLaw, { reverDuemLaw } from '../hangulUtils';
import { sum } from 'es-toolkit';
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

    public async docsLog(logsData: DocsLogData[]) {
        return await this.supabase.from('docs_logs').insert(logsData);
    }
    public async wordLog(logsData: WordLogData[]) {
        return await this.supabase.from('logs').insert(logsData);
    }
    public async word(insertWordData: addWordQueryType[]) {
        return await this.supabase.from('words').insert(insertWordData).select('*');
    }
    public async wordThemes(insertWordThemesData: addWordThemeQueryType[]) {
        return await this.supabase.from('word_themes').upsert(insertWordThemesData, { ignoreDuplicates: true, onConflict: "word_id,theme_id" }).select('words(*),themes(*)');
    }
    public async waitWord(insertWaitWordData: { word: string, requested_by: string | null, request_type: "delete", word_id: number } | { word: string, requested_by: string | null, request_type: "add" }) {
        return await this.supabase.from('wait_words').insert(insertWaitWordData).select('*').maybeSingle();
    }
    public async starDocs({ docsId, userId }: { docsId: number; userId: string; }): Promise<PostgrestSingleResponse<null>> {
        return await this.supabase.from('user_star_docs').insert({ docs_id: docsId, user_id: userId })
    }
    public async waitWordThemes(insertWaitWordThemeData: { wait_word_id: number, theme_id: number }[]) {
        return await this.supabase.from('wait_word_themes').insert(insertWaitWordThemeData);
    }
    public async waitDocs({docsName, userId}: {docsName: string, userId: string|undefined}) {
        return await this.supabase.from('docs_wait').insert({
            docs_name: docsName,
            req_by: userId ?? null,
        })
    }
    public async docs(docsInserQuery:{ name: string, maker: string | null, duem: boolean, typez: "letter" }[]) {
        return await this.supabase.from('docs').insert(docsInserQuery);
    }
    public async nickname(userId: string, nick: string){
        return this.supabase.from("users").insert({ id: userId, nickname: nick.trim()}).select("*").single();
    }
    public async words(q:addWordQueryType[]){
        return this.supabase.from('words').upsert(q, { ignoreDuplicates: true, onConflict: "word" }).select('*');
    }
    public async wordsThemes(q: addWordThemeQueryType[]){
        return await this.supabase.from('word_themes').upsert(q, { ignoreDuplicates: true, onConflict: "word_id,theme_id" }).select('words(word),themes(name)')
    }
    public async wordThemesReq(q: { word_id: number; theme_id: number; typez: 'add' | 'delete'; req_by: string | null; }[]) {
        return await this.supabase.from('word_themes_wait').upsert(q, { onConflict: "word_id,theme_id", ignoreDuplicates: true }).select('themes(name), typez');
    }
    public async waitWords(q: { word: string; requested_by: string | null; request_type: 'add'; }[]) {
        return this.supabase.from('wait_words').upsert(q,{ onConflict: "word", ignoreDuplicates: true }).select('*');
    }
    public async notification(data: { title: string; body: string; img?: string | null; end_at: string }) {
        return await this.supabase.from('notification').insert(data).select('*').single();
    }
    
}

class GetManager implements IGetManager {
    constructor(private readonly supabase: SupabaseClient<Database>) { }

    private wordsCache: Record<string,{data: {word: string, noin_canuse: boolean, k_canuse: boolean, status: "ok" | "add" | "delete"}[], time: number}> = {};
    private wordFirstLetterCountsCache: Record<string, {
        count: number;
        k_count: number;
        n_count: number;
        len3_k_count: number;
        len3_n_count: number;
    }> = {};
    private wordLastLetterCountsCache: Record<string,{count: number, k_count: number, n_count: number}> = {};
    private wordLetterCountsCacheTime: number = 0;

    public async waitWordInfoByWord(word: string) {
        return await this.supabase.from('wait_words').select('*,users(nickname)').eq('word', word).maybeSingle();
    }
    public async waitWordThemes(wordId: number) {
        return await this.supabase.from('wait_word_themes').select('*,themes(*)').eq('wait_word_id', wordId);
    }
    public async wordInfoByWord(word: string) {
        return await this.supabase.from('words').select('*,users(nickname)').eq('word', word).maybeSingle();
    }
    public async allDocs() {
        let q = this.supabase.from('docs').select('*, users(*)');
        if (process.env.NODE_ENV === 'production'){
            q = q.eq('is_hidden', false);
        }
        return await q;
    }
    public async wordThemeByWordId(wordId: number) {
        return await this.supabase.from('word_themes').select('words(*),themes(*)').eq('word_id', wordId);
    }
    public async docsInfoByDocsId(docsId: number) {
        return await this.supabase.from('docs').select('*,users(*)').eq('id', docsId).maybeSingle();
    }
    public async docsWordCount({ name, duem, typez }: { name: string, duem: boolean, typez: "letter" | "theme" }|{name:number, duem:boolean, typez:"ect"}) {
        if (typez === "letter") {
            if (duem) {
                const { data, error } = await this.supabase.from('word_last_letter_counts').select('count').in('last_letter', reverDuemLaw(name[0]));
                return { count: sum(data?.map(({ count }) => count) ?? []) ?? 0, error }
            } else {
                const { data, error } = await this.supabase.from('word_last_letter_counts').select('count').eq('last_letter', name[0]).maybeSingle();
                return { count: data?.count ?? 0, error }
            }
        }
        else if (typez === "theme") {
            const { data: themeData, error: themeDataError } = await this.themeInfoByThemeName(name)
            if (themeDataError || !themeData) return { count: 0, error: themeDataError }
            const { count, error } = await this.supabase.from('word_themes').select('*', { count: 'exact', head: true }).eq('theme_id', themeData.id);
            return { count, error }
        } else if (typez === "ect") {
            if (name === 201 || name === 202) {
                const { count, error } = await this.supabase.from('words').select('*', { count: 'exact', head: true }).eq('k_canuse', true).gt('length', 8);
                return { count, error };
            } else {
                return { count: 0, error: { name: "unexcept", details: "", code: "", message: "", hint: "" } as PostgrestError }
            }
        } else {
            return { count: 0, error: { name: "unexcept", details: "", code: "", message: "", hint: "" } as PostgrestError }
        }
    }
    public async docsVeiwRankByDocsId(docsId: number) {
        return await this.supabase.rpc('get_doc_rank', { doc_id: docsId })
    }
    public async allThemes() {
        return await this.supabase.from('themes').select('*');
    }
    public async themeInfoByThemeName(name: string) {
        const { data, error } = await this.supabase.from('themes').select('*').eq('name', name).maybeSingle();
        return { data, error }
    }
    public async docsStarCount(id: number) {
        const { data, error } = await this.supabase.from('user_star_docs').select('*').eq('docs_id', id);
        return { data: data?.length ?? 0, error };
    }
    public async docsLogs(id: number) {
        return await this.supabase.from("docs_logs").select("*, users(*)").eq("docs_id", id).order("date", { ascending: false });
    }
    public async docsStar(id: number) {
        return await this.supabase.from('user_star_docs').select('user_id').eq('docs_id', id);
    }
    public async docsWords({ name, duem, typez }: { name: string, duem: boolean, typez: "letter" | "theme" } | { name: number, duem: boolean, typez: "ect" }) {
        if (typez === "letter") {
            if (duem) {
                const { data: wordsData, error: wordsError } = await this.supabase.from('words').select('*').in('last_letter', [...new Set([...reverDuemLaw(name[0]), DuemLaw(name[0])])]).eq('k_canuse', true).neq('length', 1); 
                if (wordsError) return { data: null, error: wordsError }
                let q = this.supabase.from('wait_words').select('word,requested_by,request_type');
                for (const l of reverDuemLaw(name[0])) {
                    q = q.ilike('word', `%${l}`)
                }
                const { data: waitWordsData, error: waitWordsError } = await q;
                if (waitWordsError) return { data: null, error: waitWordsError }
                return { data: { words: wordsData, waitWords: waitWordsData }, error: null }
            } else {
                const { data: wordsData, error: wordsError } = await this.supabase.from('words').select('*').eq('last_letter', name[0]).eq('k_canuse', true).neq('length', 1);
                if (wordsError) return { data: null, error: wordsError }
                const { data: waitWordsData, error: waitWordsError } = await this.supabase.from('wait_words').select('word,requested_by,request_type').ilike('word', `${name.trim()[0]}`)
                if (waitWordsError) return { data: null, error: waitWordsError }
                return { data: { words: wordsData, waitWords: waitWordsData }, error: null }
            }
        }
        else if (typez === "theme") {
            const { data: themeData, error: themeDataError } = await this.themeInfoByThemeName(name)
            if (themeDataError) return { data: null, error: themeDataError };
            if (!themeData) return { data: { words: [], waitWords: [] }, error: null }
            const { data: wordsData, error: wordsError } = await this.supabase.rpc('get_words_by_theme', { theme_name: name });
            const { data: waitWordsData1, error: waitWordsError1 } = await this.supabase.from('word_themes_wait').select('words(*),typez,req_by').eq('theme_id', themeData.id);
            const { data: waitAddWordsData2, error: waitAddWordsError2 } = await this.supabase.from('wait_word_themes').select('wait_words(word,requested_by,request_type)').eq('theme_id', themeData.id);
            const { data: waitDelWordsData, error: waitDelWordsError } = await this.supabase.rpc('get_delete_requests_by_themeid', { input_theme_id: themeData.id })

            if (wordsError) return { data: null, error: wordsError }
            if (waitWordsError1) return { data: null, error: waitWordsError1 }
            if (waitAddWordsError2) return { data: null, error: waitAddWordsError2 }
            if (waitDelWordsError) return { data: null, error: waitDelWordsError }
            const Data1Set = new Set(waitWordsData1.map(({ words }) => words.word))
            const waitWords: {
                word: string;
                requested_by: string | null;
                request_type: "add" | "delete";
            }[] = waitAddWordsData2
                .filter(({ wait_words: { request_type } }) => request_type === "add")
                .map(({ wait_words }) => wait_words);
            waitWordsData1.forEach(({ words: { word }, typez, req_by }) => {
                if (!Data1Set.has(word)) {
                    waitWords.push({ word, requested_by: req_by, request_type: typez })
                }
            })
            waitWords.push(...waitDelWordsData)

            return { data: { words: wordsData.filter(({ word }) => !waitWords.some(w => word === w.word)), waitWords }, error: null }
        } else if (typez === "ect") {
            if (name === 201 || name === 202) {
                const { data: wordsData, error: wordsError } = await this.supabase.from('words').select('*').eq('k_canuse', true).gt('length', 8);
                if (wordsError) return { data: null, error: wordsError }
                const { data: waitWordsData, error: waitWordsError } = await this.supabase.rpc('get_long_wait_words_data');
                if (waitWordsError) return { data: null, error: waitWordsError }
                return { data: { words: wordsData.filter(({ word }) => !waitWordsData.some(w => word === w.word)), waitWords: waitWordsData }, error: null }
            }
            return { data: null, error: { name: "unexcept", details: "", code: "", message: "", hint: "" } as PostgrestError }
        } else {
            return { data: null, error: { name: "unexcept", details: "", code: "", message: "", hint: "" } as PostgrestError }
        }
    }
    public async allWaitWords(c?:"add" | "delete") {
        if (c=="add"){
            return await this.supabase.from('wait_words').select('*,words(*),users(*)').eq('request_type',"add").order('requested_at', { ascending: true });
        }
        else if (c=="delete"){
            return await this.supabase.from('wait_words').select('*,words(*),users(*)').eq('request_type',"delete").order('requested_at', { ascending: true });
        }
        return await this.supabase.from('wait_words').select('*,words(*),users(*)').order('requested_at', { ascending: true });
    }
    public async wordsThemes(wordIds: number[]) {
        return await this.supabase.from('word_themes').select('*,themes(*),words(*)').in('word_id', wordIds);
    }
    public async allWords({ includeAddReq=false, includeDeleteReq=false, includeInjung=true, includeNoInjung=true, onlyWordChain=true, lenf=false }: {
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
        if (this.wordsCache[key] && know - this.wordsCache[key].time < CACHE_DURATION){
            return {data: this.wordsCache[key].data, error: null}
        }

        // 단어조합기 전용
        if (lenf){
            const {data:wordsData, error: wordsError} = await this.supabase.from('words').select('word, noin_canuse, k_canuse').in('length', [5, 6]);
            const { data: engData, error: engError } = await this.supabase.storage.from('public_img').download('txt/eng_len_6_words.txt')
            if (wordsError) return {data: null, error: wordsError}
            if (engError) return {data: null, error: storageErrorToPostgresError(engError)}

            const engText = await engData.text();
            const now = Date.now();
            const data = [
                ...wordsData.map(({word,noin_canuse,k_canuse})=>({word,noin_canuse,k_canuse,status: "ok" as const})),
                ...engText.split(/\r?\n/).map(word => ({word: word.trim(), noin_canuse: false, k_canuse: true, status: "ok" as const}))
            ]
            this.wordsCache[key] = {
                data,
                time:now
            }
            return {data, error:null}
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
        const {data:wordsData, error: wordsError} = await query;
        if (wordsError) return {data: null, error: wordsError}

        const { data: waitWordsData, error: waitWordsError } = await this.supabase.from('wait_words').select('word,request_type');
        if (waitWordsError) return {data: null, error: waitWordsError}

        const now = Date.now();
        const data = [
            ...wordsData.map(({word,noin_canuse,k_canuse})=>({word,noin_canuse,k_canuse,status: "ok" as const})),
            ...waitWordsData.map(({word,request_type})=>({word,noin_canuse:false, k_canuse:true, status: request_type}))
        ]
        this.wordsCache[key] = {
            data,
            time:now
        }
        return {data, error:null}
    }
    public async letterDocs(){
        return await this.supabase.from('docs').select('*').eq('typez','letter');
    }
    public async addWaitDocs(){
        return await this.supabase.from('docs_wait').select('*,users(*)');
    }
    public async releaseNote(){
        return await this.supabase.from('release_note').select('*').order('created_at', { ascending: false });
    }
    public async userById(userId: string) {
        return await this.supabase.from('users').select('*').eq('id', userId).maybeSingle();
    }
    public async session(){
        return await this.supabase.auth.getSession();
    }
    public async usersByNickname(userName: string){
        return await this.supabase.from("users").select("*").eq("nickname", userName.trim())
    }
    public async usersLikeByNickname(q: string){
        return this.supabase.from("users").select("*").ilike("nickname", `%${q}%`);
    }
    public async userByNickname(nickname: string){
        return await this.supabase.from('users').select('*').eq('nickname',nickname).maybeSingle();
    }
    public async monthlyConRankByUserId(userId: string){
        return await this.supabase.rpc("get_user_monthly_rank",{ uid: userId });
    }
    public async monthlyContributionsByUserId(userId: string){
        return await this.supabase.from('user_month_contributions').select('*').eq('user_id',userId).limit(4);
    }
    public async starredDocsById(userId: string){
        return await this.supabase.from("user_star_docs").select("*,docs(*)").eq("user_id", userId);
    }
    public async requestsListById(userId: string){
        return await this.supabase.from("wait_words").select("*").eq("requested_by", userId).order("requested_at", { ascending: false }).limit(30);
    }
    public async logsListById(userId: string){
        return await this.supabase.from("logs").select("*").eq("make_by", userId).order("created_at", { ascending: false }).limit(30);
    }
    public async wordsCount(){
        const {data, error} = await this.supabase.from('words_count').select('total_words').single();
        if (error) return {count: null, error};
        return {count: data?.total_words ?? 0, error: null};
    }
    public async waitWordsCount() {
        const {count: count1, error: error1} = await this.supabase.from('wait_words').select('word',{ count: 'exact', head: true });
        const {count: count2, error: error2} = await this.supabase.from('word_themes_wait').select('word_id', { count: 'exact', head: true });
        if (error1 || error2) return {count: null, error: error1 ?? error2};
        return {count: (count1 ?? 0) + (count2 ?? 0), error: null};
    }
    public async allWordWaitTheme(c?: "add" | "delete") {
        if (c=="add"){
            return await this.supabase.from('word_themes_wait').select('*,words(word,id),themes(*),users(*)').eq('typez','add');
        }
        else if (c=="delete"){
            return await this.supabase.from('word_themes_wait').select('*,words(word,id),themes(*),users(*)').eq('typez',"delete")    
        }
        return await this.supabase.from('word_themes_wait').select('*,words(word,id),themes(*),users(*)');
    }
    public async waitWordsThemes(waitWordIds: number[]) {
        return await this.supabase.from('wait_word_themes').select('*,themes(*),wait_words(word)').in('wait_word_id', waitWordIds)
    }
    public async wordsByWords(words: string[]){
        return await this.supabase.rpc('get_words_with_themes',{words_input: words});
    }
    public async randomWordByFirstLetter(f: string[]) {
        const {data,error} = await this.supabase.rpc('random_word_ff',{fir1: f});
        if (error) return {data: null, error}
        const {data:data2, error:error2} = await this.supabase.rpc('random_wait_word_ff',{prefixes: f});
        if (error2) return {data: null, error: error2}
        if (data.length > 0) return {data: data[0].word, error: null}
        else if (data2.length > 0) return {data: data2[0].word, error: null}
        else return {data: null, error: null}
    }
    public async randomWordByLastLetter(l: string[]) {
        const {data, error} = await this.supabase.rpc('random_word_ll',{fir1:l})
        if (error) return {data: null, error}
        const {data:data2, error:error2} = await this.supabase.rpc('random_wait_word_ll',{prefixes: l}) 
        if (error2) return {data: null, error: error2}
        if (data.length > 0) return {data: data[0].word, error: null};
        if (data2.length > 0) return {data: data2[0].word, error: null}
        return {data: null, error: null};
    }
    public async wordThemeWaitByWordId(wordId: number) {
        return await this.supabase.from('word_themes_wait').select('themes(*), typez').eq('word_id', wordId)
    }
    public async letterDocsByWord(word: string){
        return await this.supabase.from('docs').select('*').eq('name',word[word.length - 1]).eq('typez','letter');
    }
    public async themeDocsByThemeNames(themeNames: string[]){
        return this.supabase.from('docs').select('*').eq('typez','theme').in('name',themeNames);
    }
    public async firstWordCountByLetters(letter: string) {
        const { data: firWordsCount1, error: firWordsError1 } = await this.supabase
                .from('word_last_letter_counts')
                .select('*')
                .eq('last_letter', letter);
                
        const { count: firWordsCount2, error: firWordsError2 } = await this.supabase
            .from('wait_words')
            .select('*', { count: 'exact', head: true })
            .or(reverDuemLaw(letter).map(c => `word.ilike.%${c}`).join(','));
        
        if (firWordsError1 || firWordsError2) return 0;

        return (sum((firWordsCount1 ?? []).map(({count})=>count))) + (firWordsCount2 || 0);
    }
    public async lastWordCountByLetters(letter: string) {
        const { data: lasWordsCount1, error: lasWordsError1 } = await this.supabase
                .from('word_first_letter_counts')
                .select('*')
                .eq('first_letter', letter);

        const { count: lasWordsCount2, error: lasWordsError2 } = await this.supabase
            .from('wait_words')
            .select('*', { count: 'exact', head: true })
            .or([...new Set([letter,DuemLaw(letter)])].map(c => `word.ilike.${c}%`).join(','));
        
        if (lasWordsError1 || lasWordsError2) return 0;

        return (sum((lasWordsCount1 ?? []).map(({count})=>count))) + (lasWordsCount2 || 0)
    }
    public async wordsByQuery(query: string) {
        const startTime = Date.now();

        const cleanQuery = query.trim().replace(/[^ㄱ-힣a-zA-Z0-9]/g, '');

        const { data: getWords, error: getWordsError } = await this.supabase
            .from('words')
            .select('word')
            .ilike('word', `${cleanQuery}%`);
        if (getWordsError) return { data: null, error: getWordsError };

        const { data: getWaitWords, error: getWaitWordsError } = await this.supabase
            .from('wait_words')
            .select('word')
            .ilike('word', `${cleanQuery}%`);
        if (getWaitWordsError) return { data: null, error: getWaitWordsError };

        const words = getWords.map((item) => item.word) || [];
        const waitWords = getWaitWords.map((item) => item.word) || [];
        const allWords = [...words];
        const wordsSet = new Set(words);
        waitWords.forEach((word) => {
            if (!wordsSet.has(word)) {
                allWords.push(word);
            }
        });

        const result = { data: allWords.sort((a, b) => a.length - b.length), error: null };

        const elapsed = Date.now() - startTime;
        const remaining = 2000 - elapsed;
        if (remaining > 0) {
            await new Promise((resolve) => setTimeout(resolve, remaining));
        }

        return result;
    }

    public async letterCountInfo(){
        const now = Date.now();
        if (this.wordLetterCountsCacheTime !== 0 && now - this.wordLetterCountsCacheTime < CACHE_DURATION){
            return {data: {
                firstLetterCounts: this.wordFirstLetterCountsCache,
                lastLetterCounts: this.wordLastLetterCountsCache
            }, error: null}
        }
        const { data: firstLetterCountsData, error: firstLetterCountsError } = await this.supabase.from('word_first_letter_counts').select('*');
        if (firstLetterCountsError) return {data: null, error: firstLetterCountsError}
        const { data: lastLetterCountsData, error: lastLetterCountsError } = await this.supabase.from('word_last_letter_counts').select('*');
        if (lastLetterCountsError) return {data: null, error: lastLetterCountsError}

        const firstLetterCounts: Record<string,{count: number, k_count: number, n_count: number, len3_k_count: number, len3_n_count: number}> = {};
        firstLetterCountsData?.forEach(({ first_letter, count, k_count, n_count, len3_k_count, len3_n_count }) => {
            firstLetterCounts[first_letter] = { count, k_count, n_count, len3_k_count, len3_n_count };
        });
        const lastLetterCounts: Record<string,{count: number, k_count: number, n_count: number}> = {};
        lastLetterCountsData?.forEach(({ last_letter, count, k_count, n_count }) => {
            lastLetterCounts[last_letter] = { count, k_count, n_count };
        });

        this.wordFirstLetterCountsCache = firstLetterCounts;
        this.wordLastLetterCountsCache = lastLetterCounts;
        this.wordLetterCountsCacheTime = now;

        return {data: {
            firstLetterCounts,
            lastLetterCounts
        }, error: null}
    }
    public async wordsByAdvancedQuery(input: advancedQueryType) {
        const startTime = Date.now(); // 시작 시간 기록

        const { data: letterData, error: letterError } = await this.letterCountInfo();
        if (letterError) return { data: null, error: letterError };

        let result: {data: {word: string, nextWordCount: number}[], error: null} | {data: null; error: PostgrestError} = { data: [], error: null };

        switch (input.mode) {
            case 'kor-start': {
                const { data, error } = await this.supabase.rpc('get_korean_words_advanced_s', {
                    p_start: input.start,
                    p_end: input.end,
                    p_length_max: input.length_max,
                    p_length_min: input.length_min,
                    p_man: input.man,
                    p_eti: input.eti,
                    p_jen: input.jen,
                    p_ingjung: input.ingjung,
                    p_limit: input.limit,
                    p_mission: input.mission,
                    p_sort_by: input.sort_by,
                    p_duem: input.duem
                });
                if (error) return { data: null, error };
                result.data = data.map((word) => ({
                    word: word.word,
                    nextWordCount: letterData.firstLetterCounts[word.word[word.word.length - 1]]?.[input.ingjung ? 'k_count' : 'n_count'] ?? 0
                }));
                break;
            }
            case 'kor-end': {
                const { data, error } = await this.supabase.rpc('get_korean_words_advanced_e', {
                    p_start: input.start,
                    p_end: input.end,
                    p_length_max: input.length_max,
                    p_length_min: input.length_min,
                    p_man: input.man,
                    p_eti: input.eti,
                    p_jen: input.jen,
                    p_ingjung: input.ingjung,
                    p_limit: input.limit,
                    p_mission: input.mission,
                    p_sort_by: input.sort_by,
                    p_duem: input.duem
                });
                if (error) return { data: null, error };
                result.data = data.map((word) => ({
                    word: word.word,
                    nextWordCount: letterData.lastLetterCounts[word.word[0]]?.[input.ingjung ? 'k_count' : 'n_count'] ?? 0
                }));
                break;
            }
            case 'kung': {
                const { data, error } = await this.supabase.rpc('get_korean_words_advanced_kung', {
                    p_start: input.start,
                    p_end: input.end,
                    p_man: input.man,
                    p_eti: input.eti,
                    p_jen: input.jen,
                    p_ingjung: input.ingjung,
                    p_limit: input.limit,
                    p_mission: input.mission,
                    p_sort_by: input.sort_by
                });
                if (error) return { data: null, error };
                result.data = data.map((word) => ({
                    word: word.word,
                    nextWordCount: letterData.firstLetterCounts[word.word[word.word.length - 1]]?.[input.ingjung ? 'len3_k_count' : 'len3_n_count'] ?? 0
                }));
                break;
            }
            case 'hunmin': {
                const { data, error } = await this.supabase.rpc('get_korean_words_advanced_hunmin', {
                    p_chosungs: input.query,
                    p_limit: input.limit,
                    p_mission: input.mission === '' ? undefined : input.mission
                });
                if (error) return { data: null, error };
                result.data = data.map((word) => ({ word: word.word, nextWordCount: -1 }));
                break;
            }
            case 'jaqi': {
                const { data, error } = await this.supabase.rpc('get_korean_words_advanced_jaqi', {
                    p_chosungs: input.query,
                    p_theme_id: input.theme
                });
                if (error) return { data: null, error };
                result.data = data
                    .sort((a, b) => b.word.length - a.word.length)
                    .map((word) => ({ word: word.word, nextWordCount: -1 }));
                break;
            }
            default:
                result.data = [];
                result.error = null;
        }

        // 최소 2초 맞추기
        const elapsed = Date.now() - startTime;
        const remaining = 2000 - elapsed;
        if (remaining > 0) {
            await new Promise((resolve) => setTimeout(resolve, remaining));
        }

        return result;
    }

    public async logsByFilter({ filterState, filterType, from, to }: { filterState: 'approved' | 'rejected' | 'pending' | 'all'; filterType: 'delete' | 'add' | 'all'; from: number; to: number; }) {
        let query = this.supabase
            .from('logs')
            .select(`
                *,
                make_by_user:users!logs_make_by_fkey(nickname),
                processed_by_user:users!logs_processed_by_fkey(nickname)
            `, { count: 'exact' })
            .order('created_at', { ascending: false });

        if (filterState !== "all") {
            query = query.eq('state', filterState);
        }
        if (filterType !== "all") {
            query = query.eq('r_type', filterType);
        }
        query = query.range(from, to);

        return await query;
    }
    public async docsLogsByFilter({ docsName, logType, from, to }: { docsName?: string; logType: 'add' | 'delete' | 'all'; from: number; to: number; }) {
        let query = this.supabase
            .from('docs_logs')
            .select(`
                *,
                docs(*),
                users(nickname)
            `, { count: 'exact' })
            .order('date', { ascending: false });

        if (docsName && docsName !== "all") {
            query = query.eq('docs.name', docsName);
        }
        if (logType !== "all") {
            query = query.eq('type', logType);
        }
        query = query.range(from, to);

        return await query;
    }
    public async notice(){
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return await this.supabase.from('notification').select('*').gte('end_at', today.toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
    }
    public async wordsThemesByWordId(wordIds: number[]) {
        return await this.supabase.from('word_themes').select('word_id, themes(*)').in('word_id', wordIds);
    }
    public async allUser(sortField?: 'contribution' | 'month_contribution' | 'nickname', isAsc?: boolean) {
        return await this.supabase.from('users').select('*').order(sortField ?? 'contribution', { ascending: isAsc ?? false });
    }
    public async wordState(){
        const {data: data1, error: error1} = await this.supabase.from('word_first_letter_counts').select('*');
        const {data: data2, error: error2} = await this.supabase.from('word_last_letter_counts').select('*');
        if (error1) return {data: null, error: error1};
        if (error2) return {data: null, error: error2};
        
        return {data: {firstLetterCounts: data1, lastLetterCounts: data2}, error: null};
    }
    
}

class DeleteManager implements IDeleteManager {
    constructor(private readonly supabase: SupabaseClient<Database>) { }

    public async waitWordById(wordId: number) {
        return await this.supabase.from('wait_words').delete().eq('id', wordId);
    }
    public async wordByWord(word: string) {
        return await this.supabase.from('words').delete().eq('word', word).select('*');
    }
    public async wordById(wordId: number) {
        return await this.supabase.from('words').delete().eq('id', wordId).select('*');
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
    public async startDocs({ docsId, userId }: { docsId: number, userId: string }) {
        return await this.supabase.from('user_star_docs').delete().eq('docs_id', docsId).eq('user_id', userId);
    }
    public async waitDocsByIds(id: number[]) {
        return await this.supabase.from('docs_wait').delete().in('id', id);
    }
    public async waitWordsByWords(words: string[]){
        return await this.supabase.from('wait_words').delete().in('word', words);
    }
    public async waitWordsByIds(ids: number[]) {
        return await this.supabase.from('wait_words').delete().in('id',ids);
    }
    public async waitWordByWord(word: string) {
        return await this.supabase.from('wait_words').delete().eq("word", word)
    }
    public async wordsWaitThemesByIds(ids: number[]){
        return await this.supabase.from('word_themes_wait').delete().in('word_id', ids);
    }
    public async logsByIds(ids: number[]) {
        return await this.supabase.from('logs').delete().in('id', ids);
    }
    public async docsLogsByIds(ids: number[]) {
        return await this.supabase.from('docs_logs').delete().in('id', ids);
    }
    public async notificationById(id: number) {
        return await this.supabase.from('notification').delete().eq('id', id);
    }
}

class UpdateManager implements IUpdateManager {
    constructor(private readonly supabase: SupabaseClient<Database>) { }

    public async userContribution({ userId, amount = 1 }: { userId: string, amount?: number }) {
        return await this.supabase.rpc('increment_contribution', { target_id: userId, inc_amount: amount });
    }
    public async docsLastUpdate(docs_ids: number[]) {
        await this.supabase.rpc('update_last_updates', { docs_ids });
    }
    public async docView(id: number): Promise<void> {
        await this.supabase.rpc('increment_doc_views', { doc_id: id })
    }
    public async notification(id: number, data: { title?: string; body?: string; img?: string | null; end_at: string}) {
        return await this.supabase.from('notification').update(data).eq('id', id).select('*').single();
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
    public async loginByGoogle(originUrl: string){
        return await this.supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${originUrl}/api/auth/callback`, 
            },
        });
    }
    public onAuthStateChange(func: (session: Session | null) => Promise<void>){
        return this.supabase.auth.onAuthStateChange(async (_event, session) => {
            try{
                await func(session)
            }
            finally { }
        });
    }
    public async logout(){
        await this.supabase.auth.signOut()
    }
    
    // 이미지 업로드 기능
    public async uploadImage(file: File, path: string) {
        return await this.supabase.storage
            .from('public_img')
            .upload(path, file, {
                cacheControl: '3600',
                upsert: false
            });
    }
    
    // 이미지 삭제 기능
    public async deleteImage(path: string) {
        return await this.supabase.storage
            .from('public_img')
            .remove([path]);
    }
    
    // 공개 URL 가져오기
    public getPublicUrl(path: string) {
        return this.supabase.storage
            .from('public_img')
            .getPublicUrl(path);
    }
}

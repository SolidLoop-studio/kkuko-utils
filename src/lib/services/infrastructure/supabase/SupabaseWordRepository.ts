import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import type { advancedQueryType } from '@/src/app/types/type';
import type { IWordRepository } from '../../domain/word/WordRepository';
import type { CustomError } from '../../domain/result';
import type { Result } from '../../domain/result';
import type {
    WordEntity,
    WordWithUser,
    NewWord,
    WordListItem,
    WordFilter,
    WordWithThemeIds,
    LetterCountInfo,
} from '../../domain/word/WordEntity';
import { success, failure } from '../../domain/result';
import { infrastructureError } from '../../domain/errors';
import { StorageError } from '@supabase/storage-js';
import { sum } from 'es-toolkit';

type WordRow = Database['public']['Tables']['words']['Row'];

/**
 * StorageError를 CustomError로 변환합니다.
 *
 * @param storageError - Supabase StorageError
 * @returns CustomError
 */
function storageErrorToCustomError(storageError: StorageError): CustomError {
    return infrastructureError({
        message: storageError.message ?? 'Unknown storage error',
        code: '500',
    });
}

/**
 * DB Row를 WordEntity 도메인 객체로 변환합니다.
 *
 * @param row - words 테이블 Row
 * @returns WordEntity
 */
function toWordEntity(row: WordRow): WordEntity {
    return {
        id: row.id,
        word: row.word,
        length: row.length,
        firstLetter: row.first_letter,
        lastLetter: row.last_letter,
        noinCanuse: row.noin_canuse,
        kCanuse: row.k_canuse,
        missionMark: row.mission_mark,
        chosungs: row.chosungs,
        addedBy: row.added_by,
        addedAt: row.added_at,
    };
}

/**
 * Supabase 기반 IWordRepository 구현체
 *
 * GetManager, AddManager, DeleteManager에서 words 테이블 관련 쿼리를 추출하여 구현합니다.
 */
export class SupabaseWordRepository implements IWordRepository {
    constructor(private readonly supabase: SupabaseClient<Database>) {}

    /** @inheritdoc */
    async findByWord(word: string): Promise<Result<WordWithUser | null, CustomError>> {
        const { data, error } = await this.supabase
            .from('words')
            .select('*,users(nickname)')
            .eq('word', word)
            .maybeSingle();

        if (error) return failure(infrastructureError(error));

        if (!data) return success(null);

        return success({
            ...toWordEntity(data),
            userNickname: data.users?.nickname ?? null,
        });
    }

    /** @inheritdoc */
    async findByWords(words: string[]): Promise<Result<WordWithThemeIds[], CustomError>> {
        const { data, error } = await this.supabase.rpc('get_words_with_themes', { words_input: words });

        if (error) return failure(infrastructureError(error));

        return success(
            (data ?? []).map((row) => ({
                id: row.id,
                word: row.word,
                length: row.length,
                firstLetter: row.first_letter,
                lastLetter: row.last_letter,
                noinCanuse: row.noin_canuse,
                kCanuse: row.k_canuse,
                missionMark: 0,
                chosungs: row.chosungs,
                addedBy: row.added_by,
                addedAt: row.added_at,
                themeIds: row.wthemes ?? [],
            }))
        );
    }

    /** @inheritdoc */
    async findByPrefix(query: string): Promise<Result<string[], CustomError>> {
        const cleanQuery = query.trim().replace(/[^ㄱ-힣a-zA-Z0-9]/g, '');

        const { data, error } = await this.supabase
            .from('words')
            .select('word')
            .ilike('word', `${cleanQuery}%`);

        if (error) return failure(infrastructureError(error));

        return success((data ?? []).map((item) => item.word));
    }

    /** @inheritdoc */
    async findAdvanced(input: advancedQueryType): Promise<Result<{ word: string }[], CustomError>> {
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
                    p_duem: input.duem,
                });
                if (error) return failure(infrastructureError(error));
                return success(data ?? []);
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
                    p_duem: input.duem,
                });
                if (error) return failure(infrastructureError(error));
                return success(data ?? []);
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
                    p_sort_by: input.sort_by,
                });
                if (error) return failure(infrastructureError(error));
                return success(data ?? []);
            }
            case 'hunmin': {
                const { data, error } = await this.supabase.rpc('get_korean_words_advanced_hunmin', {
                    p_chosungs: input.query,
                    p_limit: input.limit,
                    p_mission: input.mission === '' ? undefined : input.mission,
                });
                if (error) return failure(infrastructureError(error));
                return success(data ?? []);
            }
            case 'jaqi': {
                const { data, error } = await this.supabase.rpc('get_korean_words_advanced_jaqi', {
                    p_chosungs: input.query,
                    p_theme_id: input.theme,
                });
                if (error) return failure(infrastructureError(error));
                return success((data ?? []).sort((a, b) => b.word.length - a.word.length));
            }
            default:
                return success([]);
        }
    }

    /** @inheritdoc */
    async findRandomByFirstLetter(firstLetters: string[]): Promise<Result<string | null, CustomError>> {
        const { data, error } = await this.supabase.rpc('random_word_ff', { fir1: firstLetters });
        if (error) return failure(infrastructureError(error));

        const { data: data2, error: error2 } = await this.supabase.rpc('random_wait_word_ff', { prefixes: firstLetters });
        if (error2) return failure(infrastructureError(error2));

        if (data.length > 0) return success(data[0].word);
        if (data2.length > 0) return success(data2[0].word);
        return success(null);
    }

    /** @inheritdoc */
    async findRandomByLastLetter(lastLetters: string[]): Promise<Result<string | null, CustomError>> {
        const { data, error } = await this.supabase.rpc('random_word_ll', { fir1: lastLetters });
        if (error) return failure(infrastructureError(error));

        const { data: data2, error: error2 } = await this.supabase.rpc('random_wait_word_ll', { prefixes: lastLetters });
        if (error2) return failure(infrastructureError(error2));

        if (data.length > 0) return success(data[0].word);
        if (data2.length > 0) return success(data2[0].word);
        return success(null);
    }

    /** @inheritdoc */
    async findAllForCombiner(): Promise<Result<WordListItem[], CustomError>> {
        const { data: wordsData, error: wordsError } = await this.supabase
            .from('words')
            .select('word, noin_canuse, k_canuse')
            .in('length', [5, 6]);

        if (wordsError) return failure(infrastructureError(wordsError));

        const { data: engData, error: engError } = await this.supabase.storage
            .from('public_img')
            .download('txt/eng_len_6_words.txt');

        if (engError) return failure(storageErrorToCustomError(engError));

        const engText = await engData.text();
        const result: WordListItem[] = [
            ...wordsData.map(({ word, noin_canuse, k_canuse }) => ({
                word,
                noinCanuse: noin_canuse,
                kCanuse: k_canuse,
                status: 'ok' as const,
            })),
            ...engText
                .split(/\r?\n/)
                .filter((w) => w.trim())
                .map((word) => ({
                    word: word.trim(),
                    noinCanuse: false,
                    kCanuse: true,
                    status: 'ok' as const,
                })),
        ];

        return success(result);
    }

    /** @inheritdoc */
    async findAll(filter: WordFilter): Promise<Result<WordListItem[], CustomError>> {
        const {
            includeInjung = true,
            includeNoInjung = true,
            onlyWordChain = true,
        } = filter;

        let query = this.supabase.from('words').select('word, noin_canuse, k_canuse');

        if (includeInjung && includeNoInjung) {
            // 둘 다 포함 → 필터 없음
        } else if (includeInjung || !includeNoInjung) {
            query = query.eq('noin_canuse', false);
        } else if (includeNoInjung && !includeInjung) {
            query = query.eq('noin_canuse', true);
        }

        if (onlyWordChain) query = query.eq('k_canuse', true);

        const { data: wordsData, error: wordsError } = await query;
        if (wordsError) return failure(infrastructureError(wordsError));

        const { data: waitWordsData, error: waitWordsError } = await this.supabase
            .from('wait_words')
            .select('word,request_type');
        if (waitWordsError) return failure(infrastructureError(waitWordsError));

        const result: WordListItem[] = [
            ...wordsData.map(({ word, noin_canuse, k_canuse }) => ({
                word,
                noinCanuse: noin_canuse,
                kCanuse: k_canuse,
                status: 'ok' as const,
            })),
            ...waitWordsData.map(({ word, request_type }) => ({
                word,
                noinCanuse: false,
                kCanuse: true,
                status: request_type,
            })),
        ];

        return success(result);
    }

    /** @inheritdoc */
    async findLetterCounts(): Promise<Result<LetterCountInfo, CustomError>> {
        const { data: firstData, error: firstError } = await this.supabase
            .from('word_first_letter_counts')
            .select('*');
        if (firstError) return failure(infrastructureError(firstError));

        const { data: lastData, error: lastError } = await this.supabase
            .from('word_last_letter_counts')
            .select('*');
        if (lastError) return failure(infrastructureError(lastError));

        const firstLetterCounts: LetterCountInfo['firstLetterCounts'] = {};
        firstData?.forEach(({ first_letter, count, k_count, n_count, len3_k_count, len3_n_count }) => {
            firstLetterCounts[first_letter] = {
                count,
                kCount: k_count,
                nCount: n_count,
                len3KCount: len3_k_count,
                len3NCount: len3_n_count,
            };
        });

        const lastLetterCounts: LetterCountInfo['lastLetterCounts'] = {};
        lastData?.forEach(({ last_letter, count, k_count, n_count }) => {
            lastLetterCounts[last_letter] = {
                count,
                kCount: k_count,
                nCount: n_count,
            };
        });

        return success({ firstLetterCounts, lastLetterCounts });
    }

    /** @inheritdoc */
    async findThemesByWordId(wordId: number): Promise<Result<{ wordId: number; word: WordEntity; themes: { id: number; name: string; code: string } }[], CustomError>> {
        const { data, error } = await this.supabase
            .from('word_themes')
            .select('words(*),themes(*)')
            .eq('word_id', wordId);

        if (error) return failure(infrastructureError(error));

        return success(
            (data ?? []).map((row) => ({
                wordId,
                word: toWordEntity(row.words),
                themes: {
                    id: row.themes.id,
                    name: row.themes.name,
                    code: row.themes.code,
                },
            }))
        );
    }

    /** @inheritdoc */
    async save(words: NewWord[]): Promise<Result<WordEntity[], CustomError>> {
        const insertData = words.map((w) => ({
            word: w.word,
            noin_canuse: w.noinCanuse,
            added_by: w.addedBy,
        }));

        const { data, error } = await this.supabase
            .from('words')
            .insert(insertData)
            .select('*');

        if (error) return failure(infrastructureError(error));

        return success((data ?? []).map(toWordEntity));
    }

    /** @inheritdoc */
    async upsert(words: NewWord[]): Promise<Result<WordEntity[], CustomError>> {
        const upsertData = words.map((w) => ({
            word: w.word,
            noin_canuse: w.noinCanuse,
            added_by: w.addedBy,
        }));

        const { data, error } = await this.supabase
            .from('words')
            .upsert(upsertData, { ignoreDuplicates: true, onConflict: 'word' })
            .select('*');

        if (error) return failure(infrastructureError(error));

        return success((data ?? []).map(toWordEntity));
    }

    /** @inheritdoc */
    async deleteByWord(word: string): Promise<Result<WordEntity[], CustomError>> {
        const { data, error } = await this.supabase
            .from('words')
            .delete()
            .eq('word', word)
            .select('*');

        if (error) return failure(infrastructureError(error));

        return success((data ?? []).map(toWordEntity));
    }

    /** @inheritdoc */
    async deleteById(id: number): Promise<Result<WordEntity[], CustomError>> {
        const { data, error } = await this.supabase
            .from('words')
            .delete()
            .eq('id', id)
            .select('*');

        if (error) return failure(infrastructureError(error));

        return success((data ?? []).map(toWordEntity));
    }

    /** @inheritdoc */
    async deleteByIds(ids: number[]): Promise<Result<WordEntity[], CustomError>> {
        const { data, error } = await this.supabase
            .from('words')
            .delete()
            .in('id', ids)
            .select('*');

        if (error) return failure(infrastructureError(error));

        return success((data ?? []).map(toWordEntity));
    }

    /** @inheritdoc */
    async findWordState(): Promise<Result<{
        firstLetterCounts: { first_letter: string; count: number; k_count: number; n_count: number; len3_k_count: number; len3_n_count: number }[];
        lastLetterCounts: { last_letter: string; count: number; k_count: number; n_count: number }[];
    }, CustomError>> {
        const { data: data1, error: error1 } = await this.supabase
            .from('word_first_letter_counts')
            .select('*');
        if (error1) return failure(infrastructureError(error1));

        const { data: data2, error: error2 } = await this.supabase
            .from('word_last_letter_counts')
            .select('*');
        if (error2) return failure(infrastructureError(error2));

        return success({
            firstLetterCounts: (data1 ?? []).map((row) => ({
                first_letter: row.first_letter,
                count: row.count,
                k_count: row.k_count,
                n_count: row.n_count,
                len3_k_count: row.len3_k_count,
                len3_n_count: row.len3_n_count,
            })),
            lastLetterCounts: (data2 ?? []).map((row) => ({
                last_letter: row.last_letter,
                count: row.count,
                k_count: row.k_count,
                n_count: row.n_count,
            })),
        });
    }

    /** @inheritdoc */
    async findWordsCount(): Promise<Result<number, CustomError>> {
        const { data, error } = await this.supabase
            .from('words_count')
            .select('total_words')
            .single();

        if (error) return failure(infrastructureError(error));

        return success(data?.total_words ?? 0);
    }

    /**
     * 첫 글자 기준 단어 수를 조회합니다. (reverDuemLaw 포함)
     *
     * @param letter - 글자
     * @returns 단어 수
     */
    async findFirstWordCountByLetter(letter: string): Promise<Result<number, CustomError>> {
        const { reverDuemLaw } = await import('@/src/app/lib/hangulUtils');

        const { data: countData, error: countError } = await this.supabase
            .from('word_last_letter_counts')
            .select('*')
            .eq('last_letter', letter);

        const { count: waitCount, error: waitError } = await this.supabase
            .from('wait_words')
            .select('*', { count: 'exact', head: true })
            .or(reverDuemLaw(letter).map((c) => `word.ilike.%${c}`).join(','));

        if (countError || waitError) return success(0);

        return success(sum((countData ?? []).map(({ count }) => count)) + (waitCount ?? 0));
    }

    /**
     * 마지막 글자 기준 단어 수를 조회합니다. (duemLaw 포함)
     *
     * @param letter - 글자
     * @returns 단어 수
     */
    async findLastWordCountByLetter(letter: string): Promise<Result<number, CustomError>> {
        const { default: DuemLaw } = await import('@/src/app/lib/hangulUtils');

        const { data: countData, error: countError } = await this.supabase
            .from('word_first_letter_counts')
            .select('*')
            .eq('first_letter', letter);

        const { count: waitCount, error: waitError } = await this.supabase
            .from('wait_words')
            .select('*', { count: 'exact', head: true })
            .or([...new Set([letter, DuemLaw(letter)])].map((c) => `word.ilike.${c}%`).join(','));

        if (countError || waitError) return success(0);

        return success(sum((countData ?? []).map(({ count }) => count)) + (waitCount ?? 0));
    }
}

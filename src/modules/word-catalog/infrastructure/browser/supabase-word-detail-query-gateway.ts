import DuemRaw, { reverDuemLaw } from '@/src/app/lib/hangulUtils';
import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { WordDetailQueryGateway } from '../../application/word-detail-ports';
import type { FindRandomConnectedWordInput, WordDetail } from '../../application/word-detail-types';

type QueryResponse = { data: unknown; error: unknown; count?: number | null };

interface WordDetailQueryBuilder extends PromiseLike<QueryResponse> {
    select(columns: string, options?: { count?: 'exact'; head?: boolean }): WordDetailQueryBuilder;
    eq(column: string, value: unknown): WordDetailQueryBuilder;
    in(column: string, values: readonly unknown[]): WordDetailQueryBuilder;
    or(filters: string): WordDetailQueryBuilder;
    maybeSingle(): Promise<QueryResponse>;
}

interface WordDetailQueryClient {
    from(table: string): WordDetailQueryBuilder;
    rpc(functionName: string, args: Record<string, unknown>): Promise<QueryResponse>;
}

type Requester = {
    id?: string;
    nickname?: string;
    requestedAt?: string;
};

type ParsedWord = {
    id: number;
    word: string;
    canUseInChain: boolean;
    canUseWithoutInjeong: boolean;
    requester: Requester;
};

type PendingTheme = { name: string; type: 'add' | 'delete' };

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    code: 'WORD_DETAIL_QUERY_FAILED',
    message: '단어 정보를 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isNonBlankString = (value: unknown): value is string => (
    typeof value === 'string' && value.trim().length > 0
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

const isNonNegativeSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
);

const isNullableBoolean = (value: unknown): value is boolean | null | undefined => (
    typeof value === 'boolean' || value === null || value === undefined
);

const isNullableString = (value: unknown): value is string | null | undefined => (
    isNonBlankString(value) || value === null || value === undefined
);

const parseResponse = (response: unknown): QueryResponse | null => (
    isRecord(response) && 'data' in response && 'error' in response && response.error === null
        ? response as QueryResponse
        : null
);

const parseMaybeSingle = (response: unknown): Record<string, unknown> | null | undefined => {
    const parsed = parseResponse(response);
    if (parsed === null || (!isRecord(parsed.data) && parsed.data !== null)) {
        return undefined;
    }
    return parsed.data;
};

const parseRows = (response: unknown): unknown[] | null => {
    const parsed = parseResponse(response);
    return parsed !== null && Array.isArray(parsed.data) ? parsed.data : null;
};

const parseRandomWord = (rows: unknown[]): string | null | undefined => {
    let firstWord: string | null = null;
    for (const row of rows) {
        if (!isRecord(row) || !isNonBlankString(row.word)) return undefined;
        firstWord ??= row.word;
    }
    return firstWord;
};

const parseRequester = (
    row: Record<string, unknown>,
    idKey: string,
    requestedAtKey: string,
): Requester | null => {
    const id = row[idKey];
    const requestedAt = row[requestedAtKey];
    if (!isNullableString(id) || !isNullableString(requestedAt)) {
        return null;
    }

    const user = row.users;
    if (user !== undefined && user !== null && !isRecord(user)) {
        return null;
    }
    const nickname = user === undefined || user === null ? undefined : user.nickname;
    if (!isNullableString(nickname)) {
        return null;
    }
    return {
        ...(typeof id === 'string' ? { id } : {}),
        ...(typeof nickname === 'string' ? { nickname } : {}),
        ...(typeof requestedAt === 'string' ? { requestedAt } : {}),
    };
};

const parseApprovedWord = (row: Record<string, unknown>): ParsedWord | null => {
    if (!isPositiveSafeInteger(row.id) || !isNonBlankString(row.word)
        || !isNullableBoolean(row.k_canuse) || !isNullableBoolean(row.noin_canuse)) {
        return null;
    }
    const requester = parseRequester(row, 'added_by', 'added_at');
    return requester === null ? null : {
        id: row.id,
        word: row.word,
        canUseInChain: row.k_canuse ?? true,
        canUseWithoutInjeong: row.noin_canuse ?? false,
        requester,
    };
};

const parsePendingWord = (row: Record<string, unknown>): (ParsedWord & { requestType: 'add' | 'delete' }) | null => {
    if (!isPositiveSafeInteger(row.id) || !isNonBlankString(row.word)
        || (row.request_type !== 'add' && row.request_type !== 'delete')) {
        return null;
    }
    const requester = parseRequester(row, 'requested_by', 'requested_at');
    return requester === null ? null : {
        id: row.id,
        word: row.word,
        canUseInChain: true,
        canUseWithoutInjeong: false,
        requester,
        requestType: row.request_type,
    };
};

const parseThemeName = (row: unknown): string | null => {
    if (!isRecord(row) || !isRecord(row.themes) || !isNonBlankString(row.themes.name)) {
        return null;
    }
    return row.themes.name;
};

const parseThemeNames = (rows: unknown[]): string[] | null => {
    const names: string[] = [];
    for (const row of rows) {
        const name = parseThemeName(row);
        if (name === null) return null;
        names.push(name);
    }
    return names;
};

const parsePendingThemes = (rows: unknown[]): PendingTheme[] | null => {
    const themes: PendingTheme[] = [];
    for (const row of rows) {
        const name = parseThemeName(row);
        if (name === null || !isRecord(row) || (row.typez !== 'add' && row.typez !== 'delete')) {
            return null;
        }
        themes.push({ name, type: row.typez });
    }
    return themes;
};

const parseDocuments = (rows: unknown[]): WordDetail['documents'] | null => {
    const documents: WordDetail['documents'] = [];
    for (const row of rows) {
        if (!isRecord(row) || !isPositiveSafeInteger(row.id) || !isNonBlankString(row.name)) {
            return null;
        }
        documents.push({ id: row.id, name: row.name });
    }
    return documents;
};

const parseCountRows = (rows: unknown[]): number | null => {
    let total = 0;
    for (const row of rows) {
        if (!isRecord(row) || !isNonNegativeSafeInteger(row.count)) return null;
        total += row.count;
    }
    return total;
};

/** Supabase 단어·대기 요청·문서 데이터를 단어 상세 조회 DTO로 투영한다. */
export class SupabaseWordDetailQueryGateway implements WordDetailQueryGateway {
    constructor(
        private readonly client: WordDetailQueryClient = browserSupabaseClient as unknown as WordDetailQueryClient,
    ) {}

    async findDetail(word: string): Promise<Result<WordDetail | null>> {
        try {
            const approvedRow = parseMaybeSingle(await this.client
                .from('words')
                .select('id, word, k_canuse, noin_canuse, added_by, added_at, users(nickname)')
                .eq('word', word)
                .maybeSingle());
            const pendingRow = parseMaybeSingle(await this.client
                .from('wait_words')
                .select('id, word, request_type, requested_by, requested_at, users(nickname)')
                .eq('word', word)
                .maybeSingle());
            if (approvedRow === undefined || pendingRow === undefined) {
                return err(infrastructureError());
            }
            if (approvedRow === null && pendingRow === null) {
                return ok(null);
            }

            const approved = approvedRow === null ? null : parseApprovedWord(approvedRow);
            const pending = pendingRow === null ? null : parsePendingWord(pendingRow);
            if ((approvedRow !== null && approved === null) || (pendingRow !== null && pending === null)) {
                return err(infrastructureError());
            }

            if (approved !== null) {
                return await this.projectApproved(approved, pending);
            }
            return await this.projectPendingAddition(pending!);
        } catch {
            return err(infrastructureError());
        }
    }

    async findRandomConnectedWord(input: FindRandomConnectedWordInput): Promise<Result<string | null>> {
        const names = input.direction === 'previous'
            ? { approved: 'random_word_ff', pending: 'random_wait_word_ff' }
            : { approved: 'random_word_ll', pending: 'random_wait_word_ll' };
        try {
            const approvedRows = parseRows(await this.client.rpc(names.approved, { fir1: input.letters }));
            if (approvedRows === null) return err(infrastructureError());
            const approvedWord = parseRandomWord(approvedRows);
            if (approvedWord === undefined) return err(infrastructureError());
            if (approvedWord !== null) return ok(approvedWord);

            const pendingRows = parseRows(await this.client.rpc(names.pending, { prefixes: input.letters }));
            if (pendingRows === null) return err(infrastructureError());
            const pendingWord = parseRandomWord(pendingRows);
            return pendingWord === undefined ? err(infrastructureError()) : ok(pendingWord);
        } catch {
            return err(infrastructureError());
        }
    }

    private async projectApproved(
        approved: ParsedWord,
        pending: (ParsedWord & { requestType: 'add' | 'delete' }) | null,
    ): Promise<Result<WordDetail>> {
        const approvedThemeRows = parseRows(await this.client
            .from('word_themes')
            .select('themes(name)')
            .eq('word_id', approved.id));
        const pendingThemeRows = parseRows(await this.client
            .from('word_themes_wait')
            .select('typez, themes(name)')
            .eq('word_id', approved.id));
        if (approvedThemeRows === null || pendingThemeRows === null) {
            return err(infrastructureError());
        }
        const approvedThemes = parseThemeNames(approvedThemeRows);
        const pendingThemes = parsePendingThemes(pendingThemeRows);
        if (approvedThemes === null || pendingThemes === null) {
            return err(infrastructureError());
        }

        const themes = this.mapThemes(approvedThemes, pendingThemes);
        const documents = await this.loadDocuments(approved.word, [
            ...approvedThemes,
            ...pendingThemes.map(({ name }) => name),
        ]);
        if (documents === null) return err(infrastructureError());

        const { previousWordCount, nextWordCount } = await this.loadConnectionCounts(approved.word);
        const requester = pending?.requestType === 'delete' ? pending.requester : approved.requester;
        return ok({
            id: approved.id,
            word: approved.word,
            status: pending?.requestType === 'delete' ? 'pending-deletion' : 'registered',
            canUseInChain: approved.canUseInChain,
            canUseWithoutInjeong: approved.canUseWithoutInjeong,
            ...this.requesterFields(requester),
            themes,
            documents,
            previousWordCount,
            nextWordCount,
        });
    }

    private async projectPendingAddition(
        pending: ParsedWord & { requestType: 'add' | 'delete' },
    ): Promise<Result<WordDetail>> {
        if (pending.requestType !== 'add') return err(infrastructureError());
        const pendingThemeRows = parseRows(await this.client
            .from('wait_word_themes')
            .select('themes(name)')
            .eq('wait_word_id', pending.id));
        if (pendingThemeRows === null) return err(infrastructureError());
        const pendingAddition = parseThemeNames(pendingThemeRows);
        if (pendingAddition === null) return err(infrastructureError());

        const documents = await this.loadDocuments(pending.word, pendingAddition);
        if (documents === null) return err(infrastructureError());
        const { previousWordCount, nextWordCount } = await this.loadConnectionCounts(pending.word);
        return ok({
            id: pending.id,
            word: pending.word,
            status: 'pending-addition',
            canUseInChain: true,
            canUseWithoutInjeong: false,
            ...this.requesterFields(pending.requester),
            themes: { approved: [], pendingAddition, pendingDeletion: [] },
            documents,
            previousWordCount,
            nextWordCount,
        });
    }

    private mapThemes(approvedThemes: string[], pendingThemes: PendingTheme[]): WordDetail['themes'] {
        const pendingNames = pendingThemes.map(({ name }) => name);
        const approved = approvedThemes.filter((name) => !pendingNames.includes(name));
        return {
            approved,
            pendingAddition: pendingThemes.filter(({ type }) => type === 'add').map(({ name }) => name),
            pendingDeletion: pendingThemes.filter(({ type }) => type === 'delete').map(({ name }) => name),
        };
    }

    private async loadDocuments(word: string, themeNames: string[]): Promise<WordDetail['documents'] | null> {
        const letterRows = parseRows(await this.client
            .from('docs')
            .select('id, name')
            .eq('name', word[word.length - 1])
            .eq('typez', 'letter'));
        const themeRows = parseRows(await this.client
            .from('docs')
            .select('id, name')
            .eq('typez', 'theme')
            .in('name', themeNames));
        if (letterRows === null || themeRows === null) return null;
        const letterDocuments = parseDocuments(letterRows);
        const themeDocuments = parseDocuments(themeRows);
        return letterDocuments === null || themeDocuments === null
            ? null
            : [...letterDocuments, ...themeDocuments];
    }

    private async loadConnectionCounts(word: string): Promise<{
        previousWordCount: number;
        nextWordCount: number;
    }> {
        const firstLetter = word[0];
        const lastLetter = word[word.length - 1];
        const [previousWordCount, nextWordCount] = await Promise.all([
            this.loadPreviousWordCount(firstLetter),
            this.loadNextWordCount(lastLetter),
        ]);
        return { previousWordCount, nextWordCount };
    }

    private async loadPreviousWordCount(firstLetter: string): Promise<number> {
        try {
            const letters = reverDuemLaw(firstLetter);
            const [countRows, pendingResponse] = await Promise.all([
                this.client.from('word_last_letter_counts').select('count').eq('last_letter', firstLetter),
                this.client.from('wait_words').select('id', { count: 'exact', head: true })
                    .or(letters.map((letter) => `word.ilike.%${letter}`).join(',')),
            ]);
            const rows = parseRows(countRows);
            const currentCount = rows === null ? null : parseCountRows(rows);
            const pending = parseResponse(pendingResponse);
            if (currentCount === null || pending === null || !isNonNegativeSafeInteger(pending.count)) {
                return 0;
            }
            return currentCount + pending.count;
        } catch {
            return 0;
        }
    }

    private async loadNextWordCount(lastLetter: string): Promise<number> {
        try {
            const letters = [...new Set([lastLetter, DuemRaw(lastLetter)])];
            const [countRows, pendingResponse] = await Promise.all([
                this.client.from('word_first_letter_counts').select('count').eq('first_letter', lastLetter),
                this.client.from('wait_words').select('id', { count: 'exact', head: true })
                    .or(letters.map((letter) => `word.ilike.${letter}%`).join(',')),
            ]);
            const rows = parseRows(countRows);
            const currentCount = rows === null ? null : parseCountRows(rows);
            const pending = parseResponse(pendingResponse);
            if (currentCount === null || pending === null || !isNonNegativeSafeInteger(pending.count)) {
                return 0;
            }
            return currentCount + pending.count;
        } catch {
            return 0;
        }
    }

    private requesterFields(requester: Requester): Pick<WordDetail, 'requesterId' | 'requesterNickname' | 'requestedAt'> {
        return {
            ...(requester.id === undefined ? {} : { requesterId: requester.id }),
            ...(requester.nickname === undefined ? {} : { requesterNickname: requester.nickname }),
            ...(requester.requestedAt === undefined ? {} : { requestedAt: requester.requestedAt }),
        };
    }
}

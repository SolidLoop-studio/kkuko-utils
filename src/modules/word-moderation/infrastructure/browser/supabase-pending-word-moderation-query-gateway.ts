import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { PendingWordModerationQueryGateway } from '../../application/pending-word-moderation-query-ports';
import type {
    PendingWordModerationRequest,
    PendingWordModerationTheme,
    PendingWordModerationThemeType,
} from '../../application/pending-word-moderation-query-types';

type QueryResponse = { data: unknown; error: unknown };
type TableName = 'word_themes_wait' | 'wait_words' | 'wait_word_themes';

interface PendingWordModerationQueryBuilder extends PromiseLike<QueryResponse> {
    select(columns: string): PendingWordModerationQueryBuilder;
    order(column: string, options: { ascending: boolean }): PendingWordModerationQueryBuilder;
    in(column: string, values: number[]): PendingWordModerationQueryBuilder;
}

interface PendingWordModerationQueryClient {
    from(table: TableName): PendingWordModerationQueryBuilder;
}

type ThemeChangeRow = {
    wordId: number;
    themeId: number;
    type: PendingWordModerationThemeType;
    requestedAt: string;
    requesterId: string | null;
    requesterNickname: string | null;
    word: string;
    themeName: string;
    themeCode: string;
};

type WaitWordRow = {
    id: number;
    word: string;
    requestType: 'add' | 'delete';
    requestedAt: string;
    requesterId: string | null;
    requesterNickname: string | null;
    wordId: number | null;
};

type WaitWordThemeRow = {
    waitWordId: number;
    themeId: number;
    themeName: string;
    themeCode: string;
};

const QUERY_CHUNK_SIZE = 300;

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '단어 요청 목록을 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

const isNullableString = (value: unknown): value is string | null => (
    typeof value === 'string' || value === null
);

const parseUserNickname = (value: unknown): string | null | undefined => {
    if (value === null) return null;
    if (!isRecord(value) || !isNullableString(value.nickname)) return undefined;
    return value.nickname;
};

const parseThemeChangeRow = (value: unknown): ThemeChangeRow | null => {
    if (!isRecord(value)
        || !isPositiveSafeInteger(value.word_id)
        || !isPositiveSafeInteger(value.theme_id)
        || (value.typez !== 'add' && value.typez !== 'delete')
        || typeof value.req_at !== 'string'
        || !isNullableString(value.req_by)
        || !isRecord(value.words)
        || !isPositiveSafeInteger(value.words.id)
        || typeof value.words.word !== 'string'
        || !isRecord(value.themes)
        || !isPositiveSafeInteger(value.themes.id)
        || typeof value.themes.name !== 'string'
        || typeof value.themes.code !== 'string') return null;

    const requesterNickname = parseUserNickname(value.users);
    if (requesterNickname === undefined) return null;
    return {
        wordId: value.word_id,
        themeId: value.theme_id,
        type: value.typez,
        requestedAt: value.req_at,
        requesterId: value.req_by,
        requesterNickname,
        word: value.words.word,
        themeName: value.themes.name,
        themeCode: value.themes.code,
    };
};

const parseWaitWordRow = (value: unknown): WaitWordRow | null => {
    if (!isRecord(value)
        || !isPositiveSafeInteger(value.id)
        || typeof value.word !== 'string'
        || (value.request_type !== 'add' && value.request_type !== 'delete')
        || typeof value.requested_at !== 'string'
        || !isNullableString(value.requested_by)
        || (value.words !== null && (!isRecord(value.words) || !isPositiveSafeInteger(value.words.id)))) return null;

    const requesterNickname = parseUserNickname(value.users);
    if (requesterNickname === undefined) return null;
    return {
        id: value.id,
        word: value.word,
        requestType: value.request_type,
        requestedAt: value.requested_at,
        requesterId: value.requested_by,
        requesterNickname,
        wordId: value.words === null ? null : value.words.id as number,
    };
};

const parseWaitWordThemeRow = (value: unknown): WaitWordThemeRow | null => {
    if (!isRecord(value)
        || !isPositiveSafeInteger(value.wait_word_id)
        || !isPositiveSafeInteger(value.theme_id)
        || !isRecord(value.themes)
        || !isPositiveSafeInteger(value.themes.id)
        || typeof value.themes.name !== 'string'
        || typeof value.themes.code !== 'string') return null;

    return {
        waitWordId: value.wait_word_id,
        themeId: value.theme_id,
        themeName: value.themes.name,
        themeCode: value.themes.code,
    };
};

const parseRows = <T>(data: unknown, parser: (value: unknown) => T | null): T[] | null => {
    if (!Array.isArray(data)) return null;
    const rows: T[] = [];
    for (const value of data) {
        const row = parser(value);
        if (row === null) return null;
        rows.push(row);
    }
    return rows;
};

const optionalRequesterId = (requesterId: string | null): { requesterId?: string } => (
    requesterId === null ? {} : { requesterId }
);

const compareThemeChangeMetadata = (first: ThemeChangeRow, second: ThemeChangeRow): number => (
    second.requestedAt.localeCompare(first.requestedAt)
    || second.themeId - first.themeId
    || first.type.localeCompare(second.type)
    || first.word.localeCompare(second.word, 'ko-KR')
    || (first.requesterId ?? '').localeCompare(second.requesterId ?? '')
    || (first.requesterNickname ?? '').localeCompare(second.requesterNickname ?? '', 'ko-KR')
    || first.themeCode.localeCompare(second.themeCode)
    || first.themeName.localeCompare(second.themeName, 'ko-KR')
);

const compareThemes = (first: PendingWordModerationTheme, second: PendingWordModerationTheme): number => (
    first.id - second.id
    || (first.type ?? '').localeCompare(second.type ?? '')
    || first.code.localeCompare(second.code)
    || first.name.localeCompare(second.name, 'ko-KR')
);

/** Supabase 행과 관계 데이터를 관리자 moderation 프로젝션으로 조합합니다. */
export class SupabasePendingWordModerationQueryGateway implements PendingWordModerationQueryGateway {
    constructor(
        private readonly client: PendingWordModerationQueryClient = browserSupabaseClient as unknown as PendingWordModerationQueryClient,
    ) {}

    async loadPending(): Promise<Result<PendingWordModerationRequest[]>> {
        try {
            const themeResponse = await this.client
                .from('word_themes_wait')
                .select('word_id, theme_id, typez, req_at, req_by, words(id, word), themes(id, name, code), users(nickname)');
            if (themeResponse.error !== null) return err(infrastructureError());
            const themeRows = parseRows(themeResponse.data, parseThemeChangeRow);
            if (themeRows === null) return err(infrastructureError());

            const waitWordResponse = await this.client
                .from('wait_words')
                .select('id, word, request_type, requested_at, requested_by, words(id), users(nickname)')
                .order('requested_at', { ascending: true });
            if (waitWordResponse.error !== null) return err(infrastructureError());
            const waitWordRows = parseRows(waitWordResponse.data, parseWaitWordRow);
            if (waitWordRows === null) return err(infrastructureError());

            const addRequestIds = waitWordRows.filter((row) => row.requestType === 'add').map((row) => row.id);
            const waitWordThemeRows: WaitWordThemeRow[] = [];
            for (let index = 0; index < addRequestIds.length; index += QUERY_CHUNK_SIZE) {
                const ids = addRequestIds.slice(index, index + QUERY_CHUNK_SIZE);
                const response = await this.client
                    .from('wait_word_themes')
                    .select('wait_word_id, theme_id, themes(id, name, code)')
                    .in('wait_word_id', ids);
                if (response.error !== null) return err(infrastructureError());
                const rows = parseRows(response.data, parseWaitWordThemeRow);
                if (rows === null) return err(infrastructureError());
                waitWordThemeRows.push(...rows);
            }

            return ok([...this.groupThemeChanges(themeRows), ...this.mapWaitWords(waitWordRows, waitWordThemeRows)]);
        } catch {
            return err(infrastructureError());
        }
    }

    private groupThemeChanges(rows: ThemeChangeRow[]): PendingWordModerationRequest[] {
        const rowsByWordId = new Map<number, ThemeChangeRow[]>();
        for (const row of rows) {
            const wordRows = rowsByWordId.get(row.wordId) ?? [];
            wordRows.push(row);
            rowsByWordId.set(row.wordId, wordRows);
        }

        return [...rowsByWordId.entries()]
            .map(([wordId, wordRows]) => {
                const metadata = [...wordRows].sort(compareThemeChangeMetadata)[0];
                const themes = wordRows
                    .map((row) => ({
                        id: row.themeId,
                        name: row.themeName,
                        code: row.themeCode,
                        type: row.type,
                    }))
                    .sort(compareThemes);

                return {
                    requestKey: `theme-change:${wordId}`,
                    id: wordId,
                    word: metadata.word,
                    requestType: 'theme_change' as const,
                    requestedAt: metadata.requestedAt,
                    ...optionalRequesterId(metadata.requesterId),
                    requesterNickname: metadata.requesterNickname ?? 'unknow',
                    wordId,
                    themes,
                };
            })
            .sort((first, second) => (
                first.word.localeCompare(second.word, 'ko-KR')
                || first.wordId - second.wordId
            ));
    }

    private mapWaitWords(rows: WaitWordRow[], themeRows: WaitWordThemeRow[]): PendingWordModerationRequest[] {
        const themesByRequestId = new Map<number, PendingWordModerationTheme[]>();
        for (const row of themeRows) {
            const themes = themesByRequestId.get(row.waitWordId) ?? [];
            themes.push({ id: row.themeId, name: row.themeName, code: row.themeCode, type: 'add' });
            themesByRequestId.set(row.waitWordId, themes);
        }

        return rows.map((row) => ({
            requestKey: `word-request:${row.id}`,
            id: row.id,
            word: row.word,
            requestType: row.requestType,
            requestedAt: row.requestedAt,
            ...optionalRequesterId(row.requesterId),
            requesterNickname: row.requesterNickname ?? 'unknown',
            ...(row.requestType === 'add'
                ? { themes: [...(themesByRequestId.get(row.id) ?? [])].sort(compareThemes) }
                : {}),
            ...(row.wordId === null ? {} : { wordId: row.wordId }),
        }));
    }
}

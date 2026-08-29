import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { InternalReleaseNoteQueryGateway } from '../../application/release-note-query-ports';
import type { InternalReleaseNote } from '../../application/release-note-query-types';

interface QueryResponse {
    data?: unknown;
    error?: unknown;
}

interface InternalReleaseNoteRequest extends PromiseLike<QueryResponse> {
    order(column: 'created_at', options: { ascending: false }): InternalReleaseNoteRequest;
}

interface InternalReleaseNoteQueryBuilder {
    select(columns: string): InternalReleaseNoteRequest;
}

interface InternalReleaseNoteQueryClient {
    from(table: 'release_note'): InternalReleaseNoteQueryBuilder;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '릴리즈 노트를 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

const isValidDateString = (value: unknown): value is string => (
    typeof value === 'string' && !Number.isNaN(Date.parse(value))
);

const parseRow = (value: unknown): InternalReleaseNote | null => {
    if (!isRecord(value)
        || !isPositiveSafeInteger(value.id)
        || typeof value.title !== 'string'
        || typeof value.content !== 'string'
        || !isValidDateString(value.created_at)
        || (typeof value.link !== 'string' && value.link !== null)) {
        return null;
    }

    return {
        id: value.id,
        title: value.title,
        content: value.content,
        createdAt: value.created_at,
        link: value.link,
    };
};

/** Supabase 내부 릴리즈 행을 안전한 화면 projection으로 변환합니다. */
export class SupabaseInternalReleaseNoteQueryGateway implements InternalReleaseNoteQueryGateway {
    constructor(
        private readonly client: InternalReleaseNoteQueryClient = (
            browserSupabaseClient as unknown as InternalReleaseNoteQueryClient
        ),
    ) {}

    async load(): Promise<Result<InternalReleaseNote[]>> {
        try {
            const response = await this.client
                .from('release_note')
                .select('id, title, content, created_at, link')
                .order('created_at', { ascending: false });

            if (!isRecord(response) || response.error !== null || !Array.isArray(response.data)) {
                return err(infrastructureError());
            }

            const notes: InternalReleaseNote[] = [];
            for (const value of response.data) {
                const note = parseRow(value);
                if (note === null) return err(infrastructureError());
                notes.push(note);
            }
            return ok(notes);
        } catch {
            return err(infrastructureError());
        }
    }
}

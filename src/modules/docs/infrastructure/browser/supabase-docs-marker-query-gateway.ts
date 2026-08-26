import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { DocsMarkerQueryGateway } from '../../application/docs-marker-query-ports';
import type { DocsMarker, DocsMarkerSlot } from '../../application/docs-marker-query-types';

type QueryResponse = {
    data: unknown;
    error: unknown;
};

interface DocsMarkerQueryBuilder extends PromiseLike<QueryResponse> {
    select(columns: string): DocsMarkerQueryBuilder;
    eq(column: string, value: number): DocsMarkerQueryBuilder;
    in(column: string, values: string[]): DocsMarkerQueryBuilder;
    maybeSingle(): DocsMarkerQueryBuilder;
}

interface DocsMarkerQueryClient {
    from(table: 'docs'): DocsMarkerQueryBuilder;
}

const missionCharacters = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'] as const;
const missionKeys = ['ga', 'na', 'da', 'ra', 'ma', 'ba', 'sa', 'a', 'ja', 'cha', 'ka', 'ta', 'pa', 'ha'] as const;
const missionParentReferenceCodes = new Set([
    'ko.word-chain.mission',
    'ko.reverse-word-chain.mission',
    'ko.kkungkkungtta.mission',
]);

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '미션 글자 업데이트 정보를 불러오는 중 오류가 발생했습니다.',
});

const nonParentError = (): ApplicationError => ({
    kind: 'validation',
    message: '미션 글자 상위 문서가 아닙니다.',
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

const parseParentReferenceCode = (response: QueryResponse): string | null | undefined => {
    if (response.error !== null) return undefined;
    if (response.data === null) return null;
    if (!isRecord(response.data) || typeof response.data.reference_code !== 'string') {
        return undefined;
    }
    return response.data.reference_code;
};

const parseMarkers = (
    response: QueryResponse,
    childReferenceCodes: string[],
): DocsMarkerSlot[] | undefined => {
    if (response.error !== null || !Array.isArray(response.data)) return undefined;

    const markersByReferenceCode = new Map<string, DocsMarker>();
    for (const row of response.data) {
        if (!isRecord(row)
            || !isPositiveSafeInteger(row.id)
            || typeof row.reference_code !== 'string'
            || !childReferenceCodes.includes(row.reference_code)
            || !isNullableString(row.last_update)
            || markersByReferenceCode.has(row.reference_code)) {
            return undefined;
        }

        const index = childReferenceCodes.indexOf(row.reference_code);
        markersByReferenceCode.set(row.reference_code, {
            character: missionCharacters[index],
            docsId: row.id,
            lastUpdatedAt: row.last_update,
        });
    }

    return childReferenceCodes.map((referenceCode) => (
        markersByReferenceCode.get(referenceCode) ?? null
    ));
};

/** 불변 reference code로 미션 글자 하위 문서를 일괄 조회합니다. */
export class SupabaseDocsMarkerQueryGateway implements DocsMarkerQueryGateway {
    constructor(
        private readonly client: DocsMarkerQueryClient = browserSupabaseClient as unknown as DocsMarkerQueryClient,
    ) {}

    async loadByParentDocsId(parentDocsId: number): Promise<Result<DocsMarkerSlot[] | null>> {
        try {
            const parentResponse = await this.client
                .from('docs')
                .select('reference_code')
                .eq('id', parentDocsId)
                .maybeSingle();
            if (!isRecord(parentResponse)) return err(infrastructureError());

            const parentReferenceCode = parseParentReferenceCode(parentResponse);
            if (parentReferenceCode === undefined) return err(infrastructureError());
            if (parentReferenceCode === null) return ok(null);
            if (!missionParentReferenceCodes.has(parentReferenceCode)) {
                return err(nonParentError());
            }

            const childReferenceCodes = missionKeys.map((key) => `${parentReferenceCode}.${key}`);
            const childrenResponse = await this.client
                .from('docs')
                .select('id, reference_code, last_update')
                .in('reference_code', childReferenceCodes);
            if (!isRecord(childrenResponse)) return err(infrastructureError());

            const markers = parseMarkers(childrenResponse, childReferenceCodes);
            return markers === undefined ? err(infrastructureError()) : ok(markers);
        } catch {
            return err(infrastructureError());
        }
    }
}

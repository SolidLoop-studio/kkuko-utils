import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { ProfileFavoriteDocsQueryGateway } from '../../application/profile-favorite-docs-query-ports';
import type {
    ProfileFavoriteDoc,
    ProfileFavoriteDocType,
} from '../../application/profile-favorite-docs-query-types';

interface QueryResponse {
    data?: unknown;
    error?: unknown;
}

interface FavoriteDocsQueryFilter {
    eq(column: 'user_id', value: string): PromiseLike<QueryResponse>;
}

interface FavoriteDocsQueryBuilder {
    select(columns: 'docs(id, name, typez, last_update)'): FavoriteDocsQueryFilter;
}

interface ProfileFavoriteDocsQueryClient {
    from(table: 'user_star_docs'): FavoriteDocsQueryBuilder;
}

const profileFavoriteDocsError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '즐겨찾기한 문서를 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

const isProfileFavoriteDocType = (value: unknown): value is ProfileFavoriteDocType => (
    value === 'letter' || value === 'theme' || value === 'ect'
);

const parseFavoriteDoc = (row: unknown): ProfileFavoriteDoc | null => {
    if (!isRecord(row) || !isRecord(row.docs)) return null;
    const docs = row.docs;
    if (!isPositiveSafeInteger(docs.id)
        || typeof docs.name !== 'string'
        || !isProfileFavoriteDocType(docs.typez)
        || typeof docs.last_update !== 'string') {
        return null;
    }

    return {
        id: docs.id,
        name: docs.name,
        type: docs.typez,
        lastUpdatedAt: docs.last_update,
    };
};

/** Supabase 즐겨찾기 행을 프로필 활동 tab의 좁은 DTO로 투영합니다. */
export class SupabaseProfileFavoriteDocsQueryGateway implements ProfileFavoriteDocsQueryGateway {
    constructor(
        private readonly client: ProfileFavoriteDocsQueryClient = (
            browserSupabaseClient as unknown as ProfileFavoriteDocsQueryClient
        ),
    ) {}

    async loadByUserId(userId: string): Promise<Result<ProfileFavoriteDoc[]>> {
        try {
            const response = await this.client
                .from('user_star_docs')
                .select('docs(id, name, typez, last_update)')
                .eq('user_id', userId);
            if (!isRecord(response) || response.error !== null || !Array.isArray(response.data)) {
                return err(profileFavoriteDocsError());
            }

            const favoriteDocs: ProfileFavoriteDoc[] = [];
            for (const row of response.data) {
                const favoriteDoc = parseFavoriteDoc(row);
                if (favoriteDoc === null) return err(profileFavoriteDocsError());
                favoriteDocs.push(favoriteDoc);
            }
            return ok(favoriteDocs);
        } catch {
            return err(profileFavoriteDocsError());
        }
    }
}

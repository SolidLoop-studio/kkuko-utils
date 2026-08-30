import { err, type Result } from '@/src/shared/application/result';
import type { ProfileSearchQueryGateway } from './profile-search-query-ports';
import type { ProfileSearchItem } from './profile-search-query-types';

/** 입력한 닉네임으로 공개 프로필 projection을 안전하게 검색합니다. */
export class SearchProfilesByNicknameService {
    constructor(private readonly gateway: ProfileSearchQueryGateway) {}

    async search(query: string): Promise<Result<ProfileSearchItem[]>> {
        const normalizedQuery = query.trim();
        if (normalizedQuery.length === 0) {
            return err({
                kind: 'validation',
                field: 'nickname',
                message: '검색할 닉네임을 입력해주세요.',
            });
        }

        try {
            return await this.gateway.searchByNickname(normalizedQuery);
        } catch {
            return err({ kind: 'infrastructure', message: '사용자 검색 중 오류가 발생했습니다.' });
        }
    }
}

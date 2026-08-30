/** 프로필 활동 탭에 표시하는 즐겨찾기 문서 유형입니다. */
export type ProfileFavoriteDocType = 'letter' | 'theme' | 'ect';

/** 프로필 활동 탭에 안전하게 전달하는 즐겨찾기 문서 projection입니다. */
export interface ProfileFavoriteDoc {
    id: number;
    name: string;
    type: ProfileFavoriteDocType;
    lastUpdatedAt: string;
}

/** Identity profile query의 React Query cache key를 한곳에서 관리합니다. */
export const identityQueryKeys = {
    profileFavoriteDocs: (userId: string) => ['identity', 'profile-favorite-docs', userId.trim()] as const,
    profileSummary: (nickname: string) => ['identity', 'profile-summary', nickname.trim()] as const,
};

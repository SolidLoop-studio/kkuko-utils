export type ProgramCategory = 'all' | 'tool' | 'util' | 'other';

export type ProgramQuery = {
    id: number;
    name: string;
    description: string;
    githubRepo: string;
    category: Exclude<ProgramCategory, 'all'>;
    tags: string[];
    isActive: boolean;
    createdAt: string;
    readmePath: string;
};

export type ProgramWithUpdatedAt = ProgramQuery & {
    updatedAt: string;
};

export type ProgramReleaseAsset = {
    id: number;
    name: string;
    downloadCount: number;
    size: number;
    browserDownloadUrl: string;
    contentType: string;
};

export type ProgramRelease = {
    id: number;
    tagName: string;
    name: string;
    body: string;
    publishedAt: string;
    assets: ProgramReleaseAsset[];
    htmlUrl: string;
    prerelease: boolean;
    draft: boolean;
    updatedAt: string;
};

export type ReleasePagination = {
    page: number;
    perPage: number;
};

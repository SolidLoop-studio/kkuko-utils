export interface InternalReleaseNote {
    id: number;
    title: string;
    content: string;
    createdAt: string;
    link: string | null;
}

export interface GithubReleaseNote {
    id: number;
    name: string;
    body: string;
    publishedAt: string;
    htmlUrl: string;
    tagName: string;
}

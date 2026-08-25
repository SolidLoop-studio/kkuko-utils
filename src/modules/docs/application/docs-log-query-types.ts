export interface DocsLogEntry {
    id: number;
    word: string;
    userNickname: string | null;
    occurredAt: string;
    type: 'add' | 'delete';
}

export interface DocsLogProjection {
    docsId: number;
    docsName: string;
    entries: DocsLogEntry[];
}

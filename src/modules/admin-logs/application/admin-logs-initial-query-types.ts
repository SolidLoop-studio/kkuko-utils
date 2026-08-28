export type AdminWordLogState = 'approved' | 'rejected' | 'pending';
export type AdminLogMutationType = 'add' | 'delete';
export type AdminLogsDocumentType = 'letter' | 'theme' | 'ect';

export interface AdminWordLogEntry {
    id: number;
    word: string;
    state: AdminWordLogState;
    requestType: AdminLogMutationType;
    requesterNickname: string | null;
    processorNickname: string | null;
    createdAt: string;
}

export interface AdminDocsLogEntry {
    id: number;
    word: string;
    documentName: string | null;
    actorNickname: string | null;
    type: AdminLogMutationType;
    occurredAt: string;
}

export interface AdminLogsDocumentChoice {
    id: number;
    name: string;
    type: AdminLogsDocumentType;
}

export interface AdminLogsInitialProjection {
    wordLogs: AdminWordLogEntry[];
    docsLogs: AdminDocsLogEntry[];
    documentChoices: AdminLogsDocumentChoice[];
}

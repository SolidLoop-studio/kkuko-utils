import {
    splitWordDeletionBatches,
    type NormalizedWordDeletionEntry,
} from '@/src/modules/word-moderation/domain/word-deletion';

export type WordDeletionPayloadBatch = {
    batchIndex: number;
    payloadHash: string;
    entries: NormalizedWordDeletionEntry[];
};

export type WordDeletionPayload = {
    inputHash: string;
    batches: WordDeletionPayloadBatch[];
};

export function serializeWordDeletionEntries(entries: NormalizedWordDeletionEntry[]): string {
    return JSON.stringify(entries.map((entry) => ({ word: entry.word })));
}

export async function sha256(value: string): Promise<string> {
    const bytes = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest('SHA-256', bytes);

    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildWordDeletionPayload(
    entries: NormalizedWordDeletionEntry[],
    batchSize: number,
): Promise<WordDeletionPayload> {
    const batchesResult = splitWordDeletionBatches(entries, batchSize);
    if (!batchesResult.ok) {
        throw new Error(batchesResult.error.message);
    }

    return {
        inputHash: await sha256(`word-deletion:v1:${serializeWordDeletionEntries(entries)}`),
        batches: await Promise.all(batchesResult.value.map(async (batch, batchIndex) => ({
            batchIndex,
            payloadHash: await sha256(serializeWordDeletionEntries(batch)),
            entries: batch,
        }))),
    };
}

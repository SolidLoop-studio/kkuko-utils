import {
    splitWordApprovalBatches,
    type NormalizedWordApprovalEntry,
} from '@/src/modules/word-moderation/domain/word-approval';
import type { WordApprovalPayload } from './word-approval-types';

export function serializeApprovalEntries(entries: NormalizedWordApprovalEntry[]): string {
    return JSON.stringify(entries.map((entry) => ({
        word: entry.word,
        themeCodes: entry.themeCodes,
        noinCanUse: entry.noinCanUse,
    })));
}

export async function sha256(value: string): Promise<string> {
    const bytes = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest('SHA-256', bytes);

    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildApprovalPayload(
    entries: NormalizedWordApprovalEntry[],
    batchSize: number,
): Promise<WordApprovalPayload> {
    const batchesResult = splitWordApprovalBatches(entries, batchSize);
    if (!batchesResult.ok) {
        throw new Error(batchesResult.error.message);
    }

    return {
        inputHash: await sha256(serializeApprovalEntries(entries)),
        batches: await Promise.all(batchesResult.value.map(async (batch, batchIndex) => ({
            batchIndex,
            payloadHash: await sha256(serializeApprovalEntries(batch)),
            entries: batch,
        }))),
    };
}

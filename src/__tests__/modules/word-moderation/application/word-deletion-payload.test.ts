import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import {
    buildWordDeletionPayload,
    serializeWordDeletionEntries,
} from '@/src/modules/word-moderation/application/word-deletion-payload';

if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: webcrypto,
    });
}

if (!globalThis.TextEncoder) {
    Object.defineProperty(globalThis, 'TextEncoder', {
        configurable: true,
        value: TextEncoder,
    });
}

describe('word deletion payload', () => {
    it('serializes only the stable word contract', () => {
        expect(serializeWordDeletionEntries([{ word: '가방' }, { word: '하늘' }]))
            .toBe('[{"word":"가방"},{"word":"하늘"}]');
    });

    it('builds stable hashes and indexed batches', async () => {
        const payload = await buildWordDeletionPayload([{ word: '가방' }, { word: '하늘' }], 1);
        expect(payload.inputHash).toMatch(/^[0-9a-f]{64}$/);
        expect(payload.batches.map(({ batchIndex, entries }) => ({ batchIndex, entries })))
            .toEqual([
                { batchIndex: 0, entries: [{ word: '가방' }] },
                { batchIndex: 1, entries: [{ word: '하늘' }] },
            ]);
        expect(payload.batches.every((batch) => /^[0-9a-f]{64}$/.test(batch.payloadHash)))
            .toBe(true);
    });
});

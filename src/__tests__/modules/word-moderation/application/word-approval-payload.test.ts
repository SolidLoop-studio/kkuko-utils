import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import {
    buildApprovalPayload,
    serializeApprovalEntries,
    sha256,
} from '@/src/modules/word-moderation/application/word-approval-payload';

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

const normalizedEntries = [
    { word: '가방', themeCodes: ['10'], noinCanUse: true },
    { word: '나비', themeCodes: ['20'], noinCanUse: false },
];

describe('word approval payload', () => {
    it('같은 정규화 payload를 항상 같은 문자열로 직렬화한다', () => {
        expect(serializeApprovalEntries([
            { word: '가방', themeCodes: ['10', '20'], noinCanUse: true },
        ])).toBe('[{"word":"가방","themeCodes":["10","20"],"noinCanUse":true}]');
    });

    it('SHA-256을 소문자 64자리 hex로 반환한다', async () => {
        await expect(sha256('abc')).resolves.toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        );
    });

    it('각 배치 hash와 전체 input hash를 분리한다', async () => {
        const payload = await buildApprovalPayload(normalizedEntries, 1);

        expect(payload.batches).toHaveLength(2);
        expect(payload.inputHash).not.toBe(payload.batches[0].payloadHash);
        expect(payload.batches[0].batchIndex).toBe(0);
    });
});

import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import {
    buildApprovalPayload,
    serializeApprovalEntries,
    sha256,
} from '@/src/modules/word-moderation/application/word-approval-payload';
import { normalizeWordApprovalEntries } from '@/src/modules/word-moderation/domain/word-approval';

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

    it('한글과 비한글 혼합 입력의 정규화 hash를 golden 값으로 고정한다', async () => {
        const normalized = normalizeWordApprovalEntries([
            { word: '😀', themeCodes: ['11'] },
            { word: '나비', themeCodes: ['20', '10'] },
            { word: 'apple', themeCodes: ['30'] },
            { word: '가방', themeCodes: ['12'] },
            { word: '42', themeCodes: ['2', '10'] },
            { word: '각', themeCodes: ['13'] },
        ]);
        if (!normalized.ok) {
            throw new Error('expected normalized mixed-character entries');
        }

        const payload = await buildApprovalPayload(normalized.value, 2);

        expect(payload.inputHash).toBe(
            '4ea8dca322962511f63f93d99090dfcff44026aaad9206d046cb23b1e1aa853d',
        );
        expect(payload.batches.map((batch) => batch.payloadHash)).toEqual([
            'ae064e3d5a9ce71608f46a8a11753f5f2f16fd987eaca7c3fb132cf709d1032a',
            '24372bb503b9f46cda1b61336a40d322cb14b624db4be8bdd76e7b07611293c7',
            'f808c47ad767554f91ccaa8261f31bf9292f0ce7d7286e9e6fedf64aefbc0241',
        ]);
    });
});

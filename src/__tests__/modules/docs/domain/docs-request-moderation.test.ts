import { ok } from '@/src/shared/application/result';
import {
    normalizeApproveDocsRequestsCommand,
    normalizeRejectDocsRequestsCommand,
    type ApproveDocsRequestsCommand,
    type RejectDocsRequestsCommand,
} from '@/src/modules/docs/domain/docs-request-moderation';

describe('docs request moderation domain', () => {
    it('sorts approval selections by request ID', () => {
        expect(normalizeApproveDocsRequestsCommand({
            selections: [
                { requestId: 22, duem: false },
                { requestId: 11, duem: true },
            ],
        })).toEqual(ok({
            selections: [
                { requestId: 11, duem: true },
                { requestId: 22, duem: false },
            ],
        }));
    });

    it('sorts rejection request IDs', () => {
        expect(normalizeRejectDocsRequestsCommand({ requestIds: [22, 11] }))
            .toEqual(ok({ requestIds: [11, 22] }));
    });

    it.each([
        ['an empty approval selection list', normalizeApproveDocsRequestsCommand, { selections: [] }, 'selections'],
        ['an approval selection list with 31 entries', normalizeApproveDocsRequestsCommand, {
            selections: Array.from({ length: 31 }, (_, index) => ({ requestId: index + 1, duem: true })),
        }, 'selections'],
        ['an approval request ID of zero', normalizeApproveDocsRequestsCommand, {
            selections: [{ requestId: 0, duem: true }],
        }, 'requestId'],
        ['an approval request ID beyond Number.MAX_SAFE_INTEGER', normalizeApproveDocsRequestsCommand, {
            selections: [{ requestId: Number.MAX_SAFE_INTEGER + 1, duem: true }],
        }, 'requestId'],
        ['duplicate approval request IDs', normalizeApproveDocsRequestsCommand, {
            selections: [{ requestId: 1, duem: true }, { requestId: 1, duem: false }],
        }, 'requestId'],
        ['a non-boolean approval duem value', normalizeApproveDocsRequestsCommand, {
            selections: [{ requestId: 1, duem: 'true' }],
        }, 'duem'],
    ] as Array<[string, (command: ApproveDocsRequestsCommand) => unknown, unknown, string]>)
    ('rejects %s', (_name, normalize, command, field) => {
        expect(normalize(command as ApproveDocsRequestsCommand)).toMatchObject({
            ok: false,
            error: { kind: 'validation', field },
        });
    });

    it('describes a non-boolean approval duem value as a duem validation error', () => {
        expect(normalizeApproveDocsRequestsCommand({
            selections: [{ requestId: 1, duem: 'true' as unknown as boolean }],
        })).toEqual({
            ok: false,
            error: {
                kind: 'validation',
                field: 'duem',
                message: '두음 여부는 불리언이어야 합니다.',
            },
        });
    });

    it.each([
        ['an empty rejection request ID list', { requestIds: [] }, 'requestIds'],
        ['a rejection request ID list with 31 entries', {
            requestIds: Array.from({ length: 31 }, (_, index) => index + 1),
        }, 'requestIds'],
        ['a rejection request ID of zero', { requestIds: [0] }, 'requestId'],
        ['a rejection request ID beyond Number.MAX_SAFE_INTEGER', {
            requestIds: [Number.MAX_SAFE_INTEGER + 1],
        }, 'requestId'],
        ['duplicate rejection request IDs', { requestIds: [1, 1] }, 'requestId'],
    ] as Array<[string, unknown, string]>)('rejects %s', (_name, command, field) => {
        expect(normalizeRejectDocsRequestsCommand(command as RejectDocsRequestsCommand)).toMatchObject({
            ok: false,
            error: { kind: 'validation', field },
        });
    });
});

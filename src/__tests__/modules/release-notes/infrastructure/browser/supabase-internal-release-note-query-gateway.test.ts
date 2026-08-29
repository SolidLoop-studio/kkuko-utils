jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: {},
}));

import { SupabaseInternalReleaseNoteQueryGateway } from '@/src/modules/release-notes/infrastructure/browser/supabase-internal-release-note-query-gateway';
import { err, ok } from '@/src/shared/application/result';

interface RequestDouble extends PromiseLike<unknown> {
    order(column: string, options: { ascending: boolean }): RequestDouble;
}

const row = {
    id: 3,
    title: '업데이트',
    content: '변경 내용',
    created_at: '2026-08-30T10:00:00.123+09:00',
    link: 'https://example.com/release',
};

const createGateway = (response: unknown, shouldThrow = false) => {
    const calls: string[] = [];
    const request: RequestDouble = {
        order: jest.fn((column, options) => {
            calls.push(`order:${column}:${options.ascending}`);
            return request;
        }),
        then: (resolve, reject) => (
            shouldThrow
                ? Promise.reject(new Error('private database detail')).then(resolve, reject)
                : Promise.resolve(response).then(resolve, reject)
        ),
    };
    const select = jest.fn((columns: string) => {
        calls.push(`select:${columns}`);
        return request;
    });
    const from = jest.fn((table: string) => {
        calls.push(`from:${table}`);
        return { select };
    });
    return {
        gateway: new SupabaseInternalReleaseNoteQueryGateway({ from } as never),
        calls,
    };
};

describe('SupabaseInternalReleaseNoteQueryGateway', () => {
    test('loads newest-first internal notes and maps snake_case rows to camelCase', async () => {
        // Break caught: losing the visible order/fields or leaking database column names.
        const { gateway, calls } = createGateway({ data: [row], error: null });

        await expect(gateway.load()).resolves.toEqual(ok([{
            id: 3,
            title: '업데이트',
            content: '변경 내용',
            createdAt: '2026-08-30T10:00:00.123+09:00',
            link: 'https://example.com/release',
        }]));
        expect(calls).toEqual([
            'from:release_note',
            'select:id, title, content, created_at, link',
            'order:created_at:false',
        ]);
    });

    test.each([
        ['malformed row', { data: [{ ...row, id: '3' }], error: null }],
        ['invalid date', { data: [{ ...row, created_at: 'not-a-date' }], error: null }],
        ['a parseable non-timestamp', { data: [{ ...row, created_at: '0' }], error: null }],
        ['an impossible calendar date', { data: [{ ...row, created_at: '2026-02-30T01:00:00Z' }], error: null }],
        ['an impossible time', { data: [{ ...row, created_at: '2026-08-30T24:01:00Z' }], error: null }],
        ['non-array data', { data: row, error: null }],
        ['returned Supabase error', { data: null, error: { message: 'private PostgREST detail' } }],
    ])('maps %s to one stable public error', async (_label, response) => {
        // Break caught: trusting unknown rows or exposing returned Supabase diagnostics.
        const { gateway } = createGateway(response);

        await expect(gateway.load()).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '릴리즈 노트를 불러오는 중 오류가 발생했습니다.',
        }));
    });

    test('maps a thrown Supabase failure to the stable public error', async () => {
        // Break caught: allowing a rejected browser query to escape Infrastructure.
        const { gateway } = createGateway({ data: [row], error: null }, true);

        await expect(gateway.load()).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '릴리즈 노트를 불러오는 중 오류가 발생했습니다.',
        }));
    });
});

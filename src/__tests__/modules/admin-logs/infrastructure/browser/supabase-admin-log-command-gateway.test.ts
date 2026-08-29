jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn() },
}));

import type { DeleteAdminLogsCommand } from '@/src/modules/admin-logs/application/admin-log-command-ports';
import {
    SupabaseAdminLogCommandGateway,
    type AdminLogDeleteClient,
    type AdminLogDeleteQuery,
} from '@/src/modules/admin-logs/infrastructure/browser/supabase-admin-log-command-gateway';

type DeleteCall =
    | ['from', 'logs' | 'docs_logs']
    | ['delete']
    | ['in', 'id', number[]]
    | ['select', 'id'];

const createClient = (response: unknown, shouldReject = false) => {
    const calls: DeleteCall[] = [];
    const query: AdminLogDeleteQuery = {
        delete() {
            calls.push(['delete']);
            return query;
        },
        in(column: 'id', ids: number[]) {
            calls.push(['in', column, [...ids]]);
            return query;
        },
        select(columns: 'id') {
            calls.push(['select', columns]);
            return shouldReject ? Promise.reject(response) : Promise.resolve(response);
        },
    };
    const client: AdminLogDeleteClient = {
        from(table: 'logs' | 'docs_logs') {
            calls.push(['from', table]);
            return query;
        },
    };

    return { client, calls };
};

const deleteInfrastructureError = {
    ok: false,
    error: {
        kind: 'infrastructure',
        message: '선택한 로그를 삭제하는 중 오류가 발생했습니다.',
    },
} as const;

describe('SupabaseAdminLogCommandGateway', () => {
    it.each([
        ['word', 'logs'],
        ['docs', 'docs_logs'],
    ] as const)(
        'deletes selected %s logs and returns caller-ordered validated IDs',
        async (kind, table) => {
            // Break caught: targeting the wrong table, omitting returned-row validation, or adopting DB row order.
            const command: DeleteAdminLogsCommand = { kind, ids: [23, 5, 17] };
            const { client, calls } = createClient({
                data: [{ id: 5 }, { id: 17 }, { id: 23 }],
                error: null,
            });

            await expect(
                new SupabaseAdminLogCommandGateway(client).deleteLogs(command),
            ).resolves.toEqual({
                ok: true,
                value: { deletedIds: [23, 5, 17] },
            });
            expect(calls).toEqual([
                ['from', table],
                ['delete'],
                ['in', 'id', [23, 5, 17]],
                ['select', 'id'],
            ]);
        },
    );

    it.each([
        ['missing selected row', { data: [{ id: 23 }, { id: 5 }], error: null }],
        ['unexpected extra row', { data: [{ id: 23 }, { id: 5 }, { id: 17 }, { id: 31 }], error: null }],
        ['duplicate returned ID', { data: [{ id: 23 }, { id: 5 }, { id: 5 }], error: null }],
        ['non-array data', { data: { id: 23 }, error: null }],
        ['malformed row', { data: [{ id: 23 }, { privateId: 5 }, { id: 17 }], error: null }],
        ['zero ID', { data: [{ id: 23 }, { id: 0 }, { id: 17 }], error: null }],
        ['fractional ID', { data: [{ id: 23 }, { id: 5.5 }, { id: 17 }], error: null }],
        ['unsafe ID', { data: [{ id: 23 }, { id: Number.MAX_SAFE_INTEGER + 1 }, { id: 17 }], error: null }],
        ['missing error discriminator', { data: [{ id: 23 }, { id: 5 }, { id: 17 }] }],
        ['malformed response', null],
    ])('maps %s to the stable infrastructure error', async (_label, response) => {
        // Break caught: accepting a partial, over-broad, duplicated, or malformed database authority result.
        const { client } = createClient(response);

        const result = await new SupabaseAdminLogCommandGateway(client).deleteLogs({
            kind: 'word',
            ids: [23, 5, 17],
        });

        expect(result).toEqual(deleteInfrastructureError);
        expect(JSON.stringify(result)).not.toContain('privateId');
    });

    it('maps a returned private database error to the stable infrastructure error', async () => {
        // Break caught: exposing returned PostgREST diagnostics to Application.
        const { client } = createClient({
            data: null,
            error: { message: 'private database detail' },
        });

        const result = await new SupabaseAdminLogCommandGateway(client).deleteLogs({
            kind: 'docs',
            ids: [8],
        });

        expect(result).toEqual(deleteInfrastructureError);
        expect(JSON.stringify(result)).not.toContain('private');
    });

    it('maps a rejected delete query to the stable infrastructure error', async () => {
        // Break caught: leaking a rejected query promise or its private transport detail.
        const { client } = createClient(new Error('private transport detail'), true);

        const result = await new SupabaseAdminLogCommandGateway(client).deleteLogs({
            kind: 'word',
            ids: [6],
        });

        expect(result).toEqual(deleteInfrastructureError);
        expect(JSON.stringify(result)).not.toContain('private');
    });
});

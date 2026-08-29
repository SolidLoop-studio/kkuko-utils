jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: {},
}));

import { SupabaseAdminLogsInitialQueryGateway } from '@/src/modules/admin-logs/infrastructure/browser/supabase-admin-logs-initial-query-gateway';
import { err, ok } from '@/src/shared/application/result';

const stableError = err({
    kind: 'infrastructure' as const,
    message: '관리자 로그를 불러오는 중 오류가 발생했습니다.',
});

const successfulResponse = {
    data: [{ id: 31, name: '주제 문서', typez: 'theme' }],
    error: null,
};

interface QueryDouble {
    select(columns: string): QueryDouble;
    eq(column: string, value: boolean): QueryDouble;
    then(
        resolve: (value: unknown) => unknown,
        reject: (reason: unknown) => unknown,
    ): Promise<unknown>;
}

const createQuery = (response: unknown, calls: string[]) => {
    const query: QueryDouble = {
        select: jest.fn((columns: string) => {
            calls.push(`select:${columns}`);
            return query;
        }),
        eq: jest.fn((column: string, value: boolean) => {
            calls.push(`eq:${column}:${value}`);
            return query;
        }),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => (
            Promise.resolve(response).then(resolve, reject)
        ),
    };
    return query;
};

const createGateway = (
    response: unknown = successfulResponse,
    isProduction = false,
) => {
    const calls: string[] = [];
    const query = createQuery(response, calls);
    const from = jest.fn((table: string) => {
        calls.push(`from:${table}`);
        if (table !== 'docs') throw new Error(`Unexpected initial-query table: ${table}`);
        return query;
    });

    return {
        gateway: new SupabaseAdminLogsInitialQueryGateway({ from } as never, isProduction),
        calls,
        from,
    };
};

describe('SupabaseAdminLogsInitialQueryGateway', () => {
    test('loads only document choices and maps them to the initial projection', async () => {
        // Break caught: restoring word/docs log reads to the initial path or leaking database row names.
        const { gateway, calls, from } = createGateway();

        await expect(gateway.loadInitial()).resolves.toEqual(ok({
            documentChoices: [{ id: 31, name: '주제 문서', type: 'theme' }],
        }));
        expect(calls).toEqual([
            'from:docs',
            'select:id, name, typez',
        ]);
        expect(from).toHaveBeenCalledTimes(1);
    });

    test('keeps hidden document choices out of the production query', async () => {
        // Break caught: widening the production filter choices beyond the legacy allDocs behavior.
        const { gateway, calls } = createGateway(successfulResponse, true);

        await gateway.loadInitial();

        expect(calls).toContain('eq:is_hidden:false');
    });

    test.each([
        ['a returned document-choice query error', { data: null, error: { message: 'private detail' } }],
        ['a malformed document choice', { data: [{ id: 31, name: '주제 문서', typez: 'unknown' }], error: null }],
    ])('maps %s to one stable public error', async (_description, response) => {
        // Break caught: accepting malformed document choices or exposing PostgREST diagnostics.
        const { gateway } = createGateway(response);

        await expect(gateway.loadInitial()).resolves.toEqual(stableError);
    });
});

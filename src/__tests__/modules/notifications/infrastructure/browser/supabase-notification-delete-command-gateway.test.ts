jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn() },
}));

import {
    SupabaseNotificationDeleteCommandGateway,
    type NotificationDeleteClient,
    type NotificationDeleteQuery,
} from '@/src/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway';

const managedImageUrl =
    'https://project.supabase.co/storage/v1/object/public/public_img/notifications/old.png';

type DeleteCall =
    | ['from', 'notification']
    | ['delete']
    | ['eq', 'id', number]
    | ['select', 'id, img']
    | ['maybeSingle'];

const createClient = (response: unknown, shouldReject = false) => {
    const calls: DeleteCall[] = [];
    const query: NotificationDeleteQuery = {
        delete() {
            calls.push(['delete']);
            return query;
        },
        eq(column: 'id', value: number) {
            calls.push(['eq', column, value]);
            return query;
        },
        select(columns: 'id, img') {
            calls.push(['select', columns]);
            return query;
        },
        maybeSingle() {
            calls.push(['maybeSingle']);
            return shouldReject ? Promise.reject(response) : Promise.resolve(response);
        },
    };
    const client: NotificationDeleteClient = {
        from(table: 'notification') {
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
        message: '공지사항 삭제에 실패했습니다.',
    },
} as const;

describe('SupabaseNotificationDeleteCommandGateway', () => {
    it.each([
        ['a managed image', managedImageUrl],
        ['no image', null],
    ] as const)('returns the selected deleted row with %s', async (_label, imageUrl) => {
        // Break caught: losing the database-authoritative image or omitting the returned-row projection.
        const { client, calls } = createClient({
            data: { id: 17, img: imageUrl },
            error: null,
        });

        await expect(new SupabaseNotificationDeleteCommandGateway(client).deleteById(17)).resolves.toEqual({
            ok: true,
            value: {
                id: 17,
                imageUrl,
            },
        });
        expect(calls).toEqual([
            ['from', 'notification'],
            ['delete'],
            ['eq', 'id', 17],
            ['select', 'id, img'],
            ['maybeSingle'],
        ]);
    });

    it.each([
        ['a missing row', { data: null, error: null }],
        ['non-record data', { data: 'private malformed row', error: null }],
        ['zero ID', { data: { id: 0, img: null }, error: null }],
        ['fractional ID', { data: { id: 17.5, img: null }, error: null }],
        ['unsafe ID', { data: { id: Number.MAX_SAFE_INTEGER + 1, img: null }, error: null }],
        ['an invalid image', { data: { id: 17, img: 42 }, error: null }],
        ['a missing error discriminator', { data: { id: 17, img: null } }],
        ['a malformed response', null],
    ])('maps %s to the existing infrastructure error without a not-found distinction', async (_label, response) => {
        // Break caught: accepting malformed authority or introducing a new missing-row public outcome.
        const { client } = createClient(response);

        const result = await new SupabaseNotificationDeleteCommandGateway(client).deleteById(17);

        expect(result).toEqual(deleteInfrastructureError);
        expect(JSON.stringify(result)).not.toContain('private malformed row');
    });

    it('maps a returned private database error to the same stable infrastructure error', async () => {
        // Break caught: exposing private PostgREST details at the Application boundary.
        const { client } = createClient({
            data: null,
            error: {
                message: 'private database detail',
                details: 'private database details',
            },
        });

        const result = await new SupabaseNotificationDeleteCommandGateway(client).deleteById(17);

        expect(result).toEqual(deleteInfrastructureError);
        expect(JSON.stringify(result)).not.toContain('private');
    });

    it('maps a rejected delete query to the same stable infrastructure error', async () => {
        // Break caught: leaking a rejected delete projection or its private transport detail.
        const { client } = createClient(new Error('private transport detail'), true);

        const result = await new SupabaseNotificationDeleteCommandGateway(client).deleteById(17);

        expect(result).toEqual(deleteInfrastructureError);
        expect(JSON.stringify(result)).not.toContain('private');
    });
});

import { readFileSync } from 'node:fs';

import {
    SupabaseNotificationImageReferenceQueryGateway,
    type NotificationImageReferenceQueryClient,
    type NotificationImageReferenceQuery,
} from '@/src/modules/notifications/infrastructure/supabase/supabase-notification-image-reference-query-gateway';

const imageUrl =
    'https://project.supabase.co/storage/v1/object/public/public_img/notifications/notice.png';

type ReferenceCall =
    | ['from', 'notification']
    | ['select', 'id', { count: 'exact'; head: true }]
    | ['eq', 'img', string];

const createClient = (response: unknown, shouldReject = false) => {
    const calls: ReferenceCall[] = [];
    const query: NotificationImageReferenceQuery = {
        eq(column, value) {
            calls.push(['eq', column, value]);
            return shouldReject ? Promise.reject(response) : Promise.resolve(response);
        },
    };
    const client: NotificationImageReferenceQueryClient = {
        from(table) {
            calls.push(['from', table]);
            return {
                select(columns, options) {
                    calls.push(['select', columns, options]);
                    return query;
                },
            };
        },
    };

    return { client, calls };
};

const referenceInfrastructureError = {
    ok: false,
    error: {
        kind: 'infrastructure',
        message: '공지사항 이미지 참조를 확인하지 못했습니다.',
    },
} as const;

describe('SupabaseNotificationImageReferenceQueryGateway', () => {
    it.each([
        ['zero matches', 0, false],
        ['one match', 1, true],
        ['multiple matches', 3, true],
    ])('uses an exact head count and maps %s', async (_label, count, expectedReference) => {
        // Break caught: a non-exact or data-fetching lookup can make destructive cleanup decisions from incomplete data.
        const { client, calls } = createClient({ data: null, error: null, count });

        await expect(
            new SupabaseNotificationImageReferenceQueryGateway(client).hasReference(imageUrl),
        ).resolves.toEqual({ ok: true, value: expectedReference });
        expect(calls).toEqual([
            ['from', 'notification'],
            ['select', 'id', { count: 'exact', head: true }],
            ['eq', 'img', imageUrl],
        ]);
    });

    it.each([
        ['a returned private error', { data: null, count: 0, error: { message: 'private query detail' } }, false],
        ['a thrown query', new Error('private transport detail'), true],
        ['a null count', { data: null, count: null, error: null }, false],
        ['a negative count', { data: null, count: -1, error: null }, false],
        ['a fractional count', { data: null, count: 0.5, error: null }, false],
        ['an infinite count', { data: null, count: Infinity, error: null }, false],
        ['a NaN count', { data: null, count: Number.NaN, error: null }, false],
        ['a non-number count', { data: null, count: '0', error: null }, false],
        ['a malformed response', { data: null, count: 0 }, false],
    ] as const)('fails closed for %s without exposing private details', async (
        _label,
        response,
        shouldReject,
    ) => {
        // Break caught: uncertain reference counts can delete an image that still has a notification reference.
        const { client } = createClient(response, shouldReject);

        const result = await new SupabaseNotificationImageReferenceQueryGateway(client)
            .hasReference(imageUrl);

        expect(result).toEqual(referenceInfrastructureError);
        expect(JSON.stringify(result)).not.toContain('private');
    });
});

it('is environment-neutral', () => {
    const source = readFileSync(
        'src/modules/notifications/infrastructure/supabase/supabase-notification-image-reference-query-gateway.ts',
        'utf8',
    );

    expect(source).not.toMatch(/browser-client|server-client|next\/headers|next\/cache/u);
});

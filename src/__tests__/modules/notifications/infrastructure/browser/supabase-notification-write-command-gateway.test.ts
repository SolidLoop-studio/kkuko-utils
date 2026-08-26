jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn() },
}));

import type { NotificationWriteValues } from '@/src/modules/notifications/application/notification-write-command-ports';
import {
    SupabaseNotificationWriteCommandGateway,
    type NotificationWriteClient,
    type NotificationWritePayload,
    type NotificationWriteQuery,
} from '@/src/modules/notifications/infrastructure/browser/supabase-notification-write-command-gateway';

const existingImageUrl =
    'https://project.supabase.co/storage/v1/object/public/public_img/notifications/old.png';
const newImageUrl =
    'https://project.supabase.co/storage/v1/object/public/public_img/notifications/new.png';

const values: NotificationWriteValues = {
    title: '점검 안내',
    body: '점검 본문',
    imageUrl: newImageUrl,
    endsAt: '2026-08-30T00:00:00.000Z',
    isImportant: true,
    isModal: false,
};

const expectedPayload: NotificationWritePayload = {
    title: '점검 안내',
    body: '점검 본문',
    img: newImageUrl,
    end_at: '2026-08-30T00:00:00.000Z',
    is_important: true,
    is_modal: false,
};

type WriteCall =
    | ['from', 'notification']
    | ['insert', NotificationWritePayload]
    | ['update', NotificationWritePayload]
    | ['eq', 'id', number]
    | ['eq', 'img', string]
    | ['is', 'img', null]
    | ['select', 'id, img']
    | ['single']
    | ['maybeSingle'];

const createClient = (response: unknown, shouldReject = false) => {
    const calls: WriteCall[] = [];
    const resolveResponse = (): Promise<unknown> => shouldReject
        ? Promise.reject(response)
        : Promise.resolve(response);
    const query: NotificationWriteQuery = {
        insert(payload: NotificationWritePayload) {
            calls.push(['insert', payload]);
            return query;
        },
        update(payload: NotificationWritePayload) {
            calls.push(['update', payload]);
            return query;
        },
        eq(column: 'id' | 'img', value: number | string) {
            if (column === 'id' && typeof value === 'number') {
                calls.push(['eq', column, value]);
            } else if (column === 'img' && typeof value === 'string') {
                calls.push(['eq', column, value]);
            } else {
                throw new Error('Unexpected eq predicate');
            }
            return query;
        },
        is(column: 'img', value: null) {
            calls.push(['is', column, value]);
            return query;
        },
        select(columns: 'id, img') {
            calls.push(['select', columns]);
            return query;
        },
        single() {
            calls.push(['single']);
            return resolveResponse();
        },
        maybeSingle() {
            calls.push(['maybeSingle']);
            return resolveResponse();
        },
    };
    const client: NotificationWriteClient = {
        from(table: 'notification') {
            calls.push(['from', table]);
            return query;
        },
    };

    return { client, calls };
};

const saveInfrastructureError = {
    ok: false,
    error: {
        kind: 'infrastructure',
        message: '공지사항 저장에 실패했습니다.',
    },
} as const;

const modalOverlapError = {
    ok: false,
    error: {
        kind: 'conflict',
        code: 'NOTIFICATION_MODAL_OVERLAP',
        message: '모달 공지가 겹쳤습니다 (동일 기간에 모달 공지는 하나만 가능합니다)',
    },
} as const;

const staleImageError = {
    ok: false,
    error: {
        kind: 'conflict',
        code: 'NOTIFICATION_STALE_IMAGE',
        message: '공지사항이 다른 곳에서 수정되었습니다. 새로고침 후 다시 시도해주세요.',
    },
} as const;

describe('SupabaseNotificationWriteCommandGateway mapping', () => {
    it('creates with the exact database payload and maps the persisted row', async () => {
        // Break caught: camel-case or incomplete persistence payloads and unverified create projections.
        const { client, calls } = createClient({
            data: { id: 17, img: newImageUrl },
            error: null,
        });

        await expect(new SupabaseNotificationWriteCommandGateway(client).create(values)).resolves.toEqual({
            ok: true,
            value: {
                id: 17,
                imageUrl: newImageUrl,
                persistedPreviousImageUrl: null,
            },
        });
        expect(calls).toEqual([
            ['from', 'notification'],
            ['insert', expectedPayload],
            ['select', 'id, img'],
            ['single'],
        ]);
    });

    it('accepts and maps a valid created row without an image', async () => {
        // Break caught: rejecting null as an invalid persisted notification image.
        const imageLessValues: NotificationWriteValues = {
            ...values,
            imageUrl: null,
        };
        const { client } = createClient({
            data: { id: 17, img: null },
            error: null,
        });

        await expect(new SupabaseNotificationWriteCommandGateway(client).create(imageLessValues)).resolves.toEqual({
            ok: true,
            value: {
                id: 17,
                imageUrl: null,
                persistedPreviousImageUrl: null,
            },
        });
    });

    it('updates a row guarded by a null persisted image and returns the verified prior image', async () => {
        // Break caught: using equality instead of IS NULL or treating an unmatched caller value as authoritative.
        const { client, calls } = createClient({
            data: { id: 17, img: newImageUrl },
            error: null,
        });

        await expect(new SupabaseNotificationWriteCommandGateway(client).update(17, null, values)).resolves.toEqual({
            ok: true,
            value: {
                id: 17,
                imageUrl: newImageUrl,
                persistedPreviousImageUrl: null,
            },
        });
        expect(calls).toEqual([
            ['from', 'notification'],
            ['update', expectedPayload],
            ['eq', 'id', 17],
            ['is', 'img', null],
            ['select', 'id, img'],
            ['maybeSingle'],
        ]);
    });

    it('updates a row guarded by the expected persisted image and returns that verified prior image', async () => {
        // Break caught: omitting the non-null optimistic image predicate or losing the matched prior value.
        const { client, calls } = createClient({
            data: { id: 17, img: newImageUrl },
            error: null,
        });

        await expect(
            new SupabaseNotificationWriteCommandGateway(client).update(17, existingImageUrl, values),
        ).resolves.toEqual({
            ok: true,
            value: {
                id: 17,
                imageUrl: newImageUrl,
                persistedPreviousImageUrl: existingImageUrl,
            },
        });
        expect(calls).toEqual([
            ['from', 'notification'],
            ['update', expectedPayload],
            ['eq', 'id', 17],
            ['eq', 'img', existingImageUrl],
            ['select', 'id, img'],
            ['maybeSingle'],
        ]);
    });

    it('accepts and maps a valid updated row after removing its image', async () => {
        // Break caught: rejecting a committed image removal or losing its verified prior image.
        const imageRemovalValues: NotificationWriteValues = {
            ...values,
            imageUrl: null,
        };
        const { client } = createClient({
            data: { id: 17, img: null },
            error: null,
        });

        await expect(
            new SupabaseNotificationWriteCommandGateway(client).update(
                17,
                existingImageUrl,
                imageRemovalValues,
            ),
        ).resolves.toEqual({
            ok: true,
            value: {
                id: 17,
                imageUrl: null,
                persistedPreviousImageUrl: existingImageUrl,
            },
        });
    });
});

describe('SupabaseNotificationWriteCommandGateway safe errors', () => {
    it.each([
        ['null data', { data: null, error: null }],
        ['non-record data', { data: 'private malformed row', error: null }],
        ['zero ID', { data: { id: 0, img: null }, error: null }],
        ['fractional ID', { data: { id: 1.5, img: null }, error: null }],
        ['unsafe ID', { data: { id: Number.MAX_SAFE_INTEGER + 1, img: null }, error: null }],
        ['invalid image value', { data: { id: 17, img: 42 }, error: null }],
        ['missing error discriminator', { data: { id: 17, img: null } }],
    ])('maps a malformed create response with %s to the stable infrastructure error', async (_label, response) => {
        // Break caught: accepting an unsafe database row or malformed response envelope.
        const { client } = createClient(response);

        const result = await new SupabaseNotificationWriteCommandGateway(client).create(values);

        expect(result).toEqual(saveInfrastructureError);
        expect(JSON.stringify(result)).not.toContain('private malformed row');
    });

    it.each([
        ['non-record response', null],
        ['non-record data', { data: 'private malformed row', error: null }],
        ['negative ID', { data: { id: -1, img: null }, error: null }],
        ['non-integer ID', { data: { id: 17.25, img: null }, error: null }],
        ['unsafe ID', { data: { id: Number.MAX_SAFE_INTEGER + 1, img: null }, error: null }],
        ['invalid image value', { data: { id: 17, img: false }, error: null }],
        ['missing data field', { error: null }],
    ])('maps a malformed matched update response with %s to the stable infrastructure error', async (_label, response) => {
        // Break caught: returning prior-image authority from anything except a valid matched row.
        const { client } = createClient(response);

        const result = await new SupabaseNotificationWriteCommandGateway(client).update(
            17,
            existingImageUrl,
            values,
        );

        expect(result).toEqual(saveInfrastructureError);
        expect(JSON.stringify(result)).not.toContain('private malformed row');
    });

    it.each(['create', 'update'] as const)(
        'maps a returned private %s error to the stable infrastructure error without details',
        async (operation) => {
            // Break caught: exposing private PostgREST messages or details at the Application boundary.
            const { client } = createClient({
                data: null,
                error: {
                    code: 'PGRST999',
                    message: 'private database message',
                    details: 'private database details',
                    hint: 'private database hint',
                },
            });
            const gateway = new SupabaseNotificationWriteCommandGateway(client);

            const result = operation === 'create'
                ? await gateway.create(values)
                : await gateway.update(17, existingImageUrl, values);

            expect(result).toEqual(saveInfrastructureError);
            expect(JSON.stringify(result)).not.toContain('private');
            expect(result.ok ? null : result.error).not.toHaveProperty('cause');
        },
    );

    it.each(['create', 'update'] as const)(
        'maps PostgreSQL overlap code 23P01 from %s to the stable modal conflict',
        async (operation) => {
            // Break caught: flattening the modal-overlap constraint into a generic save failure.
            const { client } = createClient({
                data: null,
                error: {
                    code: '23P01',
                    message: 'private exclusion constraint detail',
                },
            });
            const gateway = new SupabaseNotificationWriteCommandGateway(client);

            const result = operation === 'create'
                ? await gateway.create(values)
                : await gateway.update(17, null, values);

            expect(result).toEqual(modalOverlapError);
            expect(JSON.stringify(result)).not.toContain('private');
        },
    );

    it.each(['create', 'update'] as const)(
        'maps a thrown %s query to the stable infrastructure error without details',
        async (operation) => {
            // Break caught: leaking rejected Supabase queries or their private transport details.
            const { client } = createClient(new Error('private transport detail'), true);
            const gateway = new SupabaseNotificationWriteCommandGateway(client);

            const result = operation === 'create'
                ? await gateway.create(values)
                : await gateway.update(17, existingImageUrl, values);

            expect(result).toEqual(saveInfrastructureError);
            expect(JSON.stringify(result)).not.toContain('private');
        },
    );

    it.each([
        ['null expected image', null],
        ['non-null expected image', existingImageUrl],
    ] as const)('returns the stable stale-image conflict for an unmatched update with %s', async (_label, expectedImageUrl) => {
        // Break caught: treating maybeSingle null as success or allowing caller-only cleanup authority.
        const { client } = createClient({ data: null, error: null });

        const result = await new SupabaseNotificationWriteCommandGateway(client).update(
            17,
            expectedImageUrl,
            values,
        );

        expect(result).toEqual(staleImageError);
    });
});

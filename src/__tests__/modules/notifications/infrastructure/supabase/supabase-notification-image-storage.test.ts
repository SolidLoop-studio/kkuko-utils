import { readFileSync } from 'node:fs';

import type { NotificationImageFile } from '@/src/modules/notifications/application/notification-write-command-types';
import {
    SupabaseNotificationImageStorage,
    type NotificationImageStorageBucket,
    type NotificationImageStorageClient,
    type NotificationImageUploadOptions,
} from '@/src/modules/notifications/infrastructure/supabase/supabase-notification-image-storage';

const supabaseUrl = 'https://project.supabase.co';
const publicUrl = `${supabaseUrl}/storage/v1/object/public/public_img/notifications/1777777777777_notice_image.png`;

const uploadInfrastructureError = {
    ok: false,
    error: {
        kind: 'infrastructure',
        message: '공지사항 이미지를 업로드하지 못했습니다.',
    },
} as const;

const cleanupInfrastructureError = {
    ok: false,
    error: {
        kind: 'infrastructure',
        message: '공지사항 이미지를 정리하지 못했습니다.',
    },
} as const;

type StorageCall =
    | ['from', 'public_img']
    | ['upload', string, Blob, NotificationImageUploadOptions]
    | ['getPublicUrl', string]
    | ['remove', string[]];

interface StorageResponses {
    upload?: unknown;
    publicUrl?: unknown;
    remove?: unknown;
    uploadThrows?: boolean;
    publicUrlThrows?: boolean;
    removeThrows?: boolean;
}

const createClient = ({
    upload,
    publicUrl: mappedPublicUrl = { data: { publicUrl }, error: null },
    remove = { data: [], error: null },
    uploadThrows = false,
    publicUrlThrows = false,
    removeThrows = false,
}: StorageResponses = {}) => {
    const calls: StorageCall[] = [];
    const bucket: NotificationImageStorageBucket = {
        upload(path, body, options) {
            calls.push(['upload', path, body, options]);
            const uploadResponse = upload ?? {
                data: {
                    path,
                    id: 'upload-id',
                    fullPath: `public_img/${path}`,
                },
                error: null,
            };
            return uploadThrows
                ? Promise.reject(uploadResponse)
                : Promise.resolve(uploadResponse);
        },
        getPublicUrl(path) {
            calls.push(['getPublicUrl', path]);
            if (publicUrlThrows) throw mappedPublicUrl;
            return mappedPublicUrl;
        },
        remove(paths) {
            calls.push(['remove', paths]);
            return removeThrows
                ? Promise.reject(remove)
                : Promise.resolve(remove);
        },
    };
    const client: NotificationImageStorageClient = {
        storage: {
            from(bucketName) {
                calls.push(['from', bucketName]);
                return bucket;
            },
        },
    };

    return { client, calls };
};

const createFile = (
    name = 'notice image.png',
    type = 'image/png',
    bytes = new Uint8Array([137, 80, 78, 71]),
): NotificationImageFile => ({
    name,
    type,
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer,
});

const createStorage = (client: NotificationImageStorageClient) =>
    new SupabaseNotificationImageStorage(
        client,
        () => 1_777_777_777_777,
        supabaseUrl,
    );

describe('SupabaseNotificationImageStorage upload and removal', () => {
    it('uploads a structural file as a typed Blob at the deterministic managed path', async () => {
        // Break caught: uploading raw structural files or changing the bucket, prefix, path, or cache policy.
        const { client, calls } = createClient();

        await expect(createStorage(client).upload(createFile())).resolves.toEqual({
            ok: true,
            value: {
                path: 'notifications/1777777777777_notice_image.png',
                publicUrl,
            },
        });

        expect(calls).toHaveLength(3);
        expect(calls[0]).toEqual(['from', 'public_img']);
        expect(calls[1]?.[0]).toBe('upload');
        if (calls[1]?.[0] !== 'upload') throw new Error('Expected an upload call');
        expect(calls[1][1]).toBe('notifications/1777777777777_notice_image.png');
        expect(calls[1][2]).toBeInstanceOf(Blob);
        expect(calls[1][2]).toMatchObject({ size: 4, type: 'image/png' });
        expect(calls[1][3]).toEqual({ cacheControl: '3600', upsert: false });
        expect(calls[2]).toEqual([
            'getPublicUrl',
            'notifications/1777777777777_notice_image.png',
        ]);
    });

    it.each([
        ['forward slashes', 'folder/notice.png', 'folder_notice.png'],
        ['backslashes', 'folder\\notice.png', 'folder_notice.png'],
        ['control and whitespace runs', 'notice\u0000 \t\nimage.png', 'notice_image.png'],
        ['an empty name', '', 'image'],
    ])('sanitizes %s without allowing a caller-controlled object path', async (_label, name, safeName) => {
        // Break caught: object names creating nested paths or producing nondeterministic unsafe names.
        const { client, calls } = createClient();

        await createStorage(client).upload(createFile(name));

        expect(calls[1]?.[0]).toBe('upload');
        if (calls[1]?.[0] !== 'upload') throw new Error('Expected an upload call');
        expect(calls[1][1]).toBe(`notifications/1777777777777_${safeName}`);
    });

    it('removes only the requested object path from the public image bucket', async () => {
        // Break caught: removing from the wrong bucket or passing an unwrapped path.
        const { client, calls } = createClient();
        const path = 'notifications/1777777777777_notice_image.png';

        await expect(createStorage(client).remove(path)).resolves.toEqual({
            ok: true,
            value: undefined,
        });
        expect(calls).toEqual([
            ['from', 'public_img'],
            ['remove', [path]],
        ]);
    });

    it.each([
        ['returned upload error', { data: null, error: { message: 'private upload detail' } }, false],
        ['null upload data', { data: null, error: null }, false],
        ['array upload data', { data: [], error: null }, false],
        ['empty upload data', { data: {}, error: null }, false],
        ['a non-string upload path', { data: { path: 42 }, error: null }, false],
        ['a blank upload path', { data: { path: '   ' }, error: null }, false],
        ['a mismatched upload path', { data: { path: 'notifications/another.png' }, error: null }, false],
        ['malformed upload response', { data: { path: 'unexpected' } }, false],
        ['thrown upload error', new Error('private upload rejection'), true],
    ] as const)('maps a %s to the stable upload error', async (_label, upload, uploadThrows) => {
        // Break caught: leaking Storage errors or continuing to URL mapping after an uncertain upload.
        const { client, calls } = createClient({ upload, uploadThrows });

        const result = await createStorage(client).upload(createFile());

        expect(result).toEqual(uploadInfrastructureError);
        expect(JSON.stringify(result)).not.toContain('private');
        expect(calls.map(([operation]) => operation)).toEqual(['from', 'upload']);
    });

    it('maps a structural file read rejection to the stable upload error before Storage access', async () => {
        // Break caught: exposing File API failures or creating a partial Storage mutation.
        const { client, calls } = createClient();
        const file: NotificationImageFile = {
            name: 'notice.png',
            type: 'image/png',
            size: 1,
            arrayBuffer: async () => {
                throw new Error('private file read failure');
            },
        };

        const result = await createStorage(client).upload(file);

        expect(result).toEqual(uploadInfrastructureError);
        expect(JSON.stringify(result)).not.toContain('private');
        expect(calls).toEqual([]);
    });

    it.each([
        ['a non-record mapping', null, false],
        ['a missing data value', { error: null }, false],
        ['a non-string URL', { data: { publicUrl: 42 }, error: null }, false],
        ['a blank URL', { data: { publicUrl: '   ' }, error: null }, false],
        ['a returned mapping error', { data: { publicUrl }, error: { message: 'private URL detail' } }, false],
        ['a thrown mapping failure', new Error('private URL rejection'), true],
    ] as const)('cleans up the uploaded object and returns the stable upload error for %s', async (
        _label,
        mappedPublicUrl,
        publicUrlThrows,
    ) => {
        // Break caught: retaining an object whose public URL cannot be safely returned.
        const { client, calls } = createClient({ publicUrl: mappedPublicUrl, publicUrlThrows });

        const result = await createStorage(client).upload(createFile());

        expect(result).toEqual(uploadInfrastructureError);
        expect(JSON.stringify(result)).not.toContain('private');
        expect(calls.map(([operation]) => operation)).toEqual([
            'from',
            'upload',
            'getPublicUrl',
            'remove',
        ]);
        expect(calls[3]).toEqual([
            'remove',
            ['notifications/1777777777777_notice_image.png'],
        ]);
    });

    it.each([
        ['returns an error', { data: null, error: { message: 'private cleanup detail' } }, false],
        ['returns a malformed response', { data: [] }, false],
        ['throws', new Error('private cleanup rejection'), true],
    ] as const)('preserves the upload error when malformed-URL cleanup %s', async (
        _label,
        remove,
        removeThrows,
    ) => {
        // Break caught: replacing the primary URL-mapping failure with cleanup details.
        const { client } = createClient({
            publicUrl: { data: { publicUrl: '' }, error: null },
            remove,
            removeThrows,
        });

        const result = await createStorage(client).upload(createFile());

        expect(result).toEqual(uploadInfrastructureError);
        expect(JSON.stringify(result)).not.toContain('private');
    });

    it.each([
        ['a returned error', { data: null, error: { message: 'private cleanup detail' } }, false],
        ['a missing data value', { error: null }, false],
        ['a malformed response', { data: [], error: 'not null' }, false],
        ['a thrown error', new Error('private cleanup rejection'), true],
    ] as const)('maps %s during removal to the stable cleanup error', async (
        _label,
        remove,
        removeThrows,
    ) => {
        // Break caught: leaking Storage cleanup failures or reporting uncertain removals as successful.
        const { client } = createClient({ remove, removeThrows });

        const result = await createStorage(client).remove('notifications/old.png');

        expect(result).toEqual(cleanupInfrastructureError);
        expect(JSON.stringify(result)).not.toContain('private');
    });
});

describe('SupabaseNotificationImageStorage managed URL parsing', () => {
    const { client } = createClient();
    const storage = createStorage(client);

    it('returns the decoded managed object path for the exact origin, bucket, and prefix', () => {
        // Break caught: returning an encoded or caller-controlled URL instead of the Storage object path.
        expect(storage.managedPathFromPublicUrl(publicUrl)).toBe(
            'notifications/1777777777777_notice_image.png',
        );
        expect(storage.managedPathFromPublicUrl(
            `${supabaseUrl}/storage/v1/object/public/public_img/notifications/notice%20image.png`,
        )).toBe('notifications/notice image.png');
    });

    it.each([
        ['another origin', 'https://attacker.example/storage/v1/object/public/public_img/notifications/image.png'],
        ['another port', 'https://project.supabase.co:444/storage/v1/object/public/public_img/notifications/image.png'],
        ['a raw backslash that changes the parsed pathname', 'https://project.supabase.co\\evil/storage/v1/object/public/public_img/notifications/image.png'],
        ['another bucket', `${supabaseUrl}/storage/v1/object/public/private_img/notifications/image.png`],
        ['a bucket with the managed bucket as a prefix', `${supabaseUrl}/storage/v1/object/public/public_img_backup/notifications/image.png`],
        ['another object prefix', `${supabaseUrl}/storage/v1/object/public/public_img/avatars/image.png`],
        ['the bare notification directory', `${supabaseUrl}/storage/v1/object/public/public_img/notifications/`],
        ['an empty nested basename', `${supabaseUrl}/storage/v1/object/public/public_img/notifications/archive/`],
        ['encoded slash traversal', `${supabaseUrl}/storage/v1/object/public/public_img/notifications%2F..%2Fimage.png`],
        ['encoded dot traversal', `${supabaseUrl}/storage/v1/object/public/public_img/notifications/%2e%2e/image.png`],
        ['encoded current-directory traversal', `${supabaseUrl}/storage/v1/object/public/public_img/notifications/%2e/image.png`],
        ['decoded backslash traversal', `${supabaseUrl}/storage/v1/object/public/public_img/notifications/%2e%2e%5Cimage.png`],
        ['malformed percent encoding', `${supabaseUrl}/storage/v1/object/public/public_img/notifications/%E0%A4%A`],
        ['a non-URL string', 'not a public URL'],
    ])('returns null for %s', (_label, candidate) => {
        // Break caught: deleting an object not proven to be below the exact managed location.
        expect(storage.managedPathFromPublicUrl(candidate)).toBeNull();
    });

    it('returns null when the configured Supabase URL has no valid origin', () => {
        // Break caught: accepting managed paths when same-origin authority cannot be established.
        const invalidConfiguration = new SupabaseNotificationImageStorage(
            client,
            () => 1_777_777_777_777,
            '',
        );

        expect(invalidConfiguration.managedPathFromPublicUrl(publicUrl)).toBeNull();
    });

    it.each([
        [
            'custom opaque schemes',
            'foo://configured',
            'foo://attacker/storage/v1/object/public/public_img/notifications/image.png',
        ],
        [
            'file URLs',
            'file:///configured',
            'file:///storage/v1/object/public/public_img/notifications/image.png',
        ],
    ])('returns null when configured and candidate %s both have an opaque origin', (
        _label,
        configuredUrl,
        candidateUrl,
    ) => {
        // Break caught: treating the opaque string origin "null" as proof of shared HTTP authority.
        const opaqueConfiguration = new SupabaseNotificationImageStorage(
            client,
            () => 1_777_777_777_777,
            configuredUrl,
        );

        expect(opaqueConfiguration.managedPathFromPublicUrl(candidateUrl)).toBeNull();
    });
});

it('is environment-neutral', () => {
    const source = readFileSync(
        'src/modules/notifications/infrastructure/supabase/supabase-notification-image-storage.ts',
        'utf8',
    );

    expect(source).not.toMatch(/browser-client|server-client|next\/headers|next\/cache/u);
});

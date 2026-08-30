import type { NotificationImageReferenceQueryGateway } from '@/src/modules/notifications/application/notification-image-reference-query-ports';
import type {
    NotificationImageStorage,
    NotificationWriteCommandGateway,
    NotificationWriteValues,
    PersistedNotificationWriteResult,
    StoredNotificationImage,
} from '@/src/modules/notifications/application/notification-write-command-ports';
import type {
    CreateNotificationCommand,
    NotificationImageFile,
    SaveNotificationCommand,
    UpdateNotificationCommand,
} from '@/src/modules/notifications/application/notification-write-command-types';
import { SaveNotificationService } from '@/src/modules/notifications/application/save-notification';
import { err, ok, type Result } from '@/src/shared/application/result';

const managedOldUrl = 'https://project.supabase.co/storage/v1/object/public/public_img/notifications/old.png';
const managedCallerUrl = 'https://project.supabase.co/storage/v1/object/public/public_img/notifications/caller.png';
const externalOldUrl = 'https://cdn.example.com/old.png';
const newUrl = 'https://project.supabase.co/storage/v1/object/public/public_img/notifications/new.png';

const imageFile: NotificationImageFile = {
    name: 'new.png',
    type: 'image/png',
    size: 3,
    arrayBuffer: async () => new ArrayBuffer(3),
};

const baseFields = {
    title: '  점검 안내  ',
    body: '\n점검 본문\n',
    endsAt: '2026-08-30T00:00:00.000Z',
    isImportant: true,
    isModal: false,
};

const createCommand = (overrides: Partial<CreateNotificationCommand> = {}): CreateNotificationCommand => ({
    ...baseFields,
    mode: 'create',
    imageChange: { kind: 'keep' },
    ...overrides,
});

const updateCommand = (overrides: Partial<UpdateNotificationCommand> = {}): UpdateNotificationCommand => ({
    ...baseFields,
    mode: 'update',
    id: 17,
    expectedImageUrl: managedOldUrl,
    imageChange: { kind: 'keep' },
    ...overrides,
});

type ResultBehavior<T> =
    | { kind: 'return'; result: Result<T> }
    | { kind: 'throw'; error: unknown };

const returned = <T>(result: Result<T>): ResultBehavior<T> => ({ kind: 'return', result });
const thrown = <T>(error: unknown): ResultBehavior<T> => ({ kind: 'throw', error });

const resolveBehavior = async <T>(behavior: ResultBehavior<T>): Promise<Result<T>> => {
    if (behavior.kind === 'throw') throw behavior.error;
    return behavior.result;
};

const saved = (
    imageUrl: string | null,
    persistedPreviousImageUrl: string | null = null,
): Result<PersistedNotificationWriteResult> => ok({
    id: 17,
    imageUrl,
    persistedPreviousImageUrl,
});

const databaseFailure = err<PersistedNotificationWriteResult>({
    kind: 'conflict',
    code: 'NOTIFICATION_STALE_IMAGE',
    message: '공지사항이 다른 곳에서 수정되었습니다. 새로고침 후 다시 시도해주세요.',
});

const cleanupFailure = err<void>({
    kind: 'infrastructure',
    message: '공지사항 이미지를 정리하지 못했습니다.',
});

const referenceFailure = err<boolean>({
    kind: 'infrastructure',
    message: '공지사항 이미지 참조를 확인하지 못했습니다.',
});

const imageLabel = (imageUrl: string | null): string => {
    if (imageUrl === newUrl) return 'new-url';
    if (imageUrl === managedOldUrl) return 'old-url';
    if (imageUrl === managedCallerUrl) return 'caller-url';
    if (imageUrl === externalOldUrl) return 'external-url';
    return 'null';
};

class FakeWriteGateway implements NotificationWriteCommandGateway {
    readonly createCalls: NotificationWriteValues[] = [];
    readonly updateCalls: Array<{
        id: number;
        expectedImageUrl: string | null;
        values: NotificationWriteValues;
    }> = [];

    constructor(
        private readonly events: string[],
        private readonly createBehavior: ResultBehavior<PersistedNotificationWriteResult> = returned(saved(null)),
        private readonly updateBehavior: ResultBehavior<PersistedNotificationWriteResult> = returned(saved(managedOldUrl, managedOldUrl)),
        private readonly updateEvent?: string,
    ) {}

    async create(values: NotificationWriteValues): Promise<Result<PersistedNotificationWriteResult>> {
        this.createCalls.push(values);
        this.events.push(`db:create:${imageLabel(values.imageUrl)}`);
        return resolveBehavior(this.createBehavior);
    }

    async update(
        id: number,
        expectedImageUrl: string | null,
        values: NotificationWriteValues,
    ): Promise<Result<PersistedNotificationWriteResult>> {
        this.updateCalls.push({ id, expectedImageUrl, values });
        this.events.push(this.updateEvent ?? `db:update:${imageLabel(values.imageUrl)}`);
        return resolveBehavior(this.updateBehavior);
    }
}

class FakeImageStorage implements NotificationImageStorage {
    readonly uploadedFiles: NotificationImageFile[] = [];
    readonly removedPaths: string[] = [];

    constructor(
        private readonly events: string[],
        private readonly uploadBehavior: ResultBehavior<StoredNotificationImage> = returned(ok({
            path: 'notifications/new.png',
            publicUrl: newUrl,
        })),
        private readonly removeBehavior: ResultBehavior<void> = returned(ok(undefined)),
        private readonly managedPaths: Readonly<Record<string, string | null>> = {
            [managedOldUrl]: 'notifications/old.png',
            [managedCallerUrl]: 'notifications/caller.png',
            [newUrl]: 'notifications/new.png',
            [externalOldUrl]: null,
        },
    ) {}

    async upload(file: NotificationImageFile): Promise<Result<StoredNotificationImage>> {
        this.uploadedFiles.push(file);
        this.events.push('upload:new');
        return resolveBehavior(this.uploadBehavior);
    }

    async remove(path: string): Promise<Result<void>> {
        this.removedPaths.push(path);
        this.events.push(`remove:${path === 'notifications/new.png' ? 'new-path' : path === 'notifications/old.png' ? 'old-path' : path}`);
        return resolveBehavior(this.removeBehavior);
    }

    managedPathFromPublicUrl(publicUrl: string): string | null {
        return this.managedPaths[publicUrl] ?? null;
    }
}

class FakeImageReferences implements NotificationImageReferenceQueryGateway {
    readonly checkedUrls: string[] = [];

    constructor(
        private readonly events: string[],
        private readonly behavior: ResultBehavior<boolean> = returned(ok(false)),
    ) {}

    async hasReference(imageUrl: string): Promise<Result<boolean>> {
        this.checkedUrls.push(imageUrl);
        const label = imageLabel(imageUrl);
        if (this.behavior.kind === 'throw') {
            this.events.push(`references:${label}=throw`);
            throw this.behavior.error;
        }
        this.events.push(`references:${label}=${this.behavior.result.ok ? this.behavior.result.value : 'error'}`);
        return this.behavior.result;
    }
}

const createService = ({
    events = [],
    gateway,
    storage,
    imageReferences,
}: {
    events?: string[];
    gateway?: FakeWriteGateway;
    storage?: FakeImageStorage;
    imageReferences?: FakeImageReferences;
} = {}) => {
    const resolvedGateway = gateway ?? new FakeWriteGateway(events);
    const resolvedStorage = storage ?? new FakeImageStorage(events);
    const resolvedImageReferences = imageReferences ?? new FakeImageReferences(events);

    return {
        gateway: resolvedGateway,
        storage: resolvedStorage,
        imageReferences: resolvedImageReferences,
        service: new SaveNotificationService(resolvedGateway, resolvedStorage, resolvedImageReferences),
    };
};

describe('SaveNotificationService validation and base flow', () => {
    it.each([
        ['title', createCommand({ title: ' \n\t ' }), '공지사항 제목을 입력해주세요.'],
        ['body', createCommand({ body: ' \n\t ' }), '공지사항 내용을 입력해주세요.'],
        ['endsAt', createCommand({ endsAt: 'not-a-date' }), '올바른 공지사항 종료일이 필요합니다.'],
    ] as const)('rejects a blank or invalid %s before any side effect', async (field, command, message) => {
        // Break caught: malformed write data reaching upload or database boundaries.
        const events: string[] = [];
        const { service } = createService({ events });

        await expect(service.save(command)).resolves.toEqual(err({
            kind: 'validation',
            field,
            message,
        }));
        expect(events).toEqual([]);
    });

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
        'rejects invalid update id %p before any side effect',
        async (id) => {
            // Break caught: an unsafe update identity reaching upload or database boundaries.
            const events: string[] = [];
            const { service } = createService({ events });

            await expect(service.save(updateCommand({ id }))).resolves.toEqual(err({
                kind: 'validation',
                field: 'id',
                message: '올바른 공지사항 ID가 필요합니다.',
            }));
            expect(events).toEqual([]);
        },
    );

    it('creates without an image and preserves submitted title and body content', async () => {
        // Break caught: forcing an image upload for image-less creates or trimming submitted content.
        const events: string[] = [];
        const gateway = new FakeWriteGateway(events, returned(saved(null)));
        const { service } = createService({ events, gateway });

        await expect(service.save(createCommand())).resolves.toEqual(ok({ id: 17, imageUrl: null }));
        expect(events).toEqual(['db:create:null']);
        expect(gateway.createCalls).toEqual([{
            ...baseFields,
            imageUrl: null,
        }]);
    });

    it('keeps the expected image on update and passes the optimistic database guard', async () => {
        // Break caught: losing an unchanged image or failing to pass the optimistic image guard.
        const events: string[] = [];
        const gateway = new FakeWriteGateway(
            events,
            returned(saved(null)),
            returned(saved(managedOldUrl, managedOldUrl)),
        );
        const { service } = createService({ events, gateway });

        await expect(service.save(updateCommand())).resolves.toEqual(ok({ id: 17, imageUrl: managedOldUrl }));
        expect(events).toEqual(['db:update:old-url']);
        expect(gateway.updateCalls).toEqual([{
            id: 17,
            expectedImageUrl: managedOldUrl,
            values: {
                ...baseFields,
                imageUrl: managedOldUrl,
            },
        }]);
    });

    it('returns an upload failure without calling the database gateway', async () => {
        // Break caught: persisting a row after the requested image failed to upload.
        const events: string[] = [];
        const uploadFailure = err<StoredNotificationImage>({
            kind: 'infrastructure',
            message: '공지사항 이미지를 업로드하지 못했습니다.',
        });
        const storage = new FakeImageStorage(events, returned(uploadFailure));
        const { service } = createService({ events, storage });

        await expect(service.save(createCommand({ imageChange: { kind: 'replace', file: imageFile } })))
            .resolves.toEqual(uploadFailure);
        expect(events).toEqual(['upload:new']);
    });

    it('preserves a returned database failure', async () => {
        // Break caught: replacing a gateway conflict with a different Application error.
        const events: string[] = [];
        const gateway = new FakeWriteGateway(events, returned(databaseFailure));
        const { service } = createService({ events, gateway });

        await expect(service.save(createCommand())).resolves.toEqual(databaseFailure);
        expect(events).toEqual(['db:create:null']);
    });

    it.each(['create', 'update'] as const)('maps a thrown %s database failure to a stable error', async (mode) => {
        // Break caught: leaking a rejected database promise beyond the Application boundary.
        const events: string[] = [];
        const gateway = new FakeWriteGateway(
            events,
            thrown(new Error('private create detail')),
            thrown(new Error('private update detail')),
        );
        const { service } = createService({ events, gateway });
        const command: SaveNotificationCommand = mode === 'create' ? createCommand() : updateCommand();

        await expect(service.save(command)).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '공지사항 저장에 실패했습니다.',
        }));
    });
});

describe('SaveNotificationService ordered cleanup policy', () => {
    it('removes a newly uploaded image after create fails', async () => {
        // Break caught: orphaning a new object when its create row does not commit.
        const events: string[] = [];
        const gateway = new FakeWriteGateway(events, returned(databaseFailure));
        const { service } = createService({ events, gateway });

        await expect(service.save(createCommand({ imageChange: { kind: 'replace', file: imageFile } })))
            .resolves.toEqual(databaseFailure);
        expect(events).toEqual(['upload:new', 'db:create:new-url', 'remove:new-path']);
    });

    it('removes only the new upload after a stale update and never the caller URL', async () => {
        // Break caught: treating caller-supplied optimistic state as evidence for deleting an old object.
        const events: string[] = [];
        const gateway = new FakeWriteGateway(
            events,
            returned(saved(null)),
            returned(databaseFailure),
            'db:update-conflict',
        );
        const storage = new FakeImageStorage(events);
        const { service } = createService({ events, gateway, storage });

        await expect(service.save(updateCommand({
            expectedImageUrl: managedCallerUrl,
            imageChange: { kind: 'replace', file: imageFile },
        }))).resolves.toEqual(databaseFailure);
        expect(events).toEqual(['upload:new', 'db:update-conflict', 'remove:new-path']);
        expect(storage.removedPaths).toEqual(['notifications/new.png']);
    });

    it('removes the database-verified managed prior image after replace commits and is unreferenced', async () => {
        // Break caught: removing before commit, without a fresh zero-reference check, or using the caller URL.
        const events: string[] = [];
        const gateway = new FakeWriteGateway(
            events,
            returned(saved(null)),
            returned(saved(newUrl, managedOldUrl)),
        );
        const { service } = createService({ events, gateway });

        await expect(service.save(updateCommand({
            expectedImageUrl: managedCallerUrl,
            imageChange: { kind: 'replace', file: imageFile },
        }))).resolves.toEqual(ok({ id: 17, imageUrl: newUrl }));
        expect(events).toEqual([
            'upload:new',
            'db:update:new-url',
            'references:old-url=false',
            'remove:old-path',
        ]);
    });

    it('retains the database-verified prior image when it remains shared', async () => {
        // Break caught: deleting a managed object that another notification still references.
        const events: string[] = [];
        const gateway = new FakeWriteGateway(
            events,
            returned(saved(null)),
            returned(saved(newUrl, managedOldUrl)),
        );
        const imageReferences = new FakeImageReferences(events, returned(ok(true)));
        const { service } = createService({ events, gateway, imageReferences });

        await expect(service.save(updateCommand({ imageChange: { kind: 'replace', file: imageFile } })))
            .resolves.toEqual(ok({ id: 17, imageUrl: newUrl }));
        expect(events).toEqual([
            'upload:new',
            'db:update:new-url',
            'references:old-url=true',
        ]);
    });

    it('removes the database-verified managed prior image after remove commits and is unreferenced', async () => {
        // Break caught: leaving an unreferenced managed object after a committed image removal.
        const events: string[] = [];
        const gateway = new FakeWriteGateway(
            events,
            returned(saved(null)),
            returned(saved(null, managedOldUrl)),
        );
        const { service } = createService({ events, gateway });

        await expect(service.save(updateCommand({ imageChange: { kind: 'remove' } })))
            .resolves.toEqual(ok({ id: 17, imageUrl: null }));
        expect(events).toEqual([
            'db:update:null',
            'references:old-url=false',
            'remove:old-path',
        ]);
    });

    it('does not inspect or remove the prior image for an update keep', async () => {
        // Break caught: cleaning up an image that the committed row intentionally kept.
        const events: string[] = [];
        const gateway = new FakeWriteGateway(
            events,
            returned(saved(null)),
            returned(saved(managedOldUrl, managedOldUrl)),
        );
        const { service } = createService({ events, gateway });

        await expect(service.save(updateCommand())).resolves.toEqual(ok({ id: 17, imageUrl: managedOldUrl }));
        expect(events).toEqual(['db:update:old-url']);
    });

    it('does not reference-check or remove an external database-verified prior image', async () => {
        // Break caught: attempting to delete an object outside managed notification Storage.
        const events: string[] = [];
        const gateway = new FakeWriteGateway(
            events,
            returned(saved(null)),
            returned(saved(newUrl, externalOldUrl)),
        );
        const { service } = createService({ events, gateway });

        await expect(service.save(updateCommand({ imageChange: { kind: 'replace', file: imageFile } })))
            .resolves.toEqual(ok({ id: 17, imageUrl: newUrl }));
        expect(events).toEqual(['upload:new', 'db:update:new-url']);
    });

    it('never cleans up a caller-only expected image after a successful write', async () => {
        // Break caught: elevating optimistic caller state into post-commit deletion evidence.
        const events: string[] = [];
        const gateway = new FakeWriteGateway(
            events,
            returned(saved(null)),
            returned(saved(null, null)),
        );
        const { service } = createService({ events, gateway });

        await expect(service.save(updateCommand({
            expectedImageUrl: managedCallerUrl,
            imageChange: { kind: 'remove' },
        }))).resolves.toEqual(ok({ id: 17, imageUrl: null }));
        expect(events).toEqual(['db:update:null']);
    });

    it('does not remove an unchanged managed object path', async () => {
        // Break caught: deleting the newly committed object when old and new URLs resolve to the same path.
        const events: string[] = [];
        const gateway = new FakeWriteGateway(
            events,
            returned(saved(null)),
            returned(saved(newUrl, managedOldUrl)),
        );
        const storage = new FakeImageStorage(
            events,
            returned(ok({ path: 'notifications/old.png', publicUrl: newUrl })),
        );
        const { service } = createService({ events, gateway, storage });

        await expect(service.save(updateCommand({ imageChange: { kind: 'replace', file: imageFile } })))
            .resolves.toEqual(ok({ id: 17, imageUrl: newUrl }));
        expect(events).toEqual(['upload:new', 'db:update:new-url']);
    });

    it.each([
        ['returned error', returned(cleanupFailure)],
        ['thrown error', thrown<void>(new Error('private cleanup detail'))],
    ] as const)('keeps the original database failure when new-file cleanup has a %s', async (_label, removeBehavior) => {
        // Break caught: replacing the original save failure with a best-effort cleanup failure.
        const events: string[] = [];
        const gateway = new FakeWriteGateway(events, returned(databaseFailure));
        const storage = new FakeImageStorage(events, undefined, removeBehavior);
        const { service } = createService({ events, gateway, storage });

        await expect(service.save(createCommand({ imageChange: { kind: 'replace', file: imageFile } })))
            .resolves.toEqual(databaseFailure);
        expect(events).toEqual(['upload:new', 'db:create:new-url', 'remove:new-path']);
    });

    it.each([
        ['returned error', returned(cleanupFailure)],
        ['thrown error', thrown<void>(new Error('private cleanup detail'))],
    ] as const)('keeps committed success when old-file removal has a %s', async (_label, removeBehavior) => {
        // Break caught: surfacing best-effort old-object removal failure as a failed committed write.
        const events: string[] = [];
        const gateway = new FakeWriteGateway(
            events,
            returned(saved(null)),
            returned(saved(newUrl, managedOldUrl)),
        );
        const storage = new FakeImageStorage(events, undefined, removeBehavior);
        const { service } = createService({ events, gateway, storage });

        await expect(service.save(updateCommand({ imageChange: { kind: 'replace', file: imageFile } })))
            .resolves.toEqual(ok({ id: 17, imageUrl: newUrl }));
        expect(events).toEqual([
            'upload:new',
            'db:update:new-url',
            'references:old-url=false',
            'remove:old-path',
        ]);
    });

    it.each([
        ['returned error', returned(referenceFailure), 'references:old-url=error'],
        ['thrown error', thrown<boolean>(new Error('private reference detail')), 'references:old-url=throw'],
    ] as const)(
        'fails closed and keeps committed success when the fresh reference check has a %s',
        async (_label, referenceBehavior, referenceEvent) => {
            // Break caught: deleting a managed prior object while its remaining references are uncertain.
            const events: string[] = [];
            const gateway = new FakeWriteGateway(
                events,
                returned(saved(null)),
                returned(saved(newUrl, managedOldUrl)),
            );
            const imageReferences = new FakeImageReferences(events, referenceBehavior);
            const storage = new FakeImageStorage(events);
            const { service } = createService({ events, gateway, imageReferences, storage });

            await expect(service.save(updateCommand({ imageChange: { kind: 'replace', file: imageFile } })))
                .resolves.toEqual(ok({ id: 17, imageUrl: newUrl }));
            expect(events).toEqual(['upload:new', 'db:update:new-url', referenceEvent]);
            expect(storage.removedPaths).toEqual([]);
        },
    );
});

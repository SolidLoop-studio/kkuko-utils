import type { NotificationImageReferenceQueryGateway } from '@/src/modules/notifications/application/notification-image-reference-query-ports';
import type {
    DeletedNotification,
    NotificationDeleteCommandGateway,
} from '@/src/modules/notifications/application/notification-delete-command-ports';
import type {
    NotificationImageStorage,
    StoredNotificationImage,
} from '@/src/modules/notifications/application/notification-write-command-ports';
import type { NotificationImageFile } from '@/src/modules/notifications/application/notification-write-command-types';
import { DeleteNotificationService } from '@/src/modules/notifications/application/delete-notification';
import { err, ok, type Result } from '@/src/shared/application/result';

const managedImageUrl =
    'https://project.supabase.co/storage/v1/object/public/public_img/notifications/old.png';
const externalImageUrl = 'https://cdn.example.com/old.png';
const managedImagePath = 'notifications/old.png';

type ResultBehavior<T> =
    | { kind: 'return'; result: Result<T> }
    | { kind: 'throw'; error: unknown };

const returned = <T>(result: Result<T>): ResultBehavior<T> => ({ kind: 'return', result });
const thrown = <T>(error: unknown): ResultBehavior<T> => ({ kind: 'throw', error });

const resolveBehavior = async <T>(behavior: ResultBehavior<T>): Promise<Result<T>> => {
    if (behavior.kind === 'throw') throw behavior.error;
    return behavior.result;
};

const deleted = (imageUrl: string | null): Result<DeletedNotification> => ok({
    id: 17,
    imageUrl,
});

const deleteFailure = err<DeletedNotification>({
    kind: 'infrastructure',
    message: '공지사항 삭제에 실패했습니다.',
});

const referenceFailure = err<boolean>({
    kind: 'infrastructure',
    message: '공지사항 이미지 참조를 확인하지 못했습니다.',
});

const cleanupFailure = err<void>({
    kind: 'infrastructure',
    message: '공지사항 이미지를 정리하지 못했습니다.',
});

class FakeDeleteGateway implements NotificationDeleteCommandGateway {
    readonly deletedIds: number[] = [];

    constructor(
        private readonly events: string[],
        private readonly behavior: ResultBehavior<DeletedNotification> = returned(deleted(null)),
    ) {}

    async deleteById(id: number): Promise<Result<DeletedNotification>> {
        this.deletedIds.push(id);
        this.events.push('db:delete');
        return resolveBehavior(this.behavior);
    }
}

class FakeImageStorage implements NotificationImageStorage {
    readonly removedPaths: string[] = [];

    constructor(
        private readonly events: string[],
        private readonly removeBehavior: ResultBehavior<void> = returned(ok(undefined)),
    ) {}

    async upload(_file: NotificationImageFile): Promise<Result<StoredNotificationImage>> {
        throw new Error('DeleteNotificationService must not upload images');
    }

    async remove(path: string): Promise<Result<void>> {
        this.removedPaths.push(path);
        this.events.push(`remove:${path === managedImagePath ? 'managed-path' : path}`);
        return resolveBehavior(this.removeBehavior);
    }

    managedPathFromPublicUrl(publicUrl: string): string | null {
        return publicUrl === managedImageUrl ? managedImagePath : null;
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
        if (this.behavior.kind === 'throw') {
            this.events.push('references:managed-url=throw');
            throw this.behavior.error;
        }

        this.events.push(
            `references:managed-url=${this.behavior.result.ok ? this.behavior.result.value : 'error'}`,
        );
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
    gateway?: FakeDeleteGateway;
    storage?: FakeImageStorage;
    imageReferences?: FakeImageReferences;
} = {}) => {
    const resolvedGateway = gateway ?? new FakeDeleteGateway(events);
    const resolvedStorage = storage ?? new FakeImageStorage(events);
    const resolvedImageReferences = imageReferences ?? new FakeImageReferences(events);

    return {
        gateway: resolvedGateway,
        storage: resolvedStorage,
        imageReferences: resolvedImageReferences,
        service: new DeleteNotificationService(
            resolvedGateway,
            resolvedStorage,
            resolvedImageReferences,
        ),
    };
};

describe('DeleteNotificationService', () => {
    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
        'rejects invalid id %p before the command gateway',
        async (id) => {
            // Break caught: allowing an unsafe notification ID to reach the database command boundary.
            const events: string[] = [];
            const { service } = createService({ events });

            await expect(service.delete(id)).resolves.toEqual(err({
                kind: 'validation',
                message: '올바른 공지사항 ID가 필요합니다.',
            }));
            expect(events).toEqual([]);
        },
    );

    it('accepts only an ID and returns the public Result<void> contract', async () => {
        // Break caught: exposing the deleted row or accepting caller image state at the public command boundary.
        const events: string[] = [];
        const { gateway, service } = createService({ events });

        const result: Result<void> = await service.delete(17);

        expect(result).toEqual(ok(undefined));
        expect(service.delete).toHaveLength(1);
        expect(gateway.deletedIds).toEqual([17]);
        expect(events).toEqual(['db:delete']);
    });

    it('removes a database-returned managed image only after delete commits and a fresh zero-reference result', async () => {
        // Break caught: deleting from caller state, before commit, or without a fresh zero-reference result.
        const events: string[] = [];
        const gateway = new FakeDeleteGateway(events, returned(deleted(managedImageUrl)));
        const { imageReferences, service } = createService({ events, gateway });

        await expect(service.delete(17)).resolves.toEqual(ok(undefined));
        expect(events).toEqual([
            'db:delete',
            'references:managed-url=false',
            'remove:managed-path',
        ]);
        expect(imageReferences.checkedUrls).toEqual([managedImageUrl]);
    });

    it('retains a database-returned managed image while another notification references it', async () => {
        // Break caught: deleting a shared object after the notification row commits.
        const events: string[] = [];
        const gateway = new FakeDeleteGateway(events, returned(deleted(managedImageUrl)));
        const imageReferences = new FakeImageReferences(events, returned(ok(true)));
        const { service } = createService({ events, gateway, imageReferences });

        await expect(service.delete(17)).resolves.toEqual(ok(undefined));
        expect(events).toEqual(['db:delete', 'references:managed-url=true']);
    });

    it.each([
        ['an external image', externalImageUrl],
        ['no image', null],
    ] as const)('does not inspect or remove %s after delete commits', async (_label, imageUrl) => {
        // Break caught: attempting cleanup without a database-returned managed object URL.
        const events: string[] = [];
        const gateway = new FakeDeleteGateway(events, returned(deleted(imageUrl)));
        const { service } = createService({ events, gateway });

        await expect(service.delete(17)).resolves.toEqual(ok(undefined));
        expect(events).toEqual(['db:delete']);
    });

    it.each([
        ['a returned error', returned(referenceFailure), 'references:managed-url=error'],
        ['a thrown error', thrown<boolean>(new Error('private reference detail')), 'references:managed-url=throw'],
    ] as const)(
        'fails closed and preserves committed success when the reference query has %s',
        async (_label, referenceBehavior, referenceEvent) => {
            // Break caught: removing a managed object while its remaining references are uncertain.
            const events: string[] = [];
            const gateway = new FakeDeleteGateway(events, returned(deleted(managedImageUrl)));
            const imageReferences = new FakeImageReferences(events, referenceBehavior);
            const storage = new FakeImageStorage(events);
            const { service } = createService({ events, gateway, imageReferences, storage });

            await expect(service.delete(17)).resolves.toEqual(ok(undefined));
            expect(events).toEqual(['db:delete', referenceEvent]);
            expect(storage.removedPaths).toEqual([]);
        },
    );

    it.each([
        ['a returned error', returned(cleanupFailure)],
        ['a thrown error', thrown<void>(new Error('private cleanup detail'))],
    ] as const)(
        'preserves committed success when Storage removal has %s',
        async (_label, removeBehavior) => {
            // Break caught: exposing best-effort cleanup failure as a failed committed row deletion.
            const events: string[] = [];
            const gateway = new FakeDeleteGateway(events, returned(deleted(managedImageUrl)));
            const storage = new FakeImageStorage(events, removeBehavior);
            const { service } = createService({ events, gateway, storage });

            await expect(service.delete(17)).resolves.toEqual(ok(undefined));
            expect(events).toEqual([
                'db:delete',
                'references:managed-url=false',
                'remove:managed-path',
            ]);
        },
    );

    it('preserves a returned row-deletion failure without attempting cleanup', async () => {
        // Break caught: performing cleanup after an uncommitted delete or replacing its stable error.
        const events: string[] = [];
        const gateway = new FakeDeleteGateway(events, returned(deleteFailure));
        const { service } = createService({ events, gateway });

        await expect(service.delete(17)).resolves.toEqual(deleteFailure);
        expect(events).toEqual(['db:delete']);
    });

    it('maps a thrown row-deletion failure and never attempts cleanup', async () => {
        // Break caught: leaking a rejected database command or cleaning up before a committed row result.
        const events: string[] = [];
        const gateway = new FakeDeleteGateway(
            events,
            thrown<DeletedNotification>(new Error('private database detail')),
        );
        const { service } = createService({ events, gateway });

        await expect(service.delete(17)).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '공지사항 삭제에 실패했습니다.',
        }));
        expect(events).toEqual(['db:delete']);
    });
});

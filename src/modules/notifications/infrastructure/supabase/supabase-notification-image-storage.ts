import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type {
    NotificationImageStorage,
    StoredNotificationImage,
} from '../../application/notification-write-command-ports';
import type { NotificationImageFile } from '../../application/notification-write-command-types';

const STORAGE_BUCKET = 'public_img' as const;
const OBJECT_PREFIX = 'notifications/' as const;
const PUBLIC_PATH_PREFIX = '/storage/v1/object/public/public_img/' as const;

export interface NotificationImageUploadOptions {
    cacheControl: '3600';
    upsert: false;
}

export interface NotificationImageStorageBucket {
    upload(
        path: string,
        body: Blob,
        options: NotificationImageUploadOptions,
    ): PromiseLike<unknown>;
    getPublicUrl(path: string): unknown;
    remove(paths: string[]): PromiseLike<unknown>;
}

export interface NotificationImageStorageClient {
    storage: {
        from(bucket: typeof STORAGE_BUCKET): NotificationImageStorageBucket;
    };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const uploadInfrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '공지사항 이미지를 업로드하지 못했습니다.',
});

const cleanupInfrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '공지사항 이미지를 정리하지 못했습니다.',
});

const hasSuccessfulUploadResponse = (value: unknown, expectedPath: string): boolean =>
    isRecord(value)
    && value.error === null
    && isRecord(value.data)
    && typeof value.data.path === 'string'
    && value.data.path.trim().length > 0
    && value.data.path === expectedPath;

const hasSuccessfulRemoveResponse = (value: unknown): boolean =>
    isRecord(value) && value.error === null && Array.isArray(value.data);

const publicUrlFromResponse = (value: unknown): string | null => {
    if (!isRecord(value) || (value.error !== undefined && value.error !== null)) return null;
    if (!isRecord(value.data) || typeof value.data.publicUrl !== 'string') return null;

    return value.data.publicUrl.trim().length > 0 ? value.data.publicUrl : null;
};

const isUnsafeFileNameCharacter = (character: string): boolean => {
    const codePoint = character.codePointAt(0);

    return character === '/'
        || character === '\\'
        || /^\s$/u.test(character)
        || codePoint === undefined
        || codePoint <= 31
        || codePoint === 127;
};

const safeFileName = (name: string): string => {
    let sanitized = '';
    let isInUnsafeRun = false;

    for (const character of name) {
        if (isUnsafeFileNameCharacter(character)) {
            if (!isInUnsafeRun) sanitized += '_';
            isInUnsafeRun = true;
            continue;
        }

        sanitized += character;
        isInUnsafeRun = false;
    }

    return sanitized || 'image';
};

const rawPathnameFromAbsoluteUrl = (publicUrl: string): string | null => {
    const match = /^[a-z][a-z\d+.-]*:\/\/[^/?#]*(\/[^?#]*)?(?:[?#].*)?$/iu.exec(publicUrl);

    return match?.[1] ?? null;
};

const httpUrlFromString = (url: string): URL | null => {
    try {
        const parsed = new URL(url);

        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
            ? parsed
            : null;
    } catch {
        return null;
    }
};

/** Supabase Storage의 공지 이미지 업로드, 정리, 관리 경로 판별을 한 경계에 격리합니다. */
export class SupabaseNotificationImageStorage implements NotificationImageStorage {
    constructor(
        private readonly client: NotificationImageStorageClient,
        private readonly now: () => number = Date.now,
        private readonly supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    ) {}

    async upload(file: NotificationImageFile): Promise<Result<StoredNotificationImage>> {
        const path = `${OBJECT_PREFIX}${this.now()}_${safeFileName(file.name)}`;

        try {
            const contents = await file.arrayBuffer();
            const body = new Blob([contents], { type: file.type });
            const bucket = this.client.storage.from(STORAGE_BUCKET);
            const uploadResponse: unknown = await bucket.upload(path, body, {
                cacheControl: '3600',
                upsert: false,
            });

            if (!hasSuccessfulUploadResponse(uploadResponse, path)) {
                return err(uploadInfrastructureError());
            }

            let publicUrlResponse: unknown;
            try {
                publicUrlResponse = bucket.getPublicUrl(path);
            } catch {
                await this.bestEffortRemove(bucket, path);
                return err(uploadInfrastructureError());
            }

            const publicUrl = publicUrlFromResponse(publicUrlResponse);
            if (publicUrl === null) {
                await this.bestEffortRemove(bucket, path);
                return err(uploadInfrastructureError());
            }

            return ok({ path, publicUrl });
        } catch {
            return err(uploadInfrastructureError());
        }
    }

    async remove(path: string): Promise<Result<void>> {
        try {
            const response: unknown = await this.client.storage
                .from(STORAGE_BUCKET)
                .remove([path]);

            return hasSuccessfulRemoveResponse(response)
                ? ok(undefined)
                : err(cleanupInfrastructureError());
        } catch {
            return err(cleanupInfrastructureError());
        }
    }

    managedPathFromPublicUrl(publicUrl: string): string | null {
        if (publicUrl.includes('\\')) return null;

        const configuredUrl = httpUrlFromString(this.supabaseUrl);
        const candidateUrl = httpUrlFromString(publicUrl);
        if (configuredUrl === null || candidateUrl?.origin !== configuredUrl.origin) return null;

        const rawPathname = rawPathnameFromAbsoluteUrl(publicUrl);
        if (rawPathname === null || !rawPathname.startsWith(PUBLIC_PATH_PREFIX)) return null;

        let objectPath: string;
        try {
            objectPath = decodeURIComponent(rawPathname.slice(PUBLIC_PATH_PREFIX.length));
        } catch {
            return null;
        }

        if (!objectPath.startsWith(OBJECT_PREFIX)) return null;

        const segments = objectPath.split(/[\\/]/u);
        const basename = segments[segments.length - 1];
        if (
            basename === undefined
            || basename.length === 0
            || segments.some((segment) => segment === '.' || segment === '..')
        ) {
            return null;
        }

        return objectPath;
    }

    private async bestEffortRemove(
        bucket: NotificationImageStorageBucket,
        path: string,
    ): Promise<void> {
        try {
            await bucket.remove([path]);
        } catch {
            // URL 매핑 실패가 주 오류이므로 후속 정리 실패는 외부로 노출하지 않습니다.
        }
    }
}

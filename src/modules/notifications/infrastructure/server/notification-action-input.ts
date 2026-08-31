import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type {
    NotificationImageChange,
    NotificationImageFile,
    SaveNotificationCommand,
} from '../../application/notification-write-command-types';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const validationError = (field?: string): ApplicationError => ({
    kind: 'validation',
    message: '입력이 올바르지 않습니다.',
    ...(field === undefined ? {} : { field }),
});

const singleString = (formData: FormData, field: string): string | null => {
    const values = formData.getAll(field);
    return values.length === 1 && typeof values[0] === 'string' ? values[0] : null;
};

const isCanonicalPositiveId = (value: string): boolean =>
    /^(?:[1-9]\d*)$/u.test(value)
    && Number.isSafeInteger(Number(value));

const isCanonicalIsoDate = (value: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toISOString() === value;
};

const isHttpUrl = (value: string): boolean => {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
};

const isImageFile = (value: FormDataEntryValue): value is File =>
    typeof File !== 'undefined'
    && value instanceof File
    && value.size > 0
    && value.size <= MAX_IMAGE_BYTES
    && value.type.startsWith('image/');

const hasNonemptyImage = (value: FormDataEntryValue): boolean =>
    typeof value === 'string' ? value.length > 0 : value.size > 0;

const parseImageChange = (
    formData: FormData,
    mode: 'create' | 'update',
    imageChange: string,
): Result<NotificationImageChange> => {
    const images = formData.getAll('image');
    if (imageChange === 'replace') {
        if (images.length !== 1 || !isImageFile(images[0])) return err(validationError('image'));
        return ok({ kind: 'replace', file: images[0] as NotificationImageFile });
    }

    if (images.some(hasNonemptyImage)) return err(validationError('image'));
    if (imageChange === 'keep') return ok({ kind: 'keep' });
    if (imageChange === 'remove' && mode === 'update') return ok({ kind: 'remove' });
    return err(validationError('imageChange'));
};

/** Server Action FormData를 중복 없는 공지 저장 명령으로 검증·정규화합니다. */
export const parseSaveNotificationFormData = (formData: FormData): Result<SaveNotificationCommand> => {
    const mode = singleString(formData, 'mode');
    const title = singleString(formData, 'title');
    const body = singleString(formData, 'body');
    const endsAt = singleString(formData, 'endsAt');
    const isImportant = singleString(formData, 'isImportant');
    const isModal = singleString(formData, 'isModal');
    const imageChange = singleString(formData, 'imageChange');

    if (
        (mode !== 'create' && mode !== 'update')
        || title === null
        || body === null
        || endsAt === null
        || !isCanonicalIsoDate(endsAt)
        || (isImportant !== 'true' && isImportant !== 'false')
        || (isModal !== 'true' && isModal !== 'false')
        || imageChange === null
    ) {
        return err(validationError());
    }

    const parsedImageChange = parseImageChange(formData, mode, imageChange);
    if (!parsedImageChange.ok) return parsedImageChange;

    const fields = {
        title,
        body,
        endsAt,
        isImportant: isImportant === 'true',
        isModal: isModal === 'true',
        imageChange: parsedImageChange.value,
    };

    if (mode === 'create') {
        if (parsedImageChange.value.kind === 'remove') return err(validationError('imageChange'));
        return ok({ ...fields, mode, imageChange: parsedImageChange.value });
    }

    const id = singleString(formData, 'id');
    const expectedImageUrl = singleString(formData, 'expectedImageUrl');
    if (
        id === null
        || !isCanonicalPositiveId(id)
        || expectedImageUrl === null
        || (expectedImageUrl !== '' && !isHttpUrl(expectedImageUrl))
    ) {
        return err(validationError());
    }

    return ok({
        ...fields,
        mode,
        id: Number(id),
        expectedImageUrl: expectedImageUrl || null,
    });
};

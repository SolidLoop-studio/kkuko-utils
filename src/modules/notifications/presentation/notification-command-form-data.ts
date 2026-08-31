import type { SaveNotificationCommand } from '../application/notification-write-command-types';

/** 공지 저장 명령을 Server Action의 FormData 계약으로 변환합니다. */
export const toSaveNotificationFormData = (command: SaveNotificationCommand): FormData => {
    const formData = new FormData();
    formData.append('mode', command.mode);
    formData.append('title', command.title);
    formData.append('body', command.body);
    formData.append('endsAt', command.endsAt);
    formData.append('isImportant', String(command.isImportant));
    formData.append('isModal', String(command.isModal));
    formData.append('imageChange', command.imageChange.kind);

    if (command.mode === 'update') {
        formData.append('id', String(command.id));
        formData.append('expectedImageUrl', command.expectedImageUrl ?? '');
    }
    if (command.imageChange.kind === 'replace') {
        formData.append('image', command.imageChange.file as File);
    }

    return formData;
};

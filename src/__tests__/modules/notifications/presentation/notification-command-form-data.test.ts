import { toSaveNotificationFormData } from '@/src/modules/notifications/presentation/notification-command-form-data';
import type { SaveNotificationCommand } from '@/src/modules/notifications/application/notification-write-command-types';

const createCommand = (): SaveNotificationCommand => ({
    mode: 'create',
    title: '점검 안내',
    body: '점검 본문',
    endsAt: '2026-08-30T00:00:00.000Z',
    isImportant: true,
    isModal: false,
    imageChange: { kind: 'keep' },
});

describe('toSaveNotificationFormData', () => {
    it('serializes every create scalar using the Task 5 field names and lowercase booleans', () => {
        const formData = toSaveNotificationFormData(createCommand());

        expect([...formData.entries()]).toEqual([
            ['mode', 'create'],
            ['title', '점검 안내'],
            ['body', '점검 본문'],
            ['endsAt', '2026-08-30T00:00:00.000Z'],
            ['isImportant', 'true'],
            ['isModal', 'false'],
            ['imageChange', 'keep'],
        ]);
    });

    it('serializes update identifiers, a null expected image, and the original replacement file', () => {
        const image = new File(['image'], 'notice.png', { type: 'image/png' });
        const formData = toSaveNotificationFormData({
            ...createCommand(),
            mode: 'update',
            id: 17,
            expectedImageUrl: null,
            imageChange: { kind: 'replace', file: image },
        });

        expect(formData.get('id')).toBe('17');
        expect(formData.get('expectedImageUrl')).toBe('');
        expect(formData.get('imageChange')).toBe('replace');
        expect(formData.get('image')).toBe(image);
    });
});
